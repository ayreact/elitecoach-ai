import { createFileRoute } from "@tanstack/react-router";
import { requireOrgAdmin } from "@/lib/auth-guard";
import { useOrgStore } from "@/lib/stores";
import { useState } from "react";
import { TopNav } from "@/components/TopNav";
import { OrgTabs } from "@/components/OrgTabs";
import { identityApi, extractErrorMessage } from "@/lib/api-client";
import { toast } from "sonner";
import { Download } from "lucide-react";

export const Route = createFileRoute("/org/$orgId/reports")({
  beforeLoad: ({ params }) => {
    requireOrgAdmin();
    useOrgStore.getState().setOrg({ organizationId: params.orgId });
  },
  head: () => ({ meta: [{ title: "Org reports — EliteCoach" }] }),
  component: OrgReportsPage,
});

function OrgReportsPage() {
  const { orgId } = Route.useParams();
  const [tab, setTab] = useState<"progress" | "compliance">("progress");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [data, setData] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const [exportFormat, setExportFormat] = useState<"PDF" | "CSV">("PDF");

  const fetchReport = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (tab === "progress") {
        if (start)
          params.set("startDate", new Date(`${start}T00:00:00`).toISOString());
        if (end)
          params.set("endDate", new Date(`${end}T23:59:59`).toISOString());
        params.set("format", "JSON");
      }
      const url =
        tab === "progress"
          ? `/api/v1/organizations/${orgId}/reports/learner-progress?${params.toString()}`
          : `/api/v1/organizations/${orgId}/reports/compliance`;
      const res = await identityApi.get(url);
      setData(res.data?.data ?? res.data);
    } catch (err) {
      toast.error(extractErrorMessage(err, "Could not fetch report"));
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const exportReport = async () => {
    try {
      const params = new URLSearchParams();
      if (tab === "progress") {
        if (start)
          params.set("startDate", new Date(`${start}T00:00:00`).toISOString());
        if (end)
          params.set("endDate", new Date(`${end}T23:59:59`).toISOString());
        params.set("format", exportFormat);
      }
      const url =
        tab === "progress"
          ? `/api/v1/organizations/${orgId}/reports/learner-progress?${params.toString()}`
          : `/api/v1/organizations/${orgId}/reports/compliance`;
      await identityApi.get(url);
      toast.success(`${exportFormat} report exported`);
    } catch (err) {
      toast.error(extractErrorMessage(err, "Export failed"));
    }
  };

  const cards =
    data && typeof data === "object"
      ? Object.entries(data as Record<string, unknown>)
      : [];

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <TopNav />
      <OrgTabs orgId={orgId} />
      <div className="container-1200 py-12 flex-1">
        <div className="mb-10">
          <span className="label-caps text-coral mb-2 inline-block">
            Organisation
          </span>
          <h1 className="text-4xl font-bold tracking-tight">Reports</h1>
        </div>

        <div className="flex gap-2 mb-8 border-b border-border">
          {(["progress", "compliance"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`h-12 px-5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === t
                  ? "border-primary text-primary"
                  : "border-transparent text-text-secondary hover:text-text-primary"
              }`}
            >
              {t === "progress" ? "Learner Progress" : "Compliance"}
            </button>
          ))}
        </div>

        <div className="card-base card-interactive reveal-card mb-6">
          <div className="grid md:grid-cols-4 gap-4 items-end">
            {tab === "progress" && (
              <>
                <div>
                  <label className="label-caps text-text-secondary block mb-2">
                    Start date
                  </label>
                  <input
                    type="date"
                    value={start}
                    onChange={(e) => setStart(e.target.value)}
                    className="w-full h-12 px-4 border border-border focus:border-primary outline-none"
                  />
                </div>
                <div>
                  <label className="label-caps text-text-secondary block mb-2">
                    End date
                  </label>
                  <input
                    type="date"
                    value={end}
                    onChange={(e) => setEnd(e.target.value)}
                    className="w-full h-12 px-4 border border-border focus:border-primary outline-none"
                  />
                </div>
              </>
            )}
            <button
              onClick={fetchReport}
              disabled={loading}
              className="h-12 bg-primary text-primary-foreground font-medium hover:bg-primary-hover transition-colors disabled:opacity-60"
            >
              {loading ? "Loading..." : "Run report"}
            </button>
            <div className="flex gap-2">
              <select
                value={exportFormat}
                onChange={(e) =>
                  setExportFormat(e.target.value as "PDF" | "CSV")
                }
                className="h-12 px-3 border border-border bg-surface-card text-sm"
              >
                <option>PDF</option>
                <option>CSV</option>
              </select>
              <button
                onClick={exportReport}
                className="h-12 px-4 border border-border font-medium inline-flex items-center gap-2 hover:bg-surface transition-colors"
              >
                <Download size={16} /> Export
              </button>
            </div>
          </div>
        </div>

        {cards.length === 0 ? (
          <div className="card-base text-center py-16 text-text-secondary text-sm">
            Run a report to see results.
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {cards.map(([k, v], index) => (
              <div
                key={k}
                className="card-base card-interactive reveal-card"
                style={{ animationDelay: `${index * 60}ms` }}
              >
                <div className="label-caps text-text-secondary mb-2">
                  {k.replace(/_/g, " ")}
                </div>
                <div className="text-2xl font-bold break-all">
                  {typeof v === "object" ? JSON.stringify(v) : String(v)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
