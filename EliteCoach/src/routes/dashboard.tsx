import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
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
    acsApi,
} from "@/lib/api-client";
import { CourseCard, CourseCardData } from "@/components/CourseCard";
import { EmptyState } from "@/components/EmptyState";
import { ArrowRight, Sparkles, BookOpen, Award, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard")({
    beforeLoad: () => { requireLearner(); },
    head: () => ({ meta: [{ title: "Dashboard — EliteCoach" }] }),
    component: DashboardPage,
});

function DashboardPage() {
    const navigate = useNavigate();
    const user = useAuthStore((s) => s.user);
    const [courses, setCourses] = useState<CourseCardData[]>([]);
    const [attempts, setAttempts] = useState<any[]>([]);
    const [path, setPath] = useState<{
        goal?: string;
        target_role?: string;
        next_course?: string;
    } | null>(null);
    const [loading, setLoading] = useState(true);
    const [now, setNow] = useState<Date | null>(null);
    const [showAllCourses, setShowAllCourses] = useState(false);
    const [regenerating, setRegenerating] = useState(false);

    const handleRegeneratePath = async () => {
        setRegenerating(true);
        try {
            await aiTutorApi.post("/api/v1/onboarding/path/regenerate");
            toast.success("Learning path regenerated successfully!");
            const pRes = await aiTutorApi.get("/api/v1/onboarding/path");
            setPath(unwrapApiData<typeof path>(pRes.data));
        } catch (e) {
            toast.error("Failed to regenerate learning path.");
        } finally {
            setRegenerating(false);
        }
    };

    useEffect(() => {
        setNow(new Date());
    }, []);

    useEffect(() => {
        let alive = true;

        Promise.all([
            contentApi.get("/api/v1/courses/").catch(() => ({ data: [] })),
            acsApi.get("/api/v1/assessments/my-attempts").catch(() => ({ data: [] })),
            user?.id || user?.userId
                ? aiTutorApi
                      .get(`/api/v1/onboarding/path`)
                      .catch((e) => {
                          if (e.response?.status === 404) {
                              navigate({ to: "/onboarding" });
                          }
                          return { data: null };
                      })
                : Promise.resolve({ data: null }),
        ]).then(([c, a, p]) => {
            if (!alive) return;

            const normalizedCourses = normalizeCourses(c.data) as CourseCardData[];
            setCourses(normalizedCourses);
            
            const attData = unwrapApiData<unknown>(a.data);
            const attemptList = Array.isArray(attData) ? attData : [];
            setAttempts(attemptList);
            
            setPath(unwrapApiData<typeof path>(p.data));
            setLoading(false);
        });

        return () => {
            alive = false;
        };
    }, [user]);

    const activeCourses = showAllCourses
        ? courses
        : courses.slice(0, 3);

    const visibleCourseCount = courses.length;

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
                    {[
                        { label: "Available courses", value: courses.length, accent: "bg-navy" },
                        { label: "Assessments attempted", value: attempts.length, accent: "bg-coral" },
                        { label: "Target role", value: path?.target_role || "Not set", accent: "bg-primary" },
                    ].map((item, index) => (
                        <div
                            key={item.label}
                            className="card-base card-interactive reveal-card relative overflow-hidden"
                            style={{ animationDelay: `${index * 60}ms` }}
                        >
                            <div className={`absolute top-0 left-0 h-1 w-full ${item.accent}`} />
                            <div className="label-caps text-text-secondary mb-3">{item.label}</div>
                            <div className={`text-3xl font-bold ${typeof item.value === 'string' ? 'capitalize truncate' : ''}`}>{item.value}</div>
                        </div>
                    ))}
                </div>

                {/* MY COURSES */}
                <div className="mb-12">
                    <div className="flex items-end justify-between mb-6 gap-4">
                        <div>
                            <h2 className="text-2xl font-semibold">My courses</h2>
                            <p className="text-sm text-text-secondary mt-1">
                                Courses available for your learning journey.
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            {visibleCourseCount > 3 ? (
                                <button
                                    type="button"
                                    onClick={() => setShowAllCourses(!showAllCourses)}
                                    className="text-sm text-primary font-medium hover:underline cursor-pointer"
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
                    ) : courses.length === 0 ? (
                        <EmptyState
                            title="No courses available"
                            description="Check back later for new course material."
                            action={
                                <Link
                                    to="/courses"
                                    className="h-11 px-4 inline-flex items-center bg-primary text-white font-medium hover:bg-primary-hover transition-colors rounded"
                                >
                                    Browse courses
                                </Link>
                            }
                        />
                    ) : (
                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {activeCourses.map((course, index) => (
                                <div
                                    key={course.id}
                                    className="reveal-card"
                                    style={{ animationDelay: `${index * 70}ms` }}
                                >
                                    <CourseCard course={course} />
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="grid lg:grid-cols-3 gap-6 mb-12">
                    {/* RECENT ASSESSMENTS (Replaced Recent Sessions) */}
                    <div className="lg:col-span-2 card-base card-interactive reveal-card p-0 overflow-hidden flex flex-col">
                        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
                            <h3 className="font-semibold">Recent Assessments</h3>
                        </div>
                        
                        {(() => {
                            if (attempts.length === 0) {
                                return (
                                    <div className="p-8 text-center text-text-secondary text-sm flex-1 flex items-center justify-center min-h-[200px]">
                                        No assessments completed yet. Take a course quiz to see your scores here.
                                    </div>
                                );
                            }

                            return (
                                <table className="w-full text-sm">
                                    <thead className="bg-surface">
                                        <tr className="text-left">
                                            <th className="px-6 py-3 label-caps text-text-secondary">Date</th>
                                            <th className="px-6 py-3 label-caps text-text-secondary">Assessment ID</th>
                                            <th className="px-6 py-3 label-caps text-text-secondary">Score</th>
                                            <th className="px-6 py-3 label-caps text-text-secondary">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {attempts.slice(0, 3).map((att: any) => (
                                            <tr
                                                key={att.id}
                                                className="border-t border-border"
                                            >
                                                <td className="px-6 py-4 text-text-secondary">
                                                    {att.submitted_at
                                                        ? new Date(att.submitted_at).toLocaleDateString()
                                                        : "—"}
                                                </td>
                                                <td className="px-6 py-4 font-mono text-xs">
                                                    {att.assessment_id?.substring(0,8) ?? "Quiz"}
                                                </td>
                                                <td className="px-6 py-4 font-bold text-primary">
                                                    {att.score ?? 0}%
                                                </td>
                                                <td className="px-6 py-4 font-mono">
                                                    <span className={`px-2 py-1 rounded text-xs ${att.passed ? 'bg-success/10 text-success' : 'bg-coral/10 text-coral'}`}>
                                                        {att.passed ? "Passed" : "Failed"}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            );
                        })()}
                    </div>

                    {/* RIGHT COLUMN */}
                    <div className="flex flex-col gap-6">
                        {/* LEARNING PATH WIDGET */}
                        <div className="card-base card-interactive reveal-card bg-navy text-white border-navy flex-1">
                            <div className="flex items-center gap-2 mb-3">
                                <Sparkles size={16} className="text-coral" />
                                <span className="label-caps text-coral">
                                    Learning Path
                                </span>
                            </div>
                            
                            <h3 className="text-white text-xl font-semibold mb-2 capitalize">
                                {path?.target_role ?? "Set your career goal"}
                            </h3>
                            
                            <p className="text-white/70 text-sm leading-relaxed mb-4">
                                {(path as any)?.next_courses?.[0]?.title
                                    ? `Next up: ${(path as any).next_courses[0].title}`
                                    : "Generate a personalised learning path to reach your next role."}
                            </p>
                            
                            <div className="flex items-center gap-4 mt-auto">
                                <Link
                                    to={path?.target_role ? "/learning-path" : "/onboarding"}
                                    className="inline-flex items-center gap-2 text-coral font-medium text-sm hover:underline cursor-pointer"
                                >
                                    {path?.target_role ? "View path" : "Get started"} <ArrowRight size={14} />
                                </Link>
                                {path?.target_role && (
                                    <button
                                        onClick={handleRegeneratePath}
                                        disabled={regenerating}
                                        className="inline-flex items-center gap-1.5 text-white/70 hover:text-white text-xs transition-colors disabled:opacity-50"
                                    >
                                        <RefreshCw size={12} className={regenerating ? "animate-spin" : ""} />
                                        {regenerating ? "Regenerating..." : "Regenerate Path"}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <Footer />
        </div>
    );
}
