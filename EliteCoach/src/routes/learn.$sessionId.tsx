import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { requireLearner } from "@/lib/auth-guard";
import { useEffect, useRef, useState } from "react";
import {
    aiTutorApi,
    buildNotificationPayload,
    coerceIntegerId,
    contentApi,
    notificationsApi,
    extractErrorMessage,
    unwrapApiData,
    escalateSessionToTutor,
    fetchInlineKnowledgeChecks,
    generateModuleAssessment,
    type KnowledgeCheck,
    type ModuleAssessment,
} from "@/lib/api-client";
import { useAuthStore, useSessionStore } from "@/lib/stores";
import { toast } from "sonner";
import {
    Send,
    Check,
    ChevronLeft,
    ChevronRight,
    X,
    MessageSquare,
    BookOpen,
    Award,
    Zap,
} from "lucide-react";
import ReactMarkdown from "react-markdown";

function getEmbeddedVideoUrl(content: string): string | null {
    const youtubeMatch = content.match(
        /(https?:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11}))(?:[&?][^\s]*)?/i
    );
    if (youtubeMatch?.[2]) {
        return `https://www.youtube.com/embed/${youtubeMatch[2]}`;
    }

    const vimeoMatch = content.match(
        /(https?:\/\/vimeo\.com\/(?:channels\/[A-Za-z0-9_-]+\/|ondemand\/[A-Za-z0-9_-]+\/)?(\d+))(?:[&?][^\s]*)?/i
    );
    if (vimeoMatch?.[2]) {
        return `https://player.vimeo.com/video/${vimeoMatch[2]}`;
    }

    const iframeMatch = content.match(/<iframe[^>]+src="([^"]+)"/i);
    if (iframeMatch?.[1]) {
        return iframeMatch[1];
    }
    return null;
}

interface ContentChunk {
    id?: string;
    title: string;
    content?: string;
}

interface Module {
    id: string;
    title: string;
    content_chunks?: ContentChunk[];
}

export const Route = createFileRoute("/learn/$sessionId")({
    beforeLoad: () => { requireLearner(); },
    head: () => ({ meta: [{ title: "Learning room — EliteCoach" }] }),
    component: LearningRoomPage,
});

