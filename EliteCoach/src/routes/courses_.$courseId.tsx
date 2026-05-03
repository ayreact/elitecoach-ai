import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { requireLearner } from "@/lib/auth-guard";
import { useEffect, useState } from "react";
import { TopNav } from "@/components/TopNav";
import { Footer } from "@/components/Footer";
import {
    contentApi,
    aiTutorApi,
    notificationsApi,
    buildNotificationPayload,
    coerceIntegerId,
    extractErrorMessage,
    normalizeCourse,
    normalizeCourses,
    unwrapApiData,
    unwrapApiList,
    ContentModule,
    CourseCurriculum,
} from "@/lib/api-client";
import { useAuthStore, useSessionStore } from "@/lib/stores";
import { toast } from "sonner";
import {
    ChevronDown,
    Clock,
    BookOpen,
    Award,
    AlertTriangle,
} from "lucide-react";

interface Course {
    id: string;
    title: string;
    description?: string;
    domain?: string;
    difficulty_level?: string;
    tutor_name?: string;
    skills?: string[];
    skill_tags?: string[];
}

interface ContentChunk {
    id?: string;
    title: string;
    content?: string;
    duration_minutes?: number;
}

interface Module {
    id: string;
    title: string;
    order_index?: number;
    content_chunks?: ContentChunk[];
}

export const Route = createFileRoute("/courses_/$courseId")({
    beforeLoad: () => { requireLearner(); },
    head: ({ params }) => ({
        meta: [
            { title: `Course — EliteCoach` },
            {
                name: "description",
                content: `Course details for ${params.courseId} on EliteCoach.`,
            },
        ],
    }),
    component: CourseDetailPage,
});

