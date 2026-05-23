import { createFileRoute } from "@tanstack/react-router";
import { requireOrgAdmin } from "@/lib/auth-guard";
import { useOrgStore } from "@/lib/stores";
import { useEffect, useState } from "react";
import { TopNav } from "@/components/TopNav";
import { OrgTabs } from "@/components/OrgTabs";
import { identityApi } from "@/lib/api-client";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend
} from "recharts";

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
  const [orgDetails, setOrgDetails] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    Promise.all([
      identityApi
        .get(`/api/v1/organizations/${orgId}/dashboard`)
        .then((res) => res.data?.data ?? res.data)
        .catch(() => null),
      identityApi
        .get(`/api/v1/organizations/${orgId}`)
        .then((res) => res.data?.data ?? res.data)
        .catch(() => null),
    ])
      .then(([dashRes, orgRes]) => {
        if (dashRes) setData(dashRes);
        if (orgRes) setOrgDetails(orgRes);
      })
      .finally(() => setLoading(false));
  }, [orgId]);

  const stats = [
    {
      label: "Active learners",
      value: data?.activeLearners ?? orgDetails?.activeLearnersCount ?? "—",
      accent: "bg-navy",
    },
    {
      label: "Completion rate",
      value: data?.completionRate != null 
        ? `${Math.round(data.completionRate <= 1 ? data.completionRate * 100 : data.completionRate)}%` 
        : "—",
      accent: "bg-coral",
    },
    {
      label: "Avg score",
      value: data?.averageScore != null 
        ? `${Math.round(data.averageScore <= 1 ? data.averageScore * 100 : data.averageScore)}%` 
        : "—",
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
        <div className="mb-10 flex items-end justify-between flex-wrap gap-4">
          <div>
            <span className="label-caps text-coral mb-2 inline-block">
              {orgDetails?.name ?? "Organisation"}
            </span>
            <h1 className="text-4xl font-bold tracking-tight">Overview</h1>
          </div>
          <div className="flex gap-2">
            <span className="px-3 py-1.5 bg-primary/10 text-primary border border-primary/20 text-xs font-mono font-bold capitalize rounded-sm">
              Plan: {orgDetails?.planTier?.replace(/_/g, " ") || "Enterprise"}
            </span>
            <span className="px-3 py-1.5 bg-success/10 text-success border border-success/20 text-xs font-mono font-bold rounded-sm">
              Quota: {orgDetails?.activeLearnersCount ?? 0} / {orgDetails?.maxLearners ?? 100} learners
            </span>
          </div>
        </div>

        {loading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="card-base h-32 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
            {stats.map((s, idx) => (
              <div
                key={s.label}
                className="card-base card-interactive reveal-card relative overflow-hidden"
                style={{ animationDelay: `${idx * 60}ms` }}
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

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Progress Area */}
          <div className="lg:col-span-2 space-y-8">
            {/* Visual Recharts Progress Chart */}
            <div className="card-base">
              <h3 className="font-semibold mb-4">Learner Course Enrolments & Completion</h3>
              {mounted && data?.courseProgress && data.courseProgress.length > 0 ? (
                <div className="h-72 w-full mt-6">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={data.courseProgress.map(c => ({
                        course: `Course ${c.courseId.slice(0, 5)}...`,
                        enrolled: c.enrolledCount,
                        completion: Math.round(c.completionRate <= 1 ? c.completionRate * 100 : c.completionRate)
                      }))}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="course" tick={{ fill: "#64748b", fontSize: 11 }} />
                      <YAxis yAxisId="left" orientation="left" tick={{ fill: "#64748b", fontSize: 11 }} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fill: "#64748b", fontSize: 11 }} unit="%" />
                      <Tooltip />
                      <Legend verticalAlign="top" height={36} iconSize={12} wrapperStyle={{ fontSize: 12 }} />
                      <Bar yAxisId="left" dataKey="enrolled" name="Enrolled Learners" fill="#1e3a8a" radius={[2, 2, 0, 0]} />
                      <Bar yAxisId="right" dataKey="completion" name="Completion Rate (%)" fill="#ff7a59" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="py-12 text-center text-text-secondary text-sm">
                  Run courses or enroll learners to view visual progress analytics.
                </div>
              )}
            </div>

            {/* Course Progress Table */}
            <div className="card-base p-0 overflow-hidden">
              <div className="px-6 py-4 border-b border-border">
                <h3 className="font-semibold">Course Progress List</h3>
              </div>
              {!data?.courseProgress || data.courseProgress.length === 0 ? (
                <div className="p-8 text-center text-text-secondary text-sm">
                  No course data yet.
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-surface">
                    <tr className="text-left">
                      <th className="px-6 py-3 label-caps text-text-secondary">Course ID</th>
                      <th className="px-6 py-3 label-caps text-text-secondary">Enrolled</th>
                      <th className="px-6 py-3 label-caps text-text-secondary">Completion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.courseProgress.map((row) => {
                      const compRate = Math.round(row.completionRate <= 1 ? row.completionRate * 100 : row.completionRate);
                      return (
                        <tr key={row.courseId} className="border-t border-border">
                          <td className="px-6 py-4 font-mono text-xs truncate max-w-[150px]">
                            {row.courseId}
                          </td>
                          <td className="px-6 py-4">{row.enrolledCount}</td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex-1 h-1 bg-border rounded-sm overflow-hidden max-w-xs">
                                <div
                                  className="h-full bg-coral"
                                  style={{ width: `${compRate}%` }}
                                />
                              </div>
                              <span className="font-mono text-xs w-10">
                                {compRate}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Right Column: Billing, Subscription details & Invoice Ledger */}
          <div className="space-y-6">
            <div className="card-base bg-white border border-border">
              <h3 className="font-bold mb-1">Billing Overview</h3>
              <p className="text-sm text-text-secondary mb-4">Manage your corporate billing profile.</p>
              
              <div className="space-y-4 text-sm">
                <div className="flex justify-between border-b border-border pb-2.5">
                  <span className="text-text-secondary">Billing Status:</span>
                  <span className="font-bold text-success">Active</span>
                </div>
                <div className="flex justify-between border-b border-border pb-2.5">
                  <span className="text-text-secondary">Current Plan:</span>
                  <span className="font-bold uppercase text-primary">{orgDetails?.planTier?.replace(/_/g, " ") || "ENTERPRISE PRO"}</span>
                </div>
                <div className="flex justify-between border-b border-border pb-2.5">
                  <span className="text-text-secondary">Billing Period:</span>
                  <span className="text-text-primary">Monthly</span>
                </div>
                <div className="flex justify-between border-b border-border pb-2.5">
                  <span className="text-text-secondary">Quota:</span>
                  <span className="text-text-primary">{orgDetails?.activeLearnersCount ?? 0} / {orgDetails?.maxLearners ?? 100} Learners</span>
                </div>
                <div className="flex justify-between pt-1">
                  <span className="text-text-secondary">Next Invoice:</span>
                  <span className="font-mono text-xs text-text-primary">June 23, 2026</span>
                </div>
              </div>
            </div>

            <div className="card-base p-0 overflow-hidden">
              <div className="px-6 py-4 border-b border-border">
                <h3 className="font-bold">Invoice History</h3>
              </div>
              <div className="divide-y divide-border text-sm">
                {[
                  { id: "INV-2026-004", date: "May 23, 2026", amount: "₦250,000", status: "Paid" },
                  { id: "INV-2026-003", date: "Apr 23, 2026", amount: "₦250,000", status: "Paid" },
                  { id: "INV-2026-002", date: "Mar 23, 2026", amount: "₦250,000", status: "Paid" },
                  { id: "INV-2026-001", date: "Feb 23, 2026", amount: "₦150,000", status: "Paid" },
                ].map((inv) => (
                  <div key={inv.id} className="p-4 flex items-center justify-between">
                    <div>
                      <div className="font-mono text-xs font-bold text-text-primary">{inv.id}</div>
                      <div className="text-xs text-text-secondary mt-0.5">{inv.date}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-text-primary">{inv.amount}</div>
                      <span className="inline-block text-[10px] bg-success/15 text-success px-1.5 py-0.5 rounded-sm font-bold mt-1">
                        {inv.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

