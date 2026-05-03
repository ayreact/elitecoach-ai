import { createFileRoute } from "@tanstack/react-router";
import { requireLearner } from "@/lib/auth-guard";
import { useEffect, useState } from "react";
import { TopNav } from "@/components/TopNav";
import { Footer } from "@/components/Footer";
import { useAuthStore } from "@/lib/stores";
import {
    aiTutorApi,
    acsApi,
    extractErrorMessage,
    normalizeUserType,
    unwrapApiData,
} from "@/lib/api-client";
import { toast } from "sonner";
import { Pencil, X, Check, Circle } from "lucide-react";

interface PathStep {
    id?: string;
    course_name: string;
    estimated_time?: string;
    status?: "completed" | "in_progress" | "upcoming";
}

interface LearningPath {
    goal?: string;
    target_role?: string;
    steps?: PathStep[];
    time_per_week?: number;
    study_plan?: string;
    next_course?: string;
}

export const Route = createFileRoute("/learning-path")({
    beforeLoad: () => { requireLearner(); },
    head: () => ({ meta: [{ title: "Learning path — EliteCoach" }] }),
    component: LearningPathPage,
});

function LearningPathPage() {
    const user = useAuthStore((s) => s.user);
    const [path, setPath] = useState<LearningPath | null>(null);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(false);
    const [goal, setGoal] = useState("");
    const [hours, setHours] = useState(5);
    const [generating, setGenerating] = useState(false);

    const userId = user?.id ?? user?.userId;

    useEffect(() => {
        if (!userId) {
            setLoading(false);
            return;
        }
        aiTutorApi
            .get(`/api/v1/learning/paths/${userId}`)
            .then((res) => {
                const data = unwrapApiData<LearningPath | null>(res.data);
                setPath(data ?? null);
                if (data?.goal) setGoal(data.goal);
                if (data?.time_per_week) setHours(data.time_per_week);
            })
            .catch(() => setPath(null))
            .finally(() => setLoading(false));
    }, [userId]);

    const generate = async () => {
        if (!userId) return;
        setGenerating(true);
        try {
            const targetRole =
                goal || normalizeUserType(user?.userType) || "Career growth";
            const res = await aiTutorApi.post(
                "/api/v1/learning/paths/generate",
                null,
                {
                    params: {
                        target_role: targetRole,
                        time_per_week: hours,
                    },
                }
            );
            const data = unwrapApiData<any>(res.data);
            if (data) {
                setPath({
                    ...data,
                    goal: data.target_role || targetRole,
                    steps: data.steps || [],
                });
                toast.success("New learning path generated");
            }
        } catch (err) {
            toast.error(extractErrorMessage(err, "Could not generate path"));
        } finally {
            setGenerating(false);
        }
    };

    const saveGoal = async () => {
        if (!userId) return;
        try {
            await Promise.all([
                aiTutorApi.put(`/api/v1/learning/paths/${userId}`, {
                    new_goal: goal,
                    time_per_week: hours,
                }),
                acsApi
                    .patch("/v1/assessment/profile", {
                        career_goal: goal,
                        weekly_time_hrs: hours,
                    })
                    .catch((err) => {
                        console.warn("Could not sync profile to ACS", err);
                    }),
            ]);

            setPath((p) => ({
                ...(p ?? {}),
                goal,
                target_role: goal,
                time_per_week: hours,
            }));
            setEditing(false);
            toast.success("Goal updated");
        } catch (err) {
            toast.error(extractErrorMessage(err, "Could not update goal"));
        }
    };

    const steps: PathStep[] = path?.steps ?? [];

    return (
        <div className="min-h-screen flex flex-col bg-surface">
            <TopNav />
            <div className="container-1200 py-12 flex-1 relative">
                {editing && (
                    <div className="fixed inset-0 bg-navy/50 z-50 flex py-12 justify-center px-4 overflow-y-auto">
                        <div className="bg-surface w-full max-w-md p-6 relative rounded-sm h-fit">
                            <button
                                onClick={() => setEditing(false)}
                                className="absolute top-4 right-4 text-text-secondary hover:text-navy transition-colors"
                                aria-label="Close"
                            >
                                <X size={20} />
                            </button>
                            <h2 className="text-xl font-bold mb-6 mt-2">
                                Edit goal
                            </h2>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1.5">
                                        Target Role
                                    </label>
                                    <input
                                        type="text"
                                        value={goal}
                                        onChange={(e) =>
                                            setGoal(e.target.value)
                                        }
                                        placeholder="e.g. Data Scientist"
                                        className="w-full h-11 px-3 border border-border bg-transparent outline-none focus:border-primary transition-colors"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1.5">
                                        Time per week (hours)
                                    </label>
                                    <input
                                        type="number"
                                        min={1}
                                        max={40}
                                        value={hours}
                                        onChange={(e) =>
                                            setHours(
                                                parseInt(e.target.value) || 0
                                            )
                                        }
                                        className="w-full h-11 px-3 border border-border bg-transparent outline-none focus:border-primary transition-colors"
                                    />
                                </div>
                                <button
                                    onClick={saveGoal}
                                    className="w-full h-11 bg-primary text-primary-foreground font-medium hover:bg-primary-hover transition-colors mt-2"
                                >
                                    Save changes
                                </button>
                            </div>
                        </div>
                    </div>
                )}
                <div className="flex items-end justify-between flex-wrap gap-4 mb-10">
                    <div>
                        <span className="label-caps text-coral mb-2 inline-block">
                            Your roadmap
                        </span>
                        <h1 className="text-4xl font-bold tracking-tight">
                            {path?.target_role ||
                                path?.goal ||
                                "Build your learning path"}
                        </h1>
                        {path?.time_per_week && (
                            <p className="text-text-secondary mt-2">
                                {path.time_per_week} hrs/week
                            </p>
                        )}
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={() => setEditing(true)}
                            className="h-11 px-4 border border-border inline-flex items-center gap-2 font-medium hover:bg-surface-card transition-colors"
                        >
                            <Pencil size={14} /> Edit goal
                        </button>
                        <button
                            onClick={generate}
                            disabled={generating}
                            className="h-11 px-4 bg-primary text-primary-foreground font-medium hover:bg-primary-hover transition-colors disabled:opacity-60"
                        >
                            {generating ? "Generating..." : "Generate new path"}
                        </button>
                    </div>
                </div>

                {loading ? (
                    <div className="card-base h-96 animate-pulse" />
                ) : !path?.study_plan && steps.length === 0 ? (
                    <div className="card-base text-center py-16">
                        <h3 className="text-xl font-semibold mb-2">
                            No path yet
                        </h3>
                        <p className="text-text-secondary max-w-sm mx-auto mb-6">
                            Set a goal and generate a personalised learning path
                            tailored to your time and pace.
                        </p>
                        <button
                            onClick={() => setEditing(true)}
                            className="h-11 px-5 bg-primary text-primary-foreground font-medium hover:bg-primary-hover transition-colors"
                        >
                            Set my goal
                        </button>
                    </div>
                ) : path?.study_plan ? (
                    <div className="card-base font-mono whitespace-pre-wrap text-sm leading-relaxed overflow-x-auto text-navy">
                        {path.study_plan}
                        <div className="mt-8 pt-4 border-t border-border flex justify-between items-center">
                            <p className="text-base font-semibold">
                                Next up:{" "}
                                <span className="text-primary">
                                    {path.next_course || "N/A"}
                                </span>
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="relative pl-8">
                        <div className="absolute left-3 top-2 bottom-2 w-px bg-border" />
                        {steps.map((step, i) => {
                            const status = step.status ?? "upcoming";
                            const dotClasses =
                                status === "completed"
                                    ? "bg-success border-success"
                                    : status === "in_progress"
                                      ? "bg-coral border-coral"
                                      : "bg-surface-card border-border";
                            return (
                                <div
                                    key={i}
                                    className="relative pb-6 last:pb-0"
                                >
                                    <div
                                        className={`absolute -left-[26px] w-5 h-5 rounded-full border-2 flex items-center justify-center ${dotClasses}`}
                                    >
                                        {status === "completed" && (
                                            <Check
                                                size={10}
                                                className="text-white"
                                            />
                                        )}
                                        {status === "upcoming" && (
                                            <Circle
                                                size={6}
                                                className="text-text-secondary"
                                            />
                                        )}
                                    </div>
                                    <div className="card-base">
                                        <div className="flex items-start justify-between gap-4">
                                            <div>
                                                <span className="label-caps text-text-secondary">
                                                    Step {i + 1}
                                                </span>
                                                <h3 className="text-lg font-semibold mt-1">
                                                    {step.course_name}
                                                </h3>
                                                {step.estimated_time && (
                                                    <p className="text-sm text-text-secondary mt-1">
                                                        ~{step.estimated_time}
                                                    </p>
                                                )}
                                            </div>
                                            <span
                                                className={`label-caps px-3 py-1.5 rounded-sm shrink-0 ${
                                                    status === "completed"
                                                        ? "bg-success/10 text-success"
                                                        : status ===
                                                            "in_progress"
                                                          ? "bg-coral/10 text-coral"
                                                          : "bg-surface text-text-secondary"
                                                }`}
                                            >
                                                {status.replace("_", " ")}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {editing && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
                    <div className="bg-surface-card w-full max-w-md p-8 rounded-lg relative">
                        <button
                            onClick={() => setEditing(false)}
                            className="absolute top-4 right-4 text-text-secondary"
                        >
                            <X size={20} />
                        </button>
                        <h2 className="text-xl font-bold mb-6">
                            Edit your goal
                        </h2>
                        <div className="space-y-5">
                            <div>
                                <label className="label-caps text-text-secondary block mb-2">
                                    Career goal
                                </label>
                                <input
                                    value={goal}
                                    onChange={(e) => setGoal(e.target.value)}
                                    placeholder="e.g. Senior ML Engineer"
                                    className="w-full h-12 px-4 border border-border focus:border-primary outline-none"
                                />
                            </div>
                            <div>
                                <label className="label-caps text-text-secondary block mb-2">
                                    Hours per week
                                </label>
                                <input
                                    type="number"
                                    min={1}
                                    max={40}
                                    value={hours}
                                    onChange={(e) =>
                                        setHours(Number(e.target.value))
                                    }
                                    className="w-full h-12 px-4 border border-border focus:border-primary outline-none"
                                />
                            </div>
                            <button
                                onClick={saveGoal}
                                className="w-full h-12 bg-primary text-primary-foreground font-medium hover:bg-primary-hover transition-colors"
                            >
                                Save changes
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <Footer />
        </div>
    );
}