function LearningRoomPage() {
    const { sessionId } = Route.useParams();
    const navigate = useNavigate();
    const courseId = useSessionStore((s) => s.courseId);
    const currentSessionId = useSessionStore((s) => s.currentSessionId);
    const storedSubjectId = useSessionStore((s) => s.subjectId);
    const messages = useSessionStore((s) => s.messages);
    const addMessage = useSessionStore((s) => s.addMessage);
    const clearSession = useSessionStore((s) => s.clearSession);
    const setSession = useSessionStore((s) => s.setSession);
    const user = useAuthStore((s) => s.user);

    const [modules, setModules] = useState<Module[]>([]);
    const [activeModule, setActiveModule] = useState(0);
    const [activeLesson, setActiveLesson] = useState(0);
    const [completed, setCompleted] = useState<Set<string>>(new Set());
    const [input, setInput] = useState("");
    const [sending, setSending] = useState(false);
    const [showSummary, setShowSummary] = useState<string | null>(null);
    const [mobileTab, setMobileTab] = useState<"lesson" | "tutor">("lesson");
    const chatRef = useRef<HTMLDivElement>(null);

    const [escalated, setEscalated] = useState(false);

    // Knowledge Checks (Inline)
    const [knowledgeChecks, setKnowledgeChecks] = useState<KnowledgeCheck[]>([]);
    const [kcAnswers, setKcAnswers] = useState<Record<string, string>>({});
    const [kcPassed, setKcPassed] = useState(false);

    // Module Assessments
    const [moduleAssessment, setModuleAssessment] = useState<ModuleAssessment | null>(null);
    const [maAnswers, setMaAnswers] = useState<Record<string, string>>({});
    const [maResult, setMaResult] = useState<{ score: number, passed: boolean } | null>(null);

    useEffect(() => {
        if (!sessionId) return;
        const raw = localStorage.getItem("elitecoach.mock.escalations");
        if (raw) {
            try {
                const list = JSON.parse(raw);
                const hasEsc = list.some((x: any) => String(x.id) === String(sessionId) && x.status !== "resolved");
                if (hasEsc) {
                    setEscalated(true);
                }
            } catch (e) {}
        }
    }, [sessionId]);

    const triggerEscalation = async (reason: string) => {
        if (escalated) return;
        setEscalated(true);
        const learnerName = `${user?.firstName || "Learner"} ${user?.lastName || ""}`.trim();
        const learnerEmail = user?.email || "learner@elitecoach.ai";
        const courseTitle = currentModule?.title ?? "General Subject";

        try {
            await escalateSessionToTutor(
                String(sessionId),
                learnerName,
                learnerEmail,
                courseTitle,
                String(courseId ?? "1"),
                reason,
                messages.map((m) => ({
                    id: m.id,
                    role: m.role as any,
                    content: m.content,
                    ts: m.ts,
                }))
            );
            toast.info("This session has been escalated to a human tutor for assistance.");
        } catch (e) {
            console.error("Escalation failed", e);
        }
    };

    const triggerManualEscalation = async () => {
        addMessage({
            id: crypto.randomUUID(),
            role: "assistant",
            content: "⚠️ *System: Initiating human tutor escalation at user's request. Tutors have been notified.*",
            ts: Date.now(),
        });
        await triggerEscalation("Learner manually requested human tutor assistance.");
    };

    useEffect(() => {
        if (!courseId) return;
        contentApi
            .get(`/courses/${courseId}/curriculum`)
            .then((res) => {
                const payload = unwrapApiData<unknown>(res.data);
                const rawMods = Array.isArray(payload)
                    ? payload
                    : ((payload as { modules?: Module[] } | null)?.modules ??
                      []);
                // If a module has no content_chunks, synthesize one from the module itself
                // so the navigation always has something to show
                const normalized = rawMods.map((m: any) => ({
                    ...m,
                    content_chunks:
                        m.content_chunks && m.content_chunks.length > 0
                            ? m.content_chunks
                            : [{ id: m.id, title: m.title, content: m.content ?? undefined }],
                }));
                setModules(normalized);
            })
            .catch(() => {});
    }, [courseId]);

    useEffect(() => {
        let alive = true;
        if (!sessionId) return;
        if (sessionId === currentSessionId && courseId) return;

        aiTutorApi
            .get("/api/v1/learning/sessions")
            .then((res) => {
                if (!alive) return;
                const data = unwrapApiData<unknown>(res.data);
                const sessionList = Array.isArray(data)
                    ? data
                    : ((data as { sessions?: unknown[] } | null)?.sessions ?? []);
                const matched = (sessionList as any[]).find((session) => {
                    const id = String(session.id ?? session.session_id ?? "");
                    return id === String(sessionId);
                });
                if (matched) {
                    const foundCourseId = String(
                        matched.course_id ?? (matched as any).courseId ?? ""
                    );
                    const foundSubjectId =
                        coerceIntegerId((matched as any).subject_id ?? matched.subject_id) ??
                        coerceIntegerId(foundCourseId);
                    if (foundCourseId) {
                        setSession({
                            sessionId: String(sessionId),
                            courseId: foundCourseId,
                            subjectId: foundSubjectId,
                        });
                    }
                }
            })
            .catch(() => {})
            .finally(() => {
                if (!alive) return;
            });
        return () => {
            alive = false;
        };
    }, [sessionId, currentSessionId, courseId, setSession]);

    useEffect(() => {
        if (chatRef.current)
            chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }, [messages]);

    const currentModule = modules[activeModule];
    const currentLesson = currentModule?.content_chunks?.[activeLesson];

    const embeddedVideoUrl = currentLesson?.content
        ? getEmbeddedVideoUrl(currentLesson.content)
        : null;

    const totalLessons = modules.reduce(
        (sum, m) => sum + (m.content_chunks?.length ?? 0),
        0
    );
    const progress =
        totalLessons === 0
            ? 0
            : Math.round((completed.size / totalLessons) * 100);

    const lessonKey = (mi: number, li: number) => `${mi}-${li}`;

    const isLastLesson =
        activeModule === modules.length - 1 &&
        activeLesson ===
            (modules[activeModule]?.content_chunks?.length ?? 0) - 1;

    const markComplete = () => {
        setCompleted((prev) =>
            new Set(prev).add(lessonKey(activeModule, activeLesson))
        );
        toast.success("Lesson marked complete");
    };

    useEffect(() => {
        if (!currentLesson) return;
        setKnowledgeChecks([]);
        setKcAnswers({});
        setKcPassed(false);
        fetchInlineKnowledgeChecks(currentLesson.id ?? "unknown", currentLesson.title)
            .then(kcs => {
                setKnowledgeChecks(kcs);
                if (kcs.length === 0) setKcPassed(true);
            })
            .catch(() => {
                setKcPassed(true);
            });
    }, [currentLesson?.id, currentLesson?.title]);

    const goNext = async () => {
        if (!currentModule) return;
        
        if (knowledgeChecks.length > 0 && !kcPassed) {
            toast.error("Please pass the knowledge check below to proceed.");
            return;
        }

        const lessons = currentModule.content_chunks ?? [];
        if (activeLesson < lessons.length - 1) {
            setActiveLesson(activeLesson + 1);
        } else if (activeModule < modules.length - 1) {
            const ma = await generateModuleAssessment(currentModule.id, currentModule.title);
            setModuleAssessment(ma);
            setMaAnswers({});
            setMaResult(null);
        }
    };

    const submitModuleAssessment = () => {
        if (!moduleAssessment) return;
        let correct = 0;
        moduleAssessment.questions.forEach(q => {
            if (maAnswers[q.id] === q.correctAnswer) correct++;
        });
        const score = Math.round((correct / moduleAssessment.questions.length) * 100);
        const passed = score >= 70;
        setMaResult({ score, passed });
        if (passed) {
            toast.success("Module Assessment passed! Unlocking next module.");
            setTimeout(() => {
                setModuleAssessment(null);
                setActiveModule(activeModule + 1);
                setActiveLesson(0);
            }, 2500);
        } else {
            toast.error("You need 70% to pass. Please review the material and try again.");
        }
    };

    const goPrev = () => {
        if (activeLesson > 0) {
            setActiveLesson(activeLesson - 1);
        } else if (activeModule > 0) {
            setActiveModule(activeModule - 1);
            const prevMod = modules[activeModule - 1];
            setActiveLesson((prevMod?.content_chunks?.length ?? 1) - 1);
        }
    };

    const sendMessage = async (overrideText?: string) => {
        const text = (typeof overrideText === "string" ? overrideText : input).trim();
        if (!text) return;
        const subjectId =
            coerceIntegerId(currentLesson?.id) ??
            coerceIntegerId(currentModule?.id) ??
            storedSubjectId ??
            coerceIntegerId(courseId);

        if (subjectId == null) {
            toast.error(
                "This lesson is missing the numeric subject ID required by the tutor API."
            );
            return;
        }

        // Escalation checks
        const userMsgs = messages.filter((m) => m.role === "user");
        const isRepeat =
            userMsgs.length >= 2 &&
            userMsgs[userMsgs.length - 1].content.trim().toLowerCase() === text.toLowerCase() &&
            userMsgs[userMsgs.length - 2].content.trim().toLowerCase() === text.toLowerCase();

        const frustrationKeywords = [
            "stupid", "useless", "confusing", "horrible", "waste of time",
            "frustrated", "frustrated language", "terrible", "doesn't make sense",
            "worst", "hate", "crap", "garbage", "trash", "annoyed"
        ];
        const isFrustrated = frustrationKeywords.some((kw) => text.toLowerCase().includes(kw));

        const groundingKeywords = [
            "polars", "spark cluster", "kubernetes", "docker container",
            "aws billing", "unsupported", "grounding block", "human tutor",
            "escalate", "contact human", "talk to human", "real tutor"
        ];
        const isGroundingBlock = groundingKeywords.some((kw) => text.toLowerCase().includes(kw));

        if (isRepeat || isFrustrated || isGroundingBlock) {
            setInput("");
            addMessage({
                id: crypto.randomUUID(),
                role: "user",
                content: text,
                ts: Date.now(),
            });

            let reason = "AI tutor grounding block - unsupported question context.";
            if (isRepeat) reason = "Learner asked the same question 3 times.";
            else if (isFrustrated) reason = "Frustrated language detected in learner message.";

            addMessage({
                id: crypto.randomUUID(),
                role: "assistant",
                content: "⚠️ *System: This conversation has been escalated to a human tutor. Tutors have been notified and will respond to you shortly.*",
                ts: Date.now() + 100,
            });

            await triggerEscalation(reason);
            return;
        }

        setInput("");
        addMessage({
            id: crypto.randomUUID(),
            role: "user",
            content: text,
            ts: Date.now(),
        });
        setSending(true);
        try {
            const res = await aiTutorApi.post(
                `/api/v1/learning/sessions/${sessionId}/message`,
                {
                    message: text,
                    subject_id: subjectId,
                    context:
                        currentLesson?.title ??
                        currentModule?.title ??
                        "General",
                }
            );
            const payload = unwrapApiData<unknown>(res.data);
            const reply =
                typeof payload === "string"
                    ? payload
                    : ((
                          payload as {
                              ai_response?: string;
                              response?: string;
                              message?: string;
                              reply?: string;
                          }
                      )?.ai_response ??
                      (
                          payload as {
                              ai_response?: string;
                              response?: string;
                              message?: string;
                              reply?: string;
                          }
                      )?.response ??
                      (
                          payload as {
                              ai_response?: string;
                              response?: string;
                              message?: string;
                              reply?: string;
                          }
                      )?.message ??
                      (
                          payload as {
                              ai_response?: string;
                              response?: string;
                              message?: string;
                              reply?: string;
                          }
                      )?.reply ??
                      "I'm here to help — could you give me a bit more detail?");
            addMessage({
                id: crypto.randomUUID(),
                role: "assistant",
                content:
                    typeof reply === "string" ? reply : JSON.stringify(reply),
                ts: Date.now(),
            });
        } catch (err) {
            addMessage({
                id: crypto.randomUUID(),
                role: "assistant",
                content:
                    "I had trouble reaching the AI tutor just now. Try again in a moment, or move on to the next lesson.",
                ts: Date.now(),
            });
            toast.error(extractErrorMessage(err, "AI tutor unreachable"));
        } finally {
            setSending(false);
        }
    };

    const endSession = async () => {
        try {
            const res = await aiTutorApi.post(
                `/api/v1/learning/sessions/${sessionId}/end`,
                {}
            );
            const payload = unwrapApiData<unknown>(res.data);
            const summary = (() => {
                if (typeof payload === "string") return payload;
                const record =
                    payload && typeof payload === "object"
                        ? (payload as Record<string, unknown>)
                        : null;
                const direct =
                    typeof record?.summary === "string" ? record.summary : null;
                if (direct) return direct;

                const sessionSummary =
                    record?.session_summary &&
                    typeof record.session_summary === "object"
                        ? (record.session_summary as Record<string, unknown>)
                        : null;
                if (!sessionSummary) {
                    return "Session ended. Great work today — your progress has been saved.";
                }

                const topics = Array.isArray(sessionSummary.topics_covered)
                    ? sessionSummary.topics_covered
                          .filter(
                              (item): item is string => typeof item === "string"
                          )
                          .slice(0, 5)
                    : [];
                const totalExchanges =
                    typeof sessionSummary.total_exchanges === "number"
                        ? sessionSummary.total_exchanges
                        : null;
                const feedback =
                    typeof sessionSummary.quality_feedback === "string"
                        ? sessionSummary.quality_feedback
                        : null;

                const lines = ["Session summary:"];
                if (topics.length) lines.push(`Topics: ${topics.join(", ")}`);
                if (totalExchanges != null)
                    lines.push(`Exchanges: ${totalExchanges}`);
                if (feedback) lines.push(`Feedback: ${feedback}`);

                return lines.length > 1
                    ? lines.join("\n")
                    : "Session ended. Great work today — your progress has been saved.";
            })();
            setShowSummary(
                typeof summary === "string" ? summary : JSON.stringify(summary)
            );
            notificationsApi
                .post(
                    "/api/v1/notification/send",
                    buildNotificationPayload({
                        to: user?.email,
                        subject: "Session ended",
                        body: "Great session! Here's your summary.",
                    })
                )
                .catch(() => {});
        } catch (err) {
            toast.error(extractErrorMessage(err, "Could not end session"));
        }
    };

    const closeSummary = () => {
        setShowSummary(null);
        clearSession();
        navigate({ to: "/dashboard" });
    };

    const handleKcSelect = (kc: KnowledgeCheck, option: string) => {
        setKcAnswers(prev => ({ ...prev, [kc.id]: option }));
        if (option === kc.correctAnswer) {
            toast.success("Correct!");
            const allCorrect = knowledgeChecks.every(k => 
                (k.id === kc.id ? option : kcAnswers[k.id]) === k.correctAnswer
            );
            if (allCorrect) setKcPassed(true);
        } else {
            toast.error("Not quite! Your AI tutor will help explain.");
            const msg = `I incorrectly answered "${option}" to the question "${kc.question}". The correct answer is "${kc.correctAnswer}". Please explain why in 1-2 short sentences so I understand.`;
            setMobileTab("tutor");
            setTimeout(() => {
                sendMessage(msg);
            }, 100);
        }
    };

    const SidebarTree = (
        <div className="h-full flex flex-col">
            <div className="p-6 border-b border-white/10">
                <Link
                    to="/courses"
                    className="label-caps text-coral hover:underline inline-block mb-3"
                >
                    ← Exit
                </Link>
                <div className="text-sm font-semibold mb-3 truncate">
                    Course progress
                </div>
                <div className="h-1 w-full bg-white/10 rounded-sm overflow-hidden">
                    <div
                        className="h-full bg-coral transition-all"
                        style={{ width: `${progress}%` }}
                    />
                </div>
                <div className="text-xs text-white/60 mt-2 font-mono">
                    {progress}% complete
                </div>
            </div>
            <div className="flex-1 overflow-auto p-3">
                {modules.length === 0 ? (
                    <div className="text-sm text-white/60 p-3">
                        Loading curriculum...
                    </div>
                ) : (
                    modules.map((m, mi) => (
                        <div key={m.id} className="mb-2">
                            <div className="px-3 py-2 label-caps text-white/50">
                                {String(mi + 1).padStart(2, "0")} · {m.title}
                            </div>
                            {(m.content_chunks ?? []).map((c, li) => {
                                const isActive =
                                    mi === activeModule && li === activeLesson;
                                const isDone = completed.has(lessonKey(mi, li));
                                return (
                                    <button
                                        key={c.id ?? li}
                                        onClick={() => {
                                            setActiveModule(mi);
                                            setActiveLesson(li);
                                            setMobileTab("lesson");
                                        }}
                                        className={`w-full text-left px-3 py-2 text-sm flex items-center gap-3 rounded-sm transition-colors ${
                                            isActive
                                                ? "bg-primary text-white"
                                                : "text-white/80 hover:bg-white/5"
                                        }`}
                                    >
                                        <span
                                            className={`w-4 h-4 border flex items-center justify-center shrink-0 ${
                                                isDone
                                                    ? "bg-coral border-coral"
                                                    : "border-white/30"
                                            }`}
                                        >
                                            {isDone && (
                                                <Check
                                                    size={10}
                                                    className="text-white"
                                                />
                                            )}
                                        </span>
                                        <span className="line-clamp-2">
                                            {c.title}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    ))
                )}
            </div>
        </div>
    );

    const LessonCenter = moduleAssessment ? (
        <div className="flex flex-col h-full bg-surface-card overflow-hidden">
            <div className="flex items-center justify-between px-8 py-4 border-b border-border bg-primary text-primary-foreground">
                <div className="text-sm font-bold truncate">
                    {moduleAssessment.title}
                </div>
                <button onClick={() => setModuleAssessment(null)} className="opacity-80 hover:opacity-100">
                    <X size={20} />
                </button>
            </div>
            <div className="flex-1 overflow-auto px-8 py-10 bg-surface">
                <div className="max-w-2xl mx-auto">
                    {maResult && (
                        <div className={`mb-8 p-6 border-l-4 rounded-r-lg ${maResult.passed ? 'border-success bg-success/10' : 'border-destructive bg-destructive/10'}`}>
                            <h3 className="text-lg font-bold mb-1">
                                {maResult.passed ? "Module Passed!" : "Module Failed"}
                            </h3>
                            <p className="text-sm">You scored {maResult.score}%. {maResult.passed ? "Great job, the next module is unlocked." : "You need 70% to pass. Please try again."}</p>
                        </div>
                    )}
                    <h2 className="text-2xl font-bold mb-6">Module Assessment</h2>
                    <div className="space-y-8">
                        {moduleAssessment.questions.map((q, i) => (
                            <div key={q.id} className="bg-white p-6 rounded-lg shadow-sm border border-border">
                                <p className="font-semibold mb-4 text-lg">{i + 1}. {q.question}</p>
                                <div className="space-y-3">
                                    {q.options.map(opt => {
                                        const isSel = maAnswers[q.id] === opt;
                                        return (
                                            <label key={opt} className={`flex items-center gap-3 p-4 border rounded cursor-pointer transition-colors ${isSel ? 'border-primary bg-primary/5' : 'border-border hover:bg-slate-50'}`}>
                                                <input 
                                                    type="radio" 
                                                    name={`q-${q.id}`} 
                                                    checked={isSel} 
                                                    onChange={() => setMaAnswers(prev => ({ ...prev, [q.id]: opt }))} 
                                                    className="w-4 h-4 text-primary"
                                                />
                                                <span>{opt}</span>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            <div className="border-t border-border px-8 py-4 flex items-center justify-end bg-surface-card">
                <button
                    onClick={submitModuleAssessment}
                    disabled={Object.keys(maAnswers).length !== moduleAssessment.questions.length || maResult !== null}
                    className="h-11 px-6 bg-primary text-primary-foreground font-medium hover:bg-primary-hover transition-colors disabled:opacity-50"
                >
                    Submit Assessment
                </button>
            </div>
        </div>
    ) : (
        <div className="flex flex-col h-full bg-surface-card overflow-hidden">
            <div className="flex items-center justify-between px-8 py-4 border-b border-border">
                <div className="text-sm text-text-secondary truncate">
                    {currentModule?.title ?? "Lesson"}
                </div>
                <button
                    onClick={endSession}
                    className="h-9 px-3 text-sm border border-border hover:bg-surface transition-colors cursor-pointer"
                >
                    End session
                </button>
            </div>
            <div className="flex-1 overflow-auto px-8 py-10">
                {currentLesson ? (
                    <div className="max-w-3xl mx-auto">
                        <span className="label-caps text-coral mb-3 inline-block">
                            Lesson
                        </span>
                        <h1 className="text-3xl font-bold tracking-tight mb-6">
                            {currentLesson.title}
                        </h1>
                        {embeddedVideoUrl ? (
                            <div className="mb-6 overflow-hidden rounded-3xl border border-border bg-black/5">
                                <div className="relative aspect-video w-full">
                                    <iframe
                                        src={embeddedVideoUrl}
                                        title="Course video"
                                        frameBorder="0"
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                        allowFullScreen
                                        className="absolute inset-0 h-full w-full"
                                    />
                                </div>
                            </div>
                        ) : null}
                        <div className="prose prose-sm max-w-none text-text-primary leading-relaxed">
                            {currentLesson.content ? (
                                <ReactMarkdown>
                                    {currentLesson.content}
                                </ReactMarkdown>
                            ) : (
                                <div className="text-center py-12">
                                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                                        <MessageSquare size={28} className="text-primary" />
                                    </div>
                                    <h3 className="text-lg font-semibold text-text-primary mb-2">Start learning with your AI tutor</h3>
                                    <p className="text-text-secondary text-sm max-w-md mx-auto mb-6">
                                        Ask the AI tutor on the right to explain this topic, quiz you, or break things down step by step.
                                    </p>
                                    <div className="flex flex-wrap gap-2 justify-center">
                                        {["Explain this topic", "Give me an example", "Quiz me on this"].map((suggestion) => (
                                            <button
                                                key={suggestion}
                                                onClick={() => {
                                                    setInput(suggestion);
                                                    setMobileTab("tutor");
                                                }}
                                                className="px-4 py-2 bg-surface border border-border rounded-full text-xs font-medium hover:border-primary hover:text-primary transition-colors"
                                            >
                                                {suggestion}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                        
                        {knowledgeChecks.length > 0 && (
                            <div className="mt-12 pt-8 border-t border-border">
                                <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                                    <Zap size={20} className="text-primary" />
                                    Knowledge Check
                                </h3>
                                <div className="space-y-8">
                                    {knowledgeChecks.map(kc => {
                                        const selected = kcAnswers[kc.id];
                                        const isCorrect = selected === kc.correctAnswer;
                                        return (
                                            <div key={kc.id} className="bg-surface-card p-6 border border-border rounded-lg shadow-sm">
                                                <p className="font-semibold mb-4">{kc.question}</p>
                                                <div className="space-y-2">
                                                    {kc.options.map(opt => {
                                                        const isSel = selected === opt;
                                                        const isOptCorrect = opt === kc.correctAnswer;
                                                        let btnClass = "border-border hover:border-primary/40";
                                                        if (isSel) {
                                                            btnClass = isOptCorrect 
                                                                ? "border-success bg-success/10 text-success-foreground" 
                                                                : "border-destructive bg-destructive/10 text-destructive-foreground";
                                                        }
                                                        return (
                                                            <button
                                                                key={opt}
                                                                onClick={() => handleKcSelect(kc, opt)}
                                                                className={`w-full text-left px-4 py-3 border-2 rounded transition-colors ${btnClass}`}
                                                            >
                                                                {opt}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="max-w-3xl mx-auto">
                        <h1 className="text-3xl font-bold mb-4">
                            Welcome to your learning session
                        </h1>
                        <p className="text-text-secondary">
                            Select a lesson from the left to begin. Your AI tutor is ready on the right.
                        </p>
                    </div>
                )}
            </div>
            <div className="border-t border-border px-8 py-4 flex items-center justify-between bg-surface-card">
                <button
                    onClick={goPrev}
                    className="h-11 px-4 inline-flex items-center gap-2 border border-border text-sm font-medium hover:bg-surface transition-colors"
                >
                    <ChevronLeft size={16} /> Previous
                </button>
                <button
                    onClick={markComplete}
                    className="h-11 px-5 bg-coral text-white font-bold hover:opacity-90 transition-opacity"
                >
                    Mark complete
                </button>
                {!isLastLesson && (
                    <button
                        onClick={goNext}
                        disabled={knowledgeChecks.length > 0 && !kcPassed}
                        className="h-11 px-4 inline-flex items-center gap-2 bg-primary text-primary-foreground text-sm font-medium hover:bg-primary-hover transition-colors disabled:opacity-50"
                    >
                        Next <ChevronRight size={16} />
                    </button>
                )}
                {isLastLesson && (
                    <Link
                        to="/quiz/$courseId"
                        params={{ courseId: courseId ?? "" }}
                        search={{ level: "beginner", count: 5 }}
                        className="h-11 px-6 bg-coral text-white font-bold hover:opacity-90 transition-opacity flex items-center gap-2"
                    >
                        <Award size={18} /> Final Assessment
                    </Link>
                )}
            </div>
        </div>
    );

    const TutorPanel = (
        <div className="flex flex-col h-full min-h-0 bg-surface-card border-l border-border">
            <div className="flex-none px-5 py-4 border-b border-border flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold">
                        AI
                    </div>
                    <div>
                        <div className="font-semibold text-sm">EliteCoach AI</div>
                        <div className="text-xs text-text-secondary">
                            Always here to help
                        </div>
                    </div>
                </div>
                {!escalated && (
                    <button
                        onClick={triggerManualEscalation}
                        className="text-xs font-semibold text-coral border border-coral/30 px-2.5 py-1 rounded hover:bg-coral/5 transition-colors cursor-pointer"
                    >
                        Ask Human
                    </button>
                )}
            </div>

            <div
                ref={chatRef}
                className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4"
            >
                {messages.length === 0 && (
                    <div className="text-sm text-text-secondary bg-surface p-4 rounded-sm">
                        👋 Hey there! I'm your AI tutor. Ask me anything about
                        this lesson — I'll explain, quiz you, or break things
                        down step by step.
                    </div>
                )}
                {messages.map((m) => (
                    <div
                        key={m.id}
                        className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                        <div
                            className={`max-w-[85%] px-4 py-3 text-sm rounded-sm leading-relaxed ${
                                m.role === "user"
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-surface text-text-primary"
                            }`}
                        >
                            {m.role === "assistant" ? (
                                <div className="prose prose-sm max-w-none">
                                    <ReactMarkdown>{m.content}</ReactMarkdown>
                                </div>
                            ) : (
                                m.content
                            )}
                        </div>
                    </div>
                ))}
                {sending && (
                    <div className="flex justify-start">
                        <div className="bg-surface px-4 py-3 text-sm rounded-sm">
                            <span className="inline-flex gap-1">
                                <span className="w-1.5 h-1.5 bg-text-secondary rounded-full animate-bounce" />
                                <span
                                    className="w-1.5 h-1.5 bg-text-secondary rounded-full animate-bounce"
                                    style={{ animationDelay: "0.15s" }}
                                />
                                <span
                                    className="w-1.5 h-1.5 bg-text-secondary rounded-full animate-bounce"
                                    style={{ animationDelay: "0.3s" }}
                                />
                            </span>
                        </div>
                    </div>
                )}
            </div>

            {escalated ? (
                <div className="flex-none p-5 border-t border-border bg-coral/[0.03] text-center">
                    <div className="text-sm font-bold text-coral mb-1.5 flex items-center justify-center gap-1.5">
                        <Zap size={14} className="animate-pulse" /> Escalated to Human Tutor
                    </div>
                    <p className="text-xs text-text-secondary max-w-sm mx-auto leading-relaxed">
                        A professional tutor has been notified and will review this transcript. You will receive a notification via email or WhatsApp once a response is ready.
                    </p>
                </div>
            ) : (
                <div className="flex-none p-4 border-t border-border bg-surface-card">
                    <div className="flex gap-2">
                        <input
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) =>
                                e.key === "Enter" && !e.shiftKey && sendMessage()
                            }
                            placeholder="Ask your tutor..."
                            disabled={sending}
                            className="flex-1 h-11 px-3 border border-border focus:border-primary outline-none text-sm bg-white"
                        />
                        <button
                            onClick={sendMessage}
                            disabled={sending || !input.trim()}
                            className="h-11 w-11 bg-primary text-primary-foreground hover:bg-primary-hover transition-colors flex items-center justify-center disabled:opacity-50 cursor-pointer"
                        >
                            <Send size={16} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );

    return (
        <div className="h-screen w-full flex flex-col bg-surface overflow-hidden">
            {/* Desktop layout */}
            <div className="hidden md:grid flex-1 grid-cols-[260px_1fr_360px] overflow-hidden">
                <aside className="bg-navy text-navy-foreground overflow-hidden">
                    {SidebarTree}
                </aside>
                {LessonCenter}
                {TutorPanel}
            </div>

            {/* Mobile layout */}
            <div className="md:hidden flex flex-col flex-1 h-[calc(100vh-100px)] overflow-hidden">
                <div className="bg-navy text-navy-foreground px-4 py-3 flex items-center justify-between">
                    <Link to="/courses" className="text-sm">
                        ← Exit
                    </Link>
                    <div className="text-xs font-mono">{progress}%</div>
                </div>
                <div className="flex border-b border-border bg-surface-card">
                    <button
                        onClick={() => setMobileTab("lesson")}
                        className={`flex-1 h-12 inline-flex items-center justify-center gap-2 text-sm font-medium ${
                            mobileTab === "lesson"
                                ? "border-b-2 border-primary text-primary"
                                : "text-text-secondary"
                        }`}
                    >
                        <BookOpen size={16} /> Lesson
                    </button>
                    <button
                        onClick={() => setMobileTab("tutor")}
                        className={`flex-1 h-12 inline-flex items-center justify-center gap-2 text-sm font-medium ${
                            mobileTab === "tutor"
                                ? "border-b-2 border-primary text-primary"
                                : "text-text-secondary"
                        }`}
                    >
                        <MessageSquare size={16} /> Tutor
                    </button>
                </div>
                <div className="flex-1 overflow-hidden relative">
                    {mobileTab === "lesson" ? (
                        <div className="h-full overflow-auto">
                            {LessonCenter}
                        </div>
                    ) : (
                        <div className="h-full overflow-hidden flex flex-col">
                            {TutorPanel}
                        </div>
                    )}

                    {/* Mobile Assessment Floating Button */}
                    {isLastLesson && mobileTab === "lesson" && (
                        <div className="absolute bottom-6 right-4 z-50">
                            <Link
                                to="/quiz/$courseId"
                                params={{ courseId: courseId ?? "" }}
                                search={{ level: "beginner", count: 5 }}
                                className="h-14 px-6 bg-coral text-white font-bold rounded-full shadow-lg flex items-center justify-center gap-2 hover:scale-105 transition-transform"
                            >
                                <Award size={20} /> Take Assessment
                            </Link>
                        </div>
                    )}
                </div>
            </div>

            {/* Summary modal */}
            {showSummary && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
                    <div className="bg-surface-card w-full max-w-lg rounded-lg p-8 relative">
                        <button
                            onClick={closeSummary}
                            className="absolute top-4 right-4 text-text-secondary"
                            aria-label="Close"
                        >
                            <X size={20} />
                        </button>
                        <span className="label-caps text-coral mb-3 inline-block">
                            Session summary
                        </span>
                        <h2 className="text-2xl font-bold mb-4">
                            Great session!
                        </h2>
                        <div className="prose prose-sm max-w-none text-text-secondary mb-6 leading-relaxed">
                            <ReactMarkdown>{showSummary}</ReactMarkdown>
                        </div>
                        <button
                            onClick={closeSummary}
                            className="w-full h-12 bg-primary text-primary-foreground font-medium hover:bg-primary-hover transition-colors"
                        >
                            Back to dashboard
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
