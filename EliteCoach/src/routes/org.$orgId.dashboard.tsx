import { createFileRoute } from "@tanstack/react-router";
import { requireOrgAdmin } from "@/lib/auth-guard";
import { useOrgStore } from "@/lib/stores";
import { useEffect, useState } from "react";
import { TopNav } from "@/components/TopNav";
import { OrgTabs } from "@/components/OrgTabs";
import { identityApi } from "@/lib/api-client";

interface OrgDashboard {
  activeLearners?: number;
  completionRate?: number;
  averageScore?: number;
  atRiskLearners?: number;
  courseProgress?: {
    courseId: string;
    enrolledCount: number;
    completionRate: number;
  }[];
}

export const Route = createFileRoute("/org/$orgId/dashboard")({
  beforeLoad: ({ params }) => {
    requireOrgAdmin();
    useOrgStore.getState().setOrg({ organizationId: params.orgId });
  },
  head: () => ({ meta: [{ title: "Org dashboard — EliteCoach" }] }),
  component: OrgDashboardPage,
});

function OrgDashboardPage() {
  const { orgId } = Route.useParams();
  const [data, setData] = useState<OrgDashboard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    identityApi
      .get(`/api/v1/organizations/${orgId}/dashboard`)
      .then((res) => setData(res.data?.data ?? res.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [orgId]);

  const stats = [
    {
      label: "Active learners",
      value: data?.activeLearners ?? "—",
      accent: "bg-primary",
    },
    {
      label: "Completion rate",
      value: data?.completionRate != null ? `${data.completionRate}%` : "—",
      accent: "bg-coral",
    },
    {
      label: "Avg score",
      value: data?.averageScore != null ? `${data.averageScore}%` : "—",
      accent: "bg-success",
    },
    {
      label: "At-risk learners",
      value: data?.atRiskLearners ?? "—",
      accent: "bg-destructive",
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <TopNav />
      <OrgTabs orgId={orgId} />
      <div className="container-1200 py-12 flex-1">
        <div className="mb-10">
          <span className="label-caps text-coral mb-2 inline-block">
            Organisation
          </span>
          <h1 className="text-4xl font-bold tracking-tight">Overview</h1>
        </div>

        {loading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="card-base h-32 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
            {stats.map((s) => (
              <div
                key={s.label}
                className="card-base card-interactive reveal-card relative overflow-hidden"
                style={{ animationDelay: `${stats.indexOf(s) * 60}ms` }}
              >
                <div
                  className={`absolute top-0 left-0 h-1 w-full ${s.accent}`}
                />
                <div className="label-caps text-text-secondary mb-3">
                  {s.label}
                </div>
                <div className="text-3xl font-bold">{s.value}</div>
              </div>
            ))}
          </div>
        )}

        <div className="card-base p-0 overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <h3 className="font-semibold">Course progress</h3>
          </div>
          {!data?.courseProgress || data.courseProgress.length === 0 ? (
            <div className="p-8 text-center text-text-secondary text-sm">
              No course data yet.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-surface">
                <tr className="text-left">
                  <th className="px-6 py-3 label-caps text-text-secondary">
                    Course ID
                  </th>
                  <th className="px-6 py-3 label-caps text-text-secondary">
                    Enrolled
                  </th>
                  <th className="px-6 py-3 label-caps text-text-secondary">
                    Completion
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.courseProgress.map((row) => (
                  <tr key={row.courseId} className="border-t border-border">
                    <td className="px-6 py-4 font-mono text-xs">
                      {row.courseId}
                    </td>
                    <td className="px-6 py-4">{row.enrolledCount}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-1 bg-border rounded-sm overflow-hidden max-w-xs">
                          <div
                            className="h-full bg-coral"
                            style={{ width: `${row.completionRate}%` }}
                          />
                        </div>
                        <span className="font-mono text-xs w-10">
                          {row.completionRate}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
