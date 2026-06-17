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
    unwrapApiData,
    getLearningPath,
} from "@/lib/api-client";
import { toast } from "sonner";
import { Pencil, Check, Circle } from "lucide-react";

interface PathItem {
    id: string;
    position: number;
    status: string;
    course_id: string;
    course_title: string;
    total_minutes?: number;
    course_domain?: string | null;
    course_difficulty?: number | null;
    unlocked_at?: string | null;
}

interface LearningPath {
    id?: string;
    status?: string;
    items?: PathItem[];
    generated_at?: string;
    version?: number;
    // Optional fallback properties
    goal?: string;
    target_role?: string;
    time_per_week?: number;
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

    const items: PathItem[] = path?.items ?? [];

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
                ) : items.length === 0 ? (
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
                ) : (
                    <div className="relative pl-8">
                        <div className="absolute left-3 top-2 bottom-2 w-px bg-border" />
                        {items.map((step, i) => {
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
                                                    {step.course_title}
                                                </h3>
                                                {step.total_minutes ? (
                                                    <p className="text-sm text-text-secondary mt-1">
                                                        ~{step.total_minutes} mins
                                                    </p>
                                                ) : null}
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
