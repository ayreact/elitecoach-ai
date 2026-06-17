import { createFileRoute, Link, useNavigate, redirect } from "@tanstack/react-router";
import { requireLearner } from "@/lib/auth-guard";
import { useEffect, useState } from "react";
import {
    acsApi,
    assessmentsApi,
    buildNotificationPayload,
    coerceIntegerId,
    contentApi,
    extractErrorMessage,
    normalizeCourse,
    notificationsApi,
    unwrapApiData,
    unwrapApiList,
    downloadCertificate,
    getLinkedInShareUrl,
} from "@/lib/api-client";
import { TopNav } from "@/components/TopNav";
import { useAuthStore } from "@/lib/stores";
import { toast } from "sonner";
import { Check, X } from "lucide-react";

interface Question {
    id: string;
    question: string;
    options: string[];
    correct_answer?: string;
}

function parseQuestions(payload: unknown): Question[] {
    const data = unwrapApiData<unknown>(payload);
    const parsed =
        typeof data === "string"
            ? (() => {
                  try {
                      return JSON.parse(data) as unknown;
                  } catch {
                      return null;
                  }
              })()
            : data;

    const candidates = Array.isArray(parsed)
        ? parsed
        : ((parsed as { questions?: unknown[]; items?: unknown[] } | null)
              ?.questions ??
          (parsed as { questions?: unknown[]; items?: unknown[] } | null)
              ?.items ??
          []);

    return candidates
        .map<Question | null>((item, index) => {
            if (!item || typeof item !== "object") return null;
            const value = item as Record<string, unknown>;
            const prompt =
                typeof value.question_text === "string"
                    ? value.question_text
                    : typeof value.question === "string"
                    ? value.question
                    : typeof value.prompt === "string"
                      ? value.prompt
                      : "";
            const options = Array.isArray(value.options)
                ? value.options.filter(
                      (option): option is string => typeof option === "string"
                  )
                : value.options && typeof value.options === "object" 
                    ? Object.values(value.options).filter((option): option is string => typeof option === "string")
                : [];

            if (!prompt) return null;

            return {
                id:
                    value.id != null
                        ? String(value.id)
                        : value.question_id != null
                          ? String(value.question_id)
                          : `generated-${index + 1}`,
                question: prompt,
                options,
                correct_answer:
                    typeof value.correct_answer === "string"
                        ? value.correct_answer
                        : undefined,
            };
        })
        .filter((question): question is Question => question !== null);
}

export const Route = createFileRoute("/quiz/$courseId")({
    beforeLoad: async () => { 
        try {
            await requireLearner(); 
        } catch (err) {
            console.error("Auth guard failed:", err);
            throw redirect({
                to: "/login",
            });
        }
    },
    head: () => ({ meta: [{ title: "Quiz — EliteCoach" }] }),
    validateSearch: (search: Record<string, unknown>) => ({
        level: (search.level as string) ?? "beginner",
        count: typeof search.count === "number" ? search.count : 5,
    }),
    component: QuizPage,
});

