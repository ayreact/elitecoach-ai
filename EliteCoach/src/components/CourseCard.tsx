import { Link } from "@tanstack/react-router";

export interface CourseCardData {
    id: string;
    title: string;
    description?: string;
    domain?: string;
    difficulty_level?: string;
    tutor_name?: string;
    published_date?: string;
    created_at?: string;
}

const domainColor = (domain?: string) => {
    if (!domain) return "bg-primary";
    const d = domain.toLowerCase();
    if (d.includes("design") || d.includes("art")) return "bg-coral";
    if (d.includes("data") || d.includes("ml") || d.includes("ai"))
        return "bg-primary";
    if (d.includes("business") || d.includes("market")) return "bg-success";
    if (d.includes("dev") || d.includes("code") || d.includes("tech"))
        return "bg-navy";
    // pseudo-random by first char
    const codes = ["bg-primary", "bg-coral", "bg-navy", "bg-success"];
    return codes[d.charCodeAt(0) % codes.length];
};

export function CourseCard({ course }: { course: CourseCardData }) {
    const date = course.published_date ?? course.created_at;

    return (
        <Link
            to="/courses/$courseId"
            params={{ courseId: String(course.id) }}
            className="card-base card-interactive flex flex-col p-0 overflow-hidden group"
            onClick={(e) => {
                console.log("Navigating to course detail:", course.id);
            }}
        >
            <div className={`h-2 w-full ${domainColor(course.domain)}`} />
            <div className="p-6 flex flex-col flex-1">
                <div className="flex items-center gap-2 mb-3">
                    {course.domain && (
                        <span className="label-caps bg-surface text-text-secondary px-2 py-1 rounded-sm">
                            {course.domain}
                        </span>
                    )}
                    {course.difficulty_level && (
                        <span className="label-caps border border-border text-text-secondary px-2 py-1 rounded-sm">
                            {course.difficulty_level}
                        </span>
                    )}
                </div>
                <h3 className="text-lg font-semibold text-text-primary leading-snug line-clamp-2 mb-2 group-hover:text-primary transition-colors">
                    {course.title}
                </h3>
                {course.description && (
                    <p className="text-sm text-text-secondary line-clamp-2 mb-4">
                        {course.description}
                    </p>
                )}
                <div className="mt-auto pt-4 border-t border-border flex items-center justify-between text-xs text-text-secondary">
                    <span>{course.tutor_name ?? "EliteCoach"}</span>
                    {date && (
                        <span className="font-mono">
                            {new Date(date).toLocaleDateString()}
                        </span>
                    )}
                </div>
            </div>
        </Link>
    );
}