function CourseDetailPage() {
    const { courseId } = Route.useParams();
    const navigate = useNavigate();
    const user = useAuthStore((s) => s.user);
    const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
    const setSession = useSessionStore((s) => s.setSession);

    const [course, setCourse] = useState<Course | null>(null);
    const [modules, setModules] = useState<Module[]>([]);
    const [loading, setLoading] = useState(true);
    const [openModule, setOpenModule] = useState<string | null>(null);
    const [starting, setStarting] = useState(false);

    useEffect(() => {
        let alive = true;
        console.log("CRITICAL: Course Detail checking ID:", courseId);
        window.scrollTo(0, 0); // Ensure we start at top

        const actualId = courseId || window.location.pathname.split("/").pop();
        console.log("NAVIGATED: Processing course ID:", actualId);

        Promise.all([
            contentApi.get("/courses/", { timeout: 10000 }).catch((err) => {
                console.error("Failed to fetch course list:", err);
                return { data: [] };
            }),
            contentApi
                .get(`/courses/${courseId}/curriculum`, { timeout: 10000 })
                .catch((err) => {
                    console.error("Failed to fetch curriculum:", err);
                    return { data: null };
                }),
        ])
            .then(([listRes, cur]) => {
                if (!alive) return;

                const curriculum = unwrapApiData<unknown>(cur.data);
                const courseList = unwrapApiList<unknown>(listRes.data);
                const courses = normalizeCourses(courseList);

                console.log("Course Detail Debug:", {
                    id: courseId,
                    listLength: courseList.length,
                    hasCurriculum: !!curriculum,
                });

                // Search by both string and number to be safe
                const matchedCourse = courses.find(
                    (entry) => String(entry.id) === String(courseId)
                );

                console.log(
                    "Matched course found:",
                    matchedCourse ? "YES" : "NO",
                    matchedCourse
                );

                const derivedCourse =
                    matchedCourse ??
                    (!Array.isArray(curriculum) &&
                    curriculum &&
                    typeof curriculum === "object"
                        ? normalizeCourse(curriculum)
                        : null);

                const typedCurriculum = curriculum as CourseCurriculum;
                let mods: any[] =
                    typedCurriculum?.modules ??
                    (Array.isArray(curriculum) ? curriculum : []);

                // Use the curriculum response to populate the course if the list didn't have it
                const finalCourse = derivedCourse ?? (
                    !Array.isArray(curriculum) && curriculum && typeof curriculum === "object"
                        ? {
                            id: String((curriculum as any).id ?? courseId),
                            title: (curriculum as any).title ?? "Course",
                            description: (curriculum as any).description,
                            domain: (curriculum as any).domain,
                            difficulty_level: (curriculum as any).difficulty_level,
                            tutor_name: (curriculum as any).tutor_name ?? (curriculum as any).tutor_id,
                            skills: (curriculum as any).skill_tags ?? (curriculum as any).skills ?? [],
                            skill_tags: (curriculum as any).skill_tags ?? [],
                          }
                        : null
                );

                // Map skill_tags into skills if the course comes from normalizedCourses (which drops skill_tags)
                if (finalCourse && !finalCourse.skills?.length) {
                    const raw = courseList.find((c: any) => String(c.id) === String(courseId)) as any;
                    if (raw?.skill_tags?.length) {
                        (finalCourse as any).skills = raw.skill_tags;
                    }
                }

                setCourse(finalCourse as Course);
                console.log("Derived course result:", finalCourse);

                setModules(mods as Module[]);

                if (mods[0]) setOpenModule(String(mods[0].id));
                setLoading(false);
            })
            .catch((err) => {
                console.error("Unexpected error in course detail load:", err);
                if (alive) setLoading(false);
            });

        return () => {
            alive = false;
        };
    }, [courseId]);

    const startLearning = async () => {
        setStarting(true);
        try {
            const numericCourseId = coerceIntegerId(courseId) ?? Number(courseId);
            const subjectId = numericCourseId;

            const res = await aiTutorApi.post(
                "/api/v1/learning/sessions/start",
                {},
                {
                    params: {
                        course_id: numericCourseId,
                        subject_id: subjectId,
                        topic: course?.title ?? "Course",
                    },
                }
            );
            const payload = unwrapApiData<any>(res.data);
            const sessionId = payload?.session_id ?? payload?.id ?? payload;

            if (!sessionId) throw new Error("No session id returned");

            setSession({
                sessionId: String(sessionId),
                courseId: String(courseId),
                subjectId: numericCourseId,
            });

            navigate({
                to: "/learn/$sessionId",
                params: { sessionId: String(sessionId) },
            });
        } catch (err) {
            console.error("Session start error:", err);
            toast.error(
                extractErrorMessage(err, "Could not start learning session")
            );
        } finally {
            setStarting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex flex-col bg-surface">
                <TopNav />
                <div className="container-1200 py-20 flex flex-col items-center justify-center">
                    <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
                    <p className="text-text-secondary animate-pulse">
                        Loading course details...
                    </p>
                </div>
                <Footer />
            </div>
        );
    }

    // REMOVED: if (!course) return ... block to ensure the page structure is always visible
    // We will handle the "empty" state inside the main return instead to avoid a blank screen

    return (
        <div className="min-h-screen flex flex-col bg-surface">
            <TopNav />

            {/* HERO */}
            <section className="bg-navy text-navy-foreground">
                <div className="container-1200 py-16 grid lg:grid-cols-[1fr_360px] gap-12">
                    <div>
                        <Link
                            to="/courses"
                            className="label-caps text-coral mb-4 inline-block hover:underline"
                        >
                            ← All courses
                        </Link>
                        <h1 className="text-4xl md:text-5xl font-bold tracking-tight leading-tight mb-6">
                            {course?.title ?? "Course Details"}
                        </h1>
                        <p className="text-white/70 text-lg leading-relaxed max-w-2xl mb-6">
                            {course?.description ??
                                "Loading course description from academic services..."}
                        </p>
                        <div className="flex items-center flex-wrap gap-3 mb-8">
                            <span className="label-caps bg-white/10 px-3 py-1.5">
                                {course?.domain ?? "Technology"}
                            </span>
                            <span className="label-caps bg-white/10 px-3 py-1.5">
                                {course?.difficulty_level ?? "Beginner"}
                            </span>
                        </div>
                    </div>

                    {/* Floating enroll card */}
                    <div className="self-start bg-surface-card text-text-primary rounded-lg overflow-hidden shadow-2xl border border-border">
                        <div className="h-1.5 w-full bg-coral" />
                        <div className="p-6">
                            <div className="space-y-3 mb-6">
                                <div className="flex items-center gap-3 text-sm text-text-secondary">
                                    <BookOpen size={16} className="text-primary" />
                                    <span><strong className="text-text-primary">{modules.length > 0 ? modules.length : "—"}</strong> modules</span>
                                </div>
                                <div className="flex items-center gap-3 text-sm text-text-secondary">
                                    <Clock size={16} className="text-primary" />
                                    <span>Self-paced learning</span>
                                </div>
                                <div className="flex items-center gap-3 text-sm text-text-secondary">
                                    <Award size={16} className="text-primary" />
                                    <span>Professional Certificate</span>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <button
                                    onClick={startLearning}
                                    disabled={starting}
                                    className="w-full h-12 bg-primary text-primary-foreground font-semibold rounded-md hover:bg-primary-hover transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {starting ? "Starting..." : "Start learning"}
                                </button>

                                <Link
                                    to="/quiz/$courseId"
                                    params={{ courseId: String(courseId) }}
                                    search={{ level: "beginner", count: 5 }}
                                    className="w-full h-12 bg-coral text-white font-semibold rounded-md hover:opacity-90 transition-all flex items-center justify-center gap-2"
                                >
                                    <Award size={16} />
                                    Take assessment
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* CURRICULUM */}
            <section className="bg-surface-card section-y">
                <div className="container-1200 grid lg:grid-cols-[1fr_360px] gap-12">
                    <div>
                        <span className="label-caps text-coral mb-3 inline-block">
                            Curriculum
                        </span>
                        <h2 className="text-3xl font-semibold mb-8">
                            What you'll learn
                        </h2>

                        {(() => {
                            const tags = course?.skills?.length ? course.skills : course?.skill_tags ?? [];
                            return tags.length > 0 ? (
                                <div className="flex flex-wrap gap-2 mb-10">
                                    {tags.map((s) => (
                                        <span
                                            key={s}
                                            className="px-3 py-1.5 bg-surface text-sm rounded-sm"
                                        >
                                            {s}
                                        </span>
                                    ))}
                                </div>
                            ) : null;
                        })()}

                        <div className="border border-border bg-white rounded-sm overflow-hidden">
                            {modules.length === 0 ? (
                                <div className="p-12 text-center text-text-secondary border-t border-border mt-4 bg-surface">
                                    <BookOpen
                                        className="mx-auto mb-4 opacity-20"
                                        size={48}
                                    />
                                    <h3 className="text-lg font-semibold text-text-primary mb-2">Curriculum under development</h3>
                                    <p className="text-sm">
                                        The modules for this course are currently being developed. 
                                        You can still start a learning session with the AI tutor 
                                        using the controls above.
                                    </p>
                                </div>
                            ) : (
                                modules.map((m, idx) => {
                                    const open = openModule === String(m.id);
                                    return (
                                        <div
                                            key={m.id}
                                            className="border-b border-border last:border-b-0"
                                        >
                                            <button
                                                onClick={() =>
                                                    setOpenModule(
                                                        open
                                                            ? null
                                                            : String(m.id)
                                                    )
                                                }
                                                className="w-full flex items-center justify-between p-5 hover:bg-surface text-left"
                                            >
                                                <div className="flex items-center gap-4">
                                                    <span className="font-mono text-sm text-coral">
                                                        {String(
                                                            idx + 1
                                                        ).padStart(2, "0")}
                                                    </span>
                                                    <span className="font-semibold">
                                                        {m.title}
                                                    </span>
                                                </div>
                                                <ChevronDown
                                                    size={18}
                                                    className={`text-text-secondary transition-transform ${open ? "rotate-180" : ""}`}
                                                />
                                            </button>
                                            {open && (
                                                <div className="px-5 pb-5 pl-16 space-y-2">
                                                    {(m.content_chunks ?? [])
                                                        .length === 0 ? (
                                                        <div className="text-sm text-text-secondary">
                                                            No lessons yet
                                                        </div>
                                                    ) : (
                                                        (
                                                            m.content_chunks ??
                                                            []
                                                        ).map((c, i) => (
                                                            <div
                                                                key={c.id ?? i}
                                                                className="flex items-center justify-between py-2 border-b border-border last:border-b-0 text-sm"
                                                            >
                                                                <span>
                                                                    {c.title}
                                                                </span>
                                                                {c.duration_minutes && (
                                                                    <span className="text-xs text-text-secondary font-mono">
                                                                        {
                                                                            c.duration_minutes
                                                                        }{" "}
                                                                        min
                                                                    </span>
                                                                )}
                                                            </div>
                                                        ))
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    <aside className="space-y-6">
                        <div className="card-base card-interactive reveal-card">
                            <h3 className="font-semibold mb-2">
                                AI-powered tutor
                            </h3>
                            <p className="text-sm text-text-secondary leading-relaxed">
                                Every lesson comes with an always-on tutor that
                                adapts to your questions and pace.
                            </p>
                        </div>
                        <div
                            className="card-base card-interactive reveal-card"
                            style={{ animationDelay: "80ms" }}
                        >
                            <h3 className="font-semibold mb-2">
                                Hands-on assessments
                            </h3>
                            <p className="text-sm text-text-secondary leading-relaxed">
                                Test what you've learned with adaptive quizzes
                                after each module.
                            </p>
                        </div>
                    </aside>
                </div>
            </section>

            <Footer />
        </div>
    );
}