function QuizPage() {
    const { courseId } = Route.useParams();
    const { level: searchLevel, count: searchCount } = Route.useSearch();
    const navigate = useNavigate();
    const user = useAuthStore((s) => s.user);
    const [questions, setQuestions] = useState<Question[]>([]);
    const [idx, setIdx] = useState(0);
    const [answers, setAnswers] = useState<Record<string, string>>({});
    const [submitting, setSubmitting] = useState(false);
    const [attemptId, setAttemptId] = useState<string | null>(null);
    const [timeLeft, setTimeLeft] = useState<number | null>(null);
    const [result, setResult] = useState<{
        score: number;
        total: number;
        passed?: boolean;
        reinforcementLessons?: string[] | null;
    } | null>(null);
    const [showConfig, setShowConfig] = useState(true);
    const [configLevel, setConfigLevel] = useState(searchLevel || "beginner");
    const [configCount, setConfigCount] = useState(searchCount || 5);
    
    const [startFetch, setStartFetch] = useState(false);
    const [loading, setLoading] = useState(false); 
    
    const [generatingCert, setGeneratingCert] = useState(false);
    const [certificate, setCertificate] = useState<{
        id: string;
        verification_code: string;
        pdf_url: string;
        linkedin_share_url?: string;
    } | null>(null);
    const [lessonTitles, setLessonTitles] = useState<Record<string, string>>({});

    useEffect(() => {
        if (!startFetch) return;

        setLoading(true);

        let alive = true;
        const numericCourseId = coerceIntegerId(courseId);

        if (numericCourseId == null) {
            setQuestions([
                {
                    id: "demo-1",
                    question: "What's the primary benefit of an AI tutor?",
                    options: [
                        "It replaces all human teachers",
                        "It adapts explanations to your pace",
                        "It only works for math",
                        "It removes the need to study",
                    ],
                    correct_answer: "It adapts explanations to your pace",
                },
            ]);
            setLoading(false);
            return () => {
                alive = false;
            };
        }

        contentApi
            .get(`/api/v1/learning/course/${numericCourseId}`)
            .then((curriculumRes) => {
                if (!alive) return;
                const curriculumData = curriculumRes.data
                    ? unwrapApiData<any>(curriculumRes.data)
                    : null;
                
                if (curriculumData) {
                    const rawMods = Array.isArray(curriculumData)
                        ? curriculumData
                        : (curriculumData.modules ?? []);
                    const titlesMap: Record<string, string> = {};
                    rawMods.forEach((m: any) => {
                        const lessonsList = m.lessons ?? m.content_chunks ?? [];
                        lessonsList.forEach((l: any) => {
                            if (l.id) {
                                titlesMap[String(l.id)] = l.title || `Lesson ${l.id}`;
                            }
                        });
                    });
                    setLessonTitles(titlesMap);
                }

                const matchedCourse = curriculumData
                    ? normalizeCourse(curriculumData)
                    : null;

                const topic = matchedCourse?.title ?? "Course assessment";

                return assessmentsApi.get(
                    `/api/v1/assessments/course/${numericCourseId}/final`
                );
            })
            .then((quizRes) => {
                if (!alive || !quizRes) return;
                const payload = unwrapApiData<any>(quizRes.data);
                if (payload?.attempt_id) setAttemptId(payload.attempt_id);
                else if (payload?.id) setAttemptId(payload.id);
                
                const data = parseQuestions(quizRes.data);
                if (data.length === 0) {
                    setQuestions([
                        {
                            id: "demo-1",
                            question:
                                "What's the primary benefit of an AI tutor?",
                            options: [
                                "It replaces all human teachers",
                                "It adapts explanations to your pace",
                                "It only works for math",
                                "It removes the need to study",
                            ],
                            correct_answer:
                                "It adapts explanations to your pace",
                        },
                    ]);
                    setTimeLeft(120);
                } else {
                    setQuestions(data);
                    setTimeLeft(data.length * 120);
                }
            })
            .catch((err) => {
                if (!alive) return;
                console.error("Error fetching quiz data:", err);
                setQuestions([
                    {
                        id: "demo-1",
                        question: "What's the primary benefit of an AI tutor?",
                        options: [
                            "It replaces all human teachers",
                            "It adapts explanations to your pace",
                            "It only works for math",
                            "It removes the need to study",
                        ],
                        correct_answer: "It adapts explanations to your pace",
                    },
                ]);
            })
            .finally(() => {
                if (alive) setLoading(false);
            });
        return () => {
            alive = false;
        };
    }, [courseId, configLevel, configCount, startFetch]);

    useEffect(() => {
        if (timeLeft === null || result || showConfig || loading || submitting) return;
        if (timeLeft <= 0) {
            submit();
            return;
        }
        const timerId = setInterval(() => setTimeLeft(t => (t !== null && t > 0 ? t - 1 : 0)), 1000);
        return () => clearInterval(timerId);
    }, [timeLeft, result, showConfig, loading, submitting]);

    const submit = async () => {
        setSubmitting(true);
        try {
            const numericCourseId = coerceIntegerId(courseId);
            if (numericCourseId == null) {
                throw new Error("This quiz requires a numeric course ID.");
            }

            if (!attemptId) {
                throw new Error("Missing attempt ID for final exam.");
            }

            const res = await assessmentsApi.post(`/api/v1/assessments/attempt/${attemptId}/submit`, {
                answers: questions.map((q) => ({
                    question_id: q.id,
                    answer: answers[q.id] || "",
                }))
            });
            const payload = unwrapApiData<any>(res.data);
            const result = typeof payload === "object" ? payload : {};
            const score = Number((result as any).score ?? 0);
            const passed = Boolean((result as any).is_passed ?? (result as any).passed ?? score >= 70);
            const reinforcementLessons = (result as any).reinforcement_lessons;

            setResult({
                score,
                total: questions.length,
                passed,
                reinforcementLessons,
            });
        } catch (err) {
            toast.error(
                extractErrorMessage(err, "Could not submit assessment")
            );
        } finally {
            setSubmitting(false);
        }
    };

    const generateCertificate = async () => {
        if (!user?.id && !user?.email) {
            toast.error("User ID not found");
            return;
        }
        if (!result?.passed) {
            toast.error("You must pass the quiz to generate a certificate");
            return;
        }

        setGeneratingCert(true);
        try {
            const numericCourseId = coerceIntegerId(courseId);
            if (numericCourseId == null) {
                throw new Error("Invalid course ID");
            }

            const userId = user.id || user.email || "unknown";
            const res = await acsApi.get(
                `/api/v1/certificates/me`
            );

            const certList = unwrapApiList<any>(res.data);
            const certData = certList.find((c) => String(c.course_id) === String(numericCourseId) || c.course_title?.includes("Final")) || certList[0];

            if (!certData) {
                throw new Error("Certificate not found for this course.");
            }

            setCertificate({
                id: certData.id,
                verification_code: certData.verification_code || certData.id,
                pdf_url: certData.pdf_url,
                linkedin_share_url: certData.linkedin_share_url,
            });

            toast.success("Certificate fetched successfully!");

            if (certData.pdf_url) {
                window.open(certData.pdf_url, "_blank");
            }
        } catch (err: any) {
            console.error("Certificate generation error:", err);
            if (err.response?.status === 502) {
                toast.error("Certificate service is temporarily unavailable. Please try again in a moment.");
            } else if (err.response?.status === 401) {
                toast.error("Your session has expired. Please log in again.");
            } else if (err.response?.status === 400) {
                toast.error("Invalid request. Please ensure the course is valid.");
            } else {
                toast.error(extractErrorMessage(err, "Could not generate certificate"));
            }
        } finally {
            setGeneratingCert(false);
        }
    };

    const forceDownload = async (e: React.MouseEvent<HTMLButtonElement>) => {
        e.preventDefault();
        if (!certificate?.id) return;
        
        try {
            const downloadUrl = await downloadCertificate(certificate.id);
            if (downloadUrl) {
                const link = document.createElement("a");
                link.href = downloadUrl;
                link.download = `EliteCoach_Certificate_${certificate.verification_code || "EC"}.pdf`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            } else {
                // Fallback
                if (certificate.pdf_url) window.open(certificate.pdf_url, "_blank");
            }
        } catch (err) {
            console.error("Failed to fetch signed download url", err);
            if (certificate.pdf_url) window.open(certificate.pdf_url, "_blank");
        }
    };

    const shareLinkedIn = async (e: React.MouseEvent<HTMLButtonElement>) => {
        e.preventDefault();
        if (!certificate?.id) return;
        try {
            const shareUrl = await getLinkedInShareUrl(certificate.id);
            if (shareUrl) {
                window.open(shareUrl, "_blank", "noopener,noreferrer");
            } else {
                if (certificate.linkedin_share_url) window.open(certificate.linkedin_share_url, "_blank");
            }
        } catch (err) {
            console.error("Failed to fetch share url", err);
            if (certificate.linkedin_share_url) window.open(certificate.linkedin_share_url, "_blank");
        }
    };

    const current = questions[idx];
    const progress = questions.length === 0 ? 0 : Math.round(((idx + 1) / questions.length) * 100);
    const selected = current ? answers[current.id] : undefined;
    const isLast = idx === questions.length - 1;


    // ==========================================
    // UI RENDER SEQUENCE
    // ==========================================

    // 1. CONFIGURATION STATE
    if (showConfig) {
        return (
            <div className="min-h-screen bg-surface">
                <TopNav />
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => navigate({ to: "/courses" })} />
                    <div className="relative bg-white rounded-lg shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="bg-primary p-6 text-primary-foreground text-center">
                            <h3 className="text-xl font-bold mb-1">Assessment Settings</h3>
                            <p className="opacity-80 text-sm">Configure your quiz</p>
                        </div>
                        <div className="p-8 space-y-6">
                            <div className="space-y-3">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                                    Difficulty Level
                                </label>
                                <div className="grid grid-cols-3 gap-2">
                                    {["beginner", "intermediate", "advanced"].map((lvl) => (
                                        <button
                                            key={lvl}
                                            onClick={() => setConfigLevel(lvl)}
                                            className={`py-2 px-1 text-xs font-bold rounded border-2 transition-all capitalize ${
                                                configLevel === lvl
                                                    ? "border-primary bg-primary/10 text-primary"
                                                    : "border-slate-100 hover:border-slate-300 text-slate-500"
                                            }`}
                                        >
                                            {lvl}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-3">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                                    Number of Questions
                                </label>
                                <div className="grid grid-cols-4 gap-2">
                                    {[5, 10, 15, 20].map((num) => (
                                        <button
                                            key={num}
                                            onClick={() => setConfigCount(num)}
                                            className={`py-2 rounded border-2 font-bold text-sm transition-all ${
                                                configCount === num
                                                    ? "border-primary bg-primary/10 text-primary"
                                                    : "border-slate-100 hover:border-slate-300 text-slate-500"
                                            }`}
                                        >
                                            {num}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="pt-4 flex gap-3">
                                <button
                                    onClick={() => navigate({ to: "/courses" })}
                                    className="flex-1 py-3 text-slate-600 font-bold text-sm hover:bg-slate-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => {
                                        setShowConfig(false);
                                        setStartFetch(true);
                                    }}
                                    className="flex-[2] py-3 bg-primary text-primary-foreground font-bold text-sm rounded flex items-center justify-center shadow-lg hover:bg-primary-hover transition-all"
                                >
                                    Start Assessment
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // 2. LOADING STATE
    if (loading) {
        return (
            <div className="min-h-screen bg-surface">
                <TopNav />
                <div className="container-1200 py-20 flex flex-col items-center justify-center min-h-[60vh] text-center animate-in fade-in duration-500">
                    <div className="w-16 h-16 border-4 border-border border-t-primary rounded-full animate-spin mb-6" />
                    <h2 className="text-2xl font-bold tracking-tight mb-2">Generating your assessment...</h2>
                    <p className="text-text-secondary max-w-sm">
                        Our AI tutor is crafting {configCount} questions at the {configLevel} level. This usually takes just a few seconds.
                    </p>
                </div>
            </div>
        );
    }

    // 3. RESULT STATE
    if (result) {
        const ringPct = Math.min(100, Math.max(0, result.score));
        return (
            <div className="min-h-screen bg-surface">
                <TopNav />
                <div className="container-1200 py-16 max-w-2xl">
                    <div className="card-base text-center py-12">
                        <div className="relative w-40 h-40 mx-auto mb-6">
                            <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                                <circle cx="50" cy="50" r="44" stroke="var(--border)" strokeWidth="8" fill="none" />
                                <circle
                                    cx="50" cy="50" r="44" stroke="var(--coral)" strokeWidth="8" fill="none"
                                    strokeDasharray={`${(ringPct / 100) * 276.46} 276.46`}
                                    strokeLinecap="round"
                                />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-4xl font-bold">{ringPct}%</span>
                            </div>
                        </div>
                        <span className={`label-caps inline-block px-3 py-1 rounded-sm ${
                            result.passed ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
                        }`}>
                            {result.passed ? "Passed" : "Did not pass"}
                        </span>
                        <h1 className="text-3xl font-bold mt-4 mb-2">Quiz complete</h1>
                        <p className="text-text-secondary">
                            You answered {questions.length} question{questions.length === 1 ? "" : "s"}.
                        </p>
                    </div>

                    {result.reinforcementLessons && result.reinforcementLessons.length > 0 && (
                        <div className="card-base mt-6 bg-yellow-50 border-yellow-200 border">
                            <h3 className="font-semibold mb-4 text-yellow-800">Review Required</h3>
                            <p className="text-sm mb-4 text-yellow-700">
                                You need to review the following lessons before you can retake the quiz:
                            </p>
                            <ul className="list-disc pl-5 text-sm space-y-2 text-yellow-800">
                                {result.reinforcementLessons.map((lessonId) => (
                                    <li key={lessonId}>
                                        <Link 
                                            to="/learn/$sessionId" 
                                            params={{ sessionId: String(lessonId) }} 
                                            className="underline hover:text-yellow-600 font-semibold"
                                        >
                                            {lessonTitles[String(lessonId)] || `Lesson ${lessonId}`}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {certificate && (
                        <div className="bg-success/10 border border-success/30 rounded-lg p-6 mt-8">
                            <h3 className="font-semibold text-success mb-3">Certificate Generated!</h3>
                            <p className="text-sm text-text-secondary mb-4">
                                Verification Code: <code className="font-mono text-xs bg-surface-card px-2 py-1 rounded">{certificate.verification_code}</code>
                            </p>
                            <div className="flex gap-2 mt-4">
                                <button 
                                    onClick={forceDownload}
                                    className="flex-1 h-10 inline-flex items-center justify-center bg-success text-white font-medium rounded hover:opacity-90 transition-opacity text-sm cursor-pointer"
                                >
                                    Download PDF
                                </button>
                                <button 
                                    onClick={shareLinkedIn}
                                    className="flex-1 h-10 inline-flex items-center justify-center bg-blue-600 text-white font-medium rounded hover:opacity-90 transition-opacity text-sm cursor-pointer"
                                >
                                    Share on LinkedIn
                                </button>
                            </div>
                        </div>
                    )}

                    <div className={`flex gap-3 mt-${certificate ? 4 : 8}`}>
                        {result.passed && !certificate && (
                            <button
                                onClick={generateCertificate}
                                disabled={generatingCert}
                                className="flex-1 h-12 bg-success text-white font-medium rounded hover:opacity-90 transition-opacity disabled:opacity-50"
                            >
                                {generatingCert ? "Generating..." : "Generate Certificate"}
                            </button>
                        )}
                        <Link to="/dashboard" className="flex-1 h-12 inline-flex items-center justify-center bg-primary text-primary-foreground font-medium hover:bg-primary-hover transition-colors">
                            Back to dashboard
                        </Link>
                        <button
                            onClick={() => {
                                setResult(null);
                                setAnswers({});
                                setIdx(0);
                                setCertificate(null);
                            }}
                            disabled={!!(result.reinforcementLessons && result.reinforcementLessons.length > 0)}
                            className="flex-1 h-12 border border-border font-medium hover:bg-surface transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Retake quiz
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // 4. NO QUIZ AVAILABLE STATE
    if (!current) {
        return (
            <div className="min-h-screen bg-surface">
                <TopNav />
                <div className="container-1200 py-20 text-center">
                    <p className="text-text-secondary">No quiz available for this course yet.</p>
                </div>
            </div>
        );
    }

    // 5. ACTIVE QUIZ STATE
    return (
        <div className="min-h-screen bg-surface">
            <TopNav />
            <div className="container-1200 py-12 max-w-2xl">
                <div className="mb-10">
                    <div className="flex items-center justify-between text-sm mb-3">
                        <div className="flex items-center gap-4">
                            <span className="label-caps text-text-secondary">
                                Question {idx + 1} of {questions.length}
                            </span>
                            {timeLeft !== null && (
                                <span className={`font-mono font-medium ${timeLeft < 60 ? 'text-destructive animate-pulse' : 'text-text-primary'}`}>
                                    ⏱ {Math.floor(timeLeft / 60).toString().padStart(2, '0')}:{(timeLeft % 60).toString().padStart(2, '0')}
                                </span>
                            )}
                        </div>
                        <span className="font-mono text-text-secondary">{progress}%</span>
                    </div>
                    <div className="h-1 w-full bg-border rounded-sm overflow-hidden">
                        <div className="h-full bg-coral transition-all" style={{ width: `${progress}%` }} />
                    </div>
                </div>

                <h1 className="text-3xl font-bold tracking-tight leading-tight mb-8">
                    {current.question}
                </h1>

                <div className="space-y-3 mb-10">
                    {current.options.map((opt) => {
                        const isSel = selected === opt;
                        return (
                            <button
                                key={opt}
                                onClick={() => setAnswers((a) => ({ ...a, [current.id]: opt }))}
                                className={`w-full text-left p-5 border-2 transition-colors ${
                                    isSel
                                        ? "border-primary bg-primary/5"
                                        : "border-border bg-surface-card hover:border-primary/40"
                                }`}
                            >
                                <span className="font-medium">{opt}</span>
                            </button>
                        );
                    })}
                </div>

                <div className="flex justify-between gap-3">
                    <button
                        onClick={() => setIdx((i) => Math.max(0, i - 1))}
                        disabled={idx === 0}
                        className="h-12 px-5 border border-border font-medium hover:bg-surface transition-colors disabled:opacity-50"
                    >
                        ← Previous
                    </button>
                    {isLast ? (
                        <button
                            onClick={submit}
                            disabled={!selected || submitting}
                            className="h-12 px-6 bg-coral text-coral-foreground font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                        >
                            {submitting ? "Submitting..." : "Submit quiz"}
                        </button>
                    ) : (
                        <button
                            onClick={() => setIdx((i) => i + 1)}
                            disabled={!selected}
                            className="h-12 px-6 bg-primary text-primary-foreground font-medium hover:bg-primary-hover transition-colors disabled:opacity-50"
                        >
                            Next →
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}