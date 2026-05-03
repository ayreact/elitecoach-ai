import { createFileRoute, Link } from "@tanstack/react-router";
import { requireLearner } from "@/lib/auth-guard";
import { useEffect, useMemo, useState } from "react";
import { TopNav } from "@/components/TopNav";
import { Footer } from "@/components/Footer";
import { useAuthStore } from "@/lib/stores";
import {
    aiTutorApi,
    contentApi,
    normalizeCourses,
    unwrapApiData,
} from "@/lib/api-client";
import { CourseCard, CourseCardData } from "@/components/CourseCard";
import { EmptyState } from "@/components/EmptyState";
import { ArrowRight, Sparkles } from "lucide-react";

export const Route = createFileRoute("/dashboard")({
    beforeLoad: () => { requireLearner(); },
    head: () => ({ meta: [{ title: "Dashboard — EliteCoach" }] }),
    component: DashboardPage,
});

interface SessionRow {
    id: string;
    session_id?: string;
    course_id?: string | number;
    course_title?: string;
    duration_minutes?: number;
    topic?: string;
    status?: string;
    score?: number | string;
    created_at?: string;
}

function isActiveSession(session: SessionRow) {
    const status = session.status?.trim().toLowerCase();
    if (!status) return true;
    return ![
        "ended",
        "completed",
        "finished",
        "closed",
        "cancelled",
        "archived",
    ].includes(status);
}

function extractSessionScore(session: SessionRow): number | null {
    if (typeof session.score === "number") return session.score;
    if (typeof session.score === "string") {
        const parsed = Number(session.score);
        return Number.isFinite(parsed) ? parsed : null;
    }
    // Check common fallback fields
    const fallback = (session as any).grade ?? (session as any).percentage ?? (session as any).score_percent ?? null;
    if (typeof fallback === "number") return fallback;
    if (typeof fallback === "string") {
        const parsed = Number(fallback);
        return Number.isFinite(parsed) ? parsed : null;
    }

    // Additional nested fallbacks (results array, assessment object, metrics, etc.)
    try {
        const s = session as any;
        const candidates = [
            s?.results?.[0]?.score,
            s?.results?.[0]?.percentage,
            s?.results?.[0]?.grade,
            s?.assessment?.score,
            s?.assessment?.grade,
            s?.metrics?.score,
            s?.outcome?.score,
            s?.data?.score,
        ];

        for (const cand of candidates) {
            if (typeof cand === "number") return cand;
            if (typeof cand === "string") {
                const parsed = Number(cand);
                if (Number.isFinite(parsed)) return parsed;
            }
        }
    } catch (err) {
        // ignore introspection errors
    }

    // No score found
    try {
        console.debug("No score found for session:", { id: session.id, status: session.status, topic: session.topic });
    } catch (err) {
        // ignore
    }
    return null;
}

