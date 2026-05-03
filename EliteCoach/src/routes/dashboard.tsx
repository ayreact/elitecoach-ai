import { createFileRoute, Link } from "@tanstack/react-router";
import { requireLearner } from "@/lib/auth-guard";
import { useEffect, useState } from "react";
import { TopNav } from "@/components/TopNav";
import { Footer } from "@/components/Footer";
import { useAuthStore } from "@/lib/stores";
import {
    aiTutorApi,
    contentApi,
    normalizeCourses,
    unwrapApiData,
    unwrapApiList,
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
    course_id?: string;
    course_title?: string;
    duration_minutes?: number;
    topic?: string;
    status?: string;
    score?: number;
    created_at?: string;
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
            const sData = unwrapApiData<unknown>(s.data);
            const sessionList = Array.isArray(sData)
                ? sData
                : ((
                      sData as {
                          sessions?: unknown[];
                          items?: unknown[];
                          results?: unknown[];
                      } | null
                  )?.sessions ??
                  (
                      sData as {
                          sessions?: unknown[];
                          items?: unknown[];
                          results?: unknown[];
                      } | null
                  )?.items ??
                  (
                      sData as {
                          sessions?: unknown[];
                          items?: unknown[];
                          results?: unknown[];
                      } | null
                  )?.results ??
                  []);
            setSessions(sessionList.slice(0, 8) as SessionRow[]);

            const normalizedCourses = normalizeCourses(
                c.data
            ) as CourseCardData[];

            setCourses(normalizedCourses);

            setPath(unwrapApiData<typeof path>(p.data));
            setLoading(false);
        });
        return () => {
            alive = false;
        };
    }, [user]);

    const greeting = (() => {
        if (!now) return "Welcome back";
        const h = now.getHours();
        if (h < 12) return "Good morning";
        if (h < 18) return "Good afternoon";
        return "Good evening";
    })();

    const avgScore =
        sessions.filter((s) => typeof s.score === "number").length > 0
            ? Math.round(
                  sessions
                      .filter((s) => typeof s.score === "number")
                      .reduce((a, s) => a + (s.score ?? 0), 0) /
                      sessions.filter((s) => typeof s.score === "number").length
              )
            : 0;

    const thisWeek = mounted
        ? sessions.filter((s) => {
              if (!s.created_at) return false;
              const d = new Date(s.created_at).getTime();
              return Date.now() - d < 7 * 24 * 60 * 60 * 1000;
          }).length
        : 0;

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
                <div className="grid md:grid-cols-3 gap-6 mb-12">
                    {[
                        {
                            label: "Available courses",
                            value: courses.length,
                            accent: "bg-primary",
                        },
                        {
                            label: "Sessions this week",
                            value: thisWeek,
                            accent: "bg-coral",
                        },
                        {
                            label: "Avg quiz score",
                            value: `${avgScore}%`,
                            accent: "bg-success",
                        },
                    ].map((s, index) => (
                        <div
                            key={s.label}
                            className="card-base card-interactive reveal-card relative overflow-hidden"
                            style={{ animationDelay: `${index * 60}ms` }}
                        >
                            <div
                                className={`absolute top-0 left-0 h-1 w-full ${s.accent}`}
                            />
                            <div className="label-caps text-text-secondary mb-3">
                                {s.label}
                            </div>
                            <div className="text-4xl font-bold">{s.value}</div>
                        </div>
                    ))}
                </div>

                {/* MY COURSES */}
                <div className="mb-12">
                    <div className="flex items-end justify-between mb-6">
                        <h2 className="text-2xl font-semibold">My courses</h2>
                        <Link
                            to="/courses"
                            className="text-sm text-primary font-medium hover:underline"
                        >
                            Browse all →
                        </Link>
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
                    ) : courses.length === 0 ? (
                        <EmptyState
                            title="No courses yet"
                            description="Browse the catalog and enroll in your first course."
                            action={
                                <Link
                                    to="/courses"
                                    className="h-11 px-4 inline-flex items-center bg-primary text-white font-medium hover:bg-primary-hover transition-colors"
                                >
                                    Browse catalog
                                </Link>
                            }
                        />
                    ) : (
                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {courses.slice(0, 6).map((c, index) => (
                                <div
                                    key={c.id}
                                    className="reveal-card"
                                    style={{
                                        animationDelay: `${index * 70}ms`,
                                    }}
                                >
                                    <CourseCard course={c} />
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="grid lg:grid-cols-3 gap-6 mb-12">
                    {/* RECENT SESSIONS */}
                    <div className="lg:col-span-2 card-base card-interactive reveal-card p-0 overflow-hidden">
                        <div className="px-6 py-4 border-b border-border">
                            <h3 className="font-semibold">Recent sessions</h3>
                        </div>
                        {sessions.length === 0 ? (
                            <div className="p-8 text-center text-text-secondary text-sm">
                                No sessions yet — start learning to see your
                                activity here.
                            </div>
                        ) : (
                            <table className="w-full text-sm">
                                <thead className="bg-surface">
                                    <tr className="text-left">
                                        <th className="px-6 py-3 label-caps text-text-secondary">
                                            Date
                                        </th>
                                        <th className="px-6 py-3 label-caps text-text-secondary">
                                            Topic
                                        </th>
                                        <th className="px-6 py-3 label-caps text-text-secondary">
                                            Status
                                        </th>
                                        <th className="px-6 py-3 label-caps text-text-secondary">
                                            Action
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sessions.map((s) => (
                                        <tr
                                            key={s.id || s.session_id}
                                            className="border-t border-border"
                                        >
                                            <td className="px-6 py-4 text-text-secondary">
                                                {s.created_at
                                                    ? new Date(
                                                          s.created_at
                                                      ).toLocaleDateString()
                                                    : "—"}
                                            </td>
                                            <td className="px-6 py-4">
                                                {s.topic ??
                                                    s.course_title ??
                                                    "Session"}
                                            </td>
                                            <td className="px-6 py-4 font-mono capitalize">
                                                {s.status ?? "ended"}
                                            </td>
                                            <td className="px-6 py-4 font-mono">
                                                <Link
                                                    to="/learn/$sessionId"
                                                    params={{
                                                        sessionId: String(
                                                            s.id || s.session_id
                                                        ),
                                                    }}
                                                    className="text-primary hover:underline text-xs font-semibold"
                                                >
                                                    Resume
                                                </Link>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>

                    {/* LEARNING PATH WIDGET */}
                    <div className="card-base card-interactive reveal-card bg-navy text-white border-navy">
                        <div className="flex items-center gap-2 mb-3">
                            <Sparkles size={16} className="text-coral" />
                            <span className="label-caps text-coral">
                                Learning Path
                            </span>
                        </div>
                        <h3 className="text-xl font-semibold mb-2">
                            {path?.goal ?? "Set your career goal"}
                        </h3>
                        <p className="text-white/70 text-sm leading-relaxed mb-4">
                            {path?.next_course
                                ? `Next up: ${path.next_course}`
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
