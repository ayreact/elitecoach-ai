import { createFileRoute, useNavigate } from "@tanstack/react-router";
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
    getLearningPath,
    generateLearningPath,
} from "@/lib/api-client";
import { toast } from "sonner";
import { Pencil, Check, Circle } from "lucide-react";

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
    const navigate = useNavigate();
    const [path, setPath] = useState<LearningPath | null>(null);
    const [loading, setLoading] = useState(true);

    const userId = user?.id ?? user?.userId ?? "learner";

    useEffect(() => {
        if (!userId) {
            setLoading(false);
            return;
        }
        getLearningPath(userId)
            .then((data) => {
                setPath(data ?? null);
            })
            .catch(() => setPath(null))
            .finally(() => setLoading(false));
    }, [userId]);

    const generate = () => {
        navigate({ to: "/onboarding" });
    };

    const steps: PathStep[] = path?.steps ?? [];

    return (
        <div className="min-h-screen flex flex-col bg-surface">
            <TopNav />
            <div className="container-1200 py-12 flex-1 relative">
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
                            onClick={() => navigate({ to: "/onboarding" })}
                            className="h-11 px-4 border border-border inline-flex items-center gap-2 font-medium hover:bg-surface-card transition-colors"
                        >
                            <Pencil size={14} /> Edit goal
                        </button>
                        <button
                            onClick={generate}
                            className="h-11 px-4 bg-primary text-primary-foreground font-medium hover:bg-primary-hover transition-colors"
                        >
                            Generate new path
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
                            onClick={() => navigate({ to: "/onboarding" })}
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
                                    {/* Grab the title of the first item in the next_courses array */}
                                    {(path as any)?.next_courses?.[0]?.title || "N/A"}
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


            <Footer />
        </div>
    );
}
