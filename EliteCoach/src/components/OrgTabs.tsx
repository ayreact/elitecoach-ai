import { Link, useRouterState } from "@tanstack/react-router";

export function OrgTabs({ orgId }: { orgId: string }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const tabs = [
    { to: `/org/${orgId}/dashboard`, label: "Overview" },
    { to: `/org/${orgId}/learners`, label: "Learners" },
    { to: `/org/${orgId}/reports`, label: "Reports" },
  ];
  return (
    <div className="border-b border-border bg-surface-card">
      <div className="container-1200 flex gap-8">
        {tabs.map((t) => {
          const active = path === t.to;
          return (
            <Link
              key={t.to}
              to={t.to}
              className={`h-14 inline-flex items-center text-sm font-medium border-b-2 transition-colors ${
                active
                  ? "border-primary text-primary"
                  : "border-transparent text-text-secondary hover:text-text-primary"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