function DashboardPage() {
    const user = useAuthStore((s) => s.user);
    const [sessions, setSessions] = useState<SessionRow[]>([]);
    const [courses, setCourses] = useState<CourseCardData[]>([]);
    const [path, setPath] = useState<{
        goal?: string;
        next_course?: string;
    } | null>(null);
    const [loading, setLoading] = useState(true);
    const [mounted, setMounted] = useState(false);
    const [now, setNow] = useState<Date | null>(null);
    const [showAllCourses, setShowAllCourses] = useState(false);
    const [sessionTab, setSessionTab] = useState<"all" | "active" | "ended">("all");

    useEffect(() => {
        setMounted(true);
        setNow(new Date());
    }, []);

    useEffect(() => {
        let alive = true;

        Promise.all([
            aiTutorApi
                .get("/api/v1/learning/sessions")
                .catch(() => ({ data: { sessions: [] } })),
            contentApi.get("/courses/").catch(() => ({ data: [] })),
            user?.id || user?.userId
                ? aiTutorApi
                      .get(`/api/v1/learning/paths/${user.id ?? user.userId}`)
                      .catch(() => ({ data: null }))
                : Promise.resolve({ data: null }),
        ]).then(([s, c, p]) => {
            if (!alive) return;

            // Log raw and unwrapped session responses for debugging
            try {
                console.log("Learning sessions raw response:", s.data);
            } catch (err) {
                // ignore console errors in environments where console might be disabled
            }

            const sData = unwrapApiData<unknown>(s.data);
            try {
                console.log("Learning sessions unwrapped:", sData);
            } catch (err) {
                // ignore
            }
            const sessionList = Array.isArray(sData)
                ? sData
                : ((sData as {
                      sessions?: unknown[];
                      items?: unknown[];
                      results?: unknown[];
                  } | null)?.sessions ??
                      (sData as {
                          sessions?: unknown[];
                          items?: unknown[];
                          results?: unknown[];
                      } | null)?.items ??
                      (sData as {
                          sessions?: unknown[];
                          items?: unknown[];
                          results?: unknown[];
                      } | null)?.results ??
                      []);

            const orderedSessions = [...sessionList]
                .sort((a, b) => {
                    const aDate = a.created_at
                        ? new Date(a.created_at).getTime()
                        : 0;
                    const bDate = b.created_at
                        ? new Date(b.created_at).getTime()
                        : 0;
                    return bDate - aDate;
                })
                .slice(0, 8) as SessionRow[];

            setSessions(orderedSessions);

            const normalizedCourses = normalizeCourses(c.data) as CourseCardData[];
            setCourses(normalizedCourses);
            setPath(unwrapApiData<typeof path>(p.data));
            setLoading(false);
        });

        return () => {
            alive = false;
        };
    }, [user]);

    const coursesById = useMemo(
        () => Object.fromEntries(courses.map((course) => [course.id, course])),
        [courses]
    );

    const activeCourseEntries = useMemo(() => {
        const entryMap = new Map();

        sessions.forEach((session) => {
            if (!isActiveSession(session)) return;
            
            let rawCourseId = session.course_id ?? (session as any).courseId;
            
            if (!rawCourseId && session.topic) {
                const matchedCourse = courses.find(c => c.title === session.topic);
                if (matchedCourse) {
                    rawCourseId = matchedCourse.id;
                }
            }

            const courseId = String(rawCourseId ?? "");
            
            if (!courseId) return; 

            const lastAccessed = session.created_at
                ? new Date(session.created_at).getTime()
                : 0;
                
            const existing = entryMap.get(courseId);
            if (!existing || lastAccessed > existing.lastAccessed) {
                entryMap.set(courseId, {
                    courseId,
                    course: coursesById[courseId] ?? null,
                    session,
                    lastAccessed,
                });
            }
        });

        return Array.from(entryMap.values()).sort(
            (a, b) => b.lastAccessed - a.lastAccessed
        );
    }, [coursesById, courses, sessions]);

    const activeCourses = showAllCourses
        ? activeCourseEntries
        : activeCourseEntries.slice(0, 3);

    const visibleCourseCount = activeCourseEntries.length;

    const scoredSessions = sessions
        .map((s) => {
            return extractSessionScore(s);
        })
        .filter((score): score is number => score !== null && !Number.isNaN(score));

    const avgScore =
        scoredSessions.length > 0
            ? Math.round(
                  scoredSessions.reduce((sum, score) => sum + score, 0) /
                      scoredSessions.length
              )
            : null;

    const thisWeek = mounted
        ? sessions.filter((s) => {
              if (!s.created_at) return false;
              const d = new Date(s.created_at).getTime();
              return Date.now() - d < 7 * 24 * 60 * 60 * 1000;
          }).length
        : 0;

    const greeting = (() => {
        if (!now) return "Welcome back";
        const h = now.getHours();
        if (h < 12) return "Good morning";
        if (h < 18) return "Good afternoon";
        return "Good evening";
    })();

    return (
        <div className="min-h-screen flex flex-col bg-surface">
            <TopNav />
            <div className="container-1200 py-12 flex-1">
                <div className="mb-12">
                    <span className="label-caps text-coral mb-2 inline-block">
                        Dashboard
                    </span>
                    <h1 className="text-4xl font-bold tracking-tight">
                        {greeting}
                        {user?.firstName ? `, ${user.firstName}` : ""}
                    </h1>
                    <p className="text-text-secondary mt-2">
                        {now
                            ? now.toLocaleDateString("en-US", {
                                  weekday: "long",
                                  month: "long",
                                  day: "numeric",
                              })
                            : "\u00A0"}
                    </p>
                </div>

                {/* STATS */}
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
                    {(() => {
                        const activeSessionsCount = sessions.filter(isActiveSession).length;

                        const items: { label: string; value: any; accent: string }[] = [
                            { label: "Active sessions", value: activeSessionsCount, accent: "bg-navy" },
                            { label: "Sessions this week", value: thisWeek, accent: "bg-coral" },
                            { label: "Available courses", value: courses.length, accent: "bg-primary" },
                        ];

                        return items.map((item, index) => (
                            <div
                                key={item.label}
                                className="card-base card-interactive reveal-card relative overflow-hidden"
                                style={{ animationDelay: `${index * 60}ms` }}
                            >
                                <div className={`absolute top-0 left-0 h-1 w-full ${item.accent}`} />
                                <div className="label-caps text-text-secondary mb-3">{item.label}</div>
                                <div className="text-4xl font-bold">{item.value}</div>
                            </div>
                        ));
                    })()}
                </div>

                {/* MY COURSES */}
                <div className="mb-12">
                    <div className="flex items-end justify-between mb-6 gap-4">
                        <div>
                            <h2 className="text-2xl font-semibold">My courses</h2>
                            <p className="text-sm text-text-secondary mt-1">
                                Courses you are currently learning, ordered by recency.
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            {visibleCourseCount > 3 ? (
                                <button
                                    type="button"
                                    onClick={() => setShowAllCourses(!showAllCourses)}
                                    className="text-sm text-primary font-medium hover:underline"
                                >
                                    {showAllCourses
                                        ? "Show fewer"
                                        : `Show all ${visibleCourseCount}`}
                                </button>
                            ) : null}
                            <Link
                                to="/courses"
                                className="text-sm text-primary font-medium hover:underline"
                            >
                                Browse all →
                            </Link>
                        </div>
                    </div>

                    {loading ? (
                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {[...Array(3)].map((_, i) => (
                                <div
                                    key={i}
                                    className="card-base h-64 animate-pulse"
                                />
                            ))}
                        </div>
                    ) : activeCourseEntries.length === 0 ? (
                        <EmptyState
                            title="No active courses"
                            description="Enroll in a course or continue an existing session to see active learning here."
                            action={
                                <Link
                                    to="/courses"
                                    className="h-11 px-4 inline-flex items-center bg-primary text-white font-medium hover:bg-primary-hover transition-colors"
                                >
                                    Browse courses
                                </Link>
                            }
                        />
                    ) : (
                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {activeCourses.map((entry, index) => (
                                <div
                                    key={entry.courseId}
                                    className="reveal-card"
                                    style={{ animationDelay: `${index * 70}ms` }}
                                >
                                    {entry.course ? (
                                        <CourseCard course={entry.course} />
                                    ) : (
                                        <div className="card-base p-6 border border-border rounded-lg">
                                            <div className="text-sm text-text-secondary mb-2">
                                                Active course
                                            </div>
                                            <div className="text-lg font-semibold mb-3">
                                                {entry.session?.course_title ?? "Untitled course"}
                                            </div>
                                            <div className="text-xs text-text-secondary">
                                                Last active: {entry.lastAccessed ? new Date(entry.lastAccessed).toLocaleDateString() : "Unknown"}
                                            </div>
                                            <Link
                                                to="/courses"
                                                className="mt-6 inline-flex items-center text-sm text-primary font-medium hover:underline"
                                            >
                                                View course
                                            </Link>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="grid lg:grid-cols-3 gap-6 mb-12">
                    {/* RECENT SESSIONS */}
                    <div className="lg:col-span-2 card-base card-interactive reveal-card p-0 overflow-hidden flex flex-col">
                        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
                            <h3 className="font-semibold">Recent sessions</h3>
                            
                            {/* Tab Controls */}
                            <div className="flex bg-surface-card rounded-md p-1 border border-border">
                                {(["all", "active", "ended"] as const).map((tab) => (
                                    <button
                                        key={tab}
                                        onClick={() => setSessionTab(tab)}
                                        className={`px-3 py-1 text-xs font-medium rounded-sm capitalize transition-colors cursor-pointer ${
                                            sessionTab === tab
                                                ? "bg-surface shadow-sm text-primary"
                                                : "text-text-secondary hover:text-foreground"
                                        }`}
                                    >
                                        {tab}
                                    </button>
                                ))}
                            </div>
                        </div>
                        
                        {(() => {
                            const filteredSessions = sessions.filter((session) => {
                                if (sessionTab === "all") return true;
                                const isActive = isActiveSession(session);
                                return sessionTab === "active" ? isActive : !isActive;
                            });

                            if (filteredSessions.length === 0) {
                                const emptyMessage = 
                                    sessionTab === "active" ? "You have no active sessions right now." :
                                    sessionTab === "ended" ? "You haven't completed any sessions yet." :
                                    "No sessions yet — start learning to see your activity here.";
                                    
                                return (
                                    <div className="p-8 text-center text-text-secondary text-sm flex-1 flex items-center justify-center min-h-[200px]">
                                        {emptyMessage}
                                    </div>
                                );
                            }

                            return (
                                <table className="w-full text-sm">
                                    <thead className="bg-surface">
                                        <tr className="text-left">
                                            <th className="px-6 py-3 label-caps text-text-secondary">Date</th>
                                            <th className="px-6 py-3 label-caps text-text-secondary">Topic</th>
                                            <th className="px-6 py-3 label-caps text-text-secondary">Status</th>
                                            <th className="px-6 py-3 label-caps text-text-secondary">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredSessions.slice(0, 3).map((session) => (
                                            <tr
                                                key={session.id || session.session_id}
                                                className="border-t border-border"
                                            >
                                                <td className="px-6 py-4 text-text-secondary">
                                                    {session.created_at
                                                        ? new Date(session.created_at).toLocaleDateString()
                                                        : "—"}
                                                </td>
                                                <td className="px-6 py-4">
                                                    {session.topic ?? session.course_title ?? "Session"}
                                                </td>
                                                <td className="px-6 py-4 font-mono capitalize">
                                                    {session.status ?? "ended"}
                                                </td>
                                                <td className="px-6 py-4 font-mono">
                                                    <Link
                                                        to="/learn/$sessionId"
                                                        params={{
                                                            sessionId: String(
                                                                session.id || session.session_id
                                                            ),
                                                        }}
                                                        className="text-primary hover:underline text-xs font-semibold"
                                                    >
                                                        {isActiveSession(session) ? "Resume" : "Review"}
                                                    </Link>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            );
                        })()}
                    </div>

                    {/* LEARNING PATH WIDGET */}
                        <div className="card-base card-interactive reveal-card bg-navy text-white border-navy">
                            <div className="flex items-center gap-2 mb-3">
                                <Sparkles size={16} className="text-coral" />
                                <span className="label-caps text-coral">
                                    Learning Path
                                </span>
                            </div>
                            
                            {/* 1. Changed path?.goal to path?.target_role */}
                            <h3 className="text-black/70 text-xl font-semibold mb-2 capitalize">
                                {path?.target_role ?? "Set your career goal"}
                            </h3>
                            
                            {/* 2. Changed path?.next_course to look inside the next_courses array */}
                            <p className="text-black/70 text-sm leading-relaxed mb-4">
                                {(path as any)?.next_courses?.[0]?.title
                                    ? `Next up: ${(path as any).next_courses[0].title}`
                                    : "Generate a personalised learning path to reach your next role."}
                            </p>
                            
                            <Link
                                to="/learning-path"
                                className="inline-flex items-center gap-2 text-coral font-medium text-sm hover:underline"
                            >
                                View path <ArrowRight size={14} />
                            </Link>
                        </div>
                </div>
            </div>
            <Footer />
        </div>
    );
}
