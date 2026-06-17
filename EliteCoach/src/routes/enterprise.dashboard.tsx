import { createFileRoute } from "@tanstack/react-router";
import { requireOrgAdmin } from "@/lib/auth-guard";

import { useEffect, useState } from "react";
import { TopNav } from "@/components/TopNav";
import { OrgTabs } from "@/components/OrgTabs";
import { identityApi, contentApi } from "@/lib/api-client";
import { Download, Filter, FileText, Table } from "lucide-react";
import { toast } from "sonner";
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
  total_learners?: number;
  pct_completed?: number;
  avg_score?: number;
  pct_at_risk?: number;
  course_completion_rates?: {
    course: string;
    enrolled: number;
    completed: number;
    pct: number;
  }[];
}

interface FilterState {
  team_id: string;
  course_id: string;
  start_date: string;
  end_date: string;
}

export const Route = createFileRoute("/enterprise/dashboard")({
  beforeLoad: () => {
    requireOrgAdmin();
  },
  head: () => ({ meta: [{ title: "Org dashboard — EliteCoach" }] }),
  component: OrgDashboardPage,
});

function OrgDashboardPage() {
  const [data, setData] = useState<OrgDashboard | null>(null);
  const [orgDetails, setOrgDetails] = useState<any | null>(null);
  const [budget, setBudget] = useState<any | null>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  
  const [filters, setFilters] = useState<FilterState>({
    team_id: "",
    course_id: "",
    start_date: "",
    end_date: ""
  });
  
  const [brandForm, setBrandForm] = useState({ logo_url: "", primary_color: "#004B9E", org_name: "" });
  const [savingBrand, setSavingBrand] = useState(false);

  useEffect(() => {
    const storeName = "";
    setBrandForm({
      logo_url: orgDetails?.logo_url || "",
      primary_color: orgDetails?.primary_color || "#004B9E",
      org_name: orgDetails?.name || orgDetails?.org_name || storeName
    });
  }, [orgDetails]);

  const handleSaveBranding = async () => {
    setSavingBrand(true);
    try {
      const res = await identityApi.patch('/api/v1/enterprise/branding', brandForm);
      const updated = res.data?.data ?? res.data;
      setOrgDetails(updated);

      toast.success("Branding settings saved successfully");
    } catch (e) {
      toast.error("Failed to save branding settings");
    } finally {
      setSavingBrand(false);
    }
  };
  
  const [loading, setLoading] = useState(true);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [mounted, setMounted] = useState(false);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (filters.team_id) q.append("team_id", filters.team_id);
      if (filters.course_id) q.append("course_id", filters.course_id);
      if (filters.start_date) q.append("from_date", filters.start_date);
      if (filters.end_date) q.append("to_date", filters.end_date);
      
      const queryStr = q.toString() ? `?${q.toString()}` : "";

      const dashRes = await identityApi.get(`/api/v1/enterprise/dashboard${queryStr}`);
      setData(dashRes.data?.data ?? dashRes.data);
    } catch (e) {
      // toast.error("Failed to update dashboard data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setMounted(true);
    
    // Initial fetches that don't depend on filters
    Promise.all([
      identityApi.patch(`/api/v1/enterprise/branding`, {}).catch(() => ({ data: null })), // fetch current branding info
      identityApi.get("/api/v1/enterprise/teams").catch(() => ({ data: [] })),
      contentApi.get("/api/v1/courses/").catch(() => ({ data: [] })),
      identityApi.get("/api/v1/enterprise/budget").catch(() => ({ data: null })),
      identityApi.get("/api/v1/payments/invoices").catch(() => ({ data: [] }))
    ]).then(([orgRes, tRes, cRes, bRes, iRes]) => {
      // Mute errors since enterprise org detail endpoint might be different
      const brandingData = orgRes.data?.data ?? orgRes.data;
      setOrgDetails(brandingData);

      setTeams(tRes.data?.data ?? tRes.data ?? []);
      setCourses(cRes.data?.data ?? cRes.data ?? []);
      setBudget(bRes.data?.data ?? bRes.data);
      setInvoices(iRes.data?.data ?? iRes.data ?? []);
    });
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [filters.team_id, filters.course_id, filters.start_date, filters.end_date]);

  const handleExport = async (format: "pdf" | "excel") => {
    if (format === "pdf") setExportingPdf(true);
    else setExportingExcel(true);
    
    try {
      const q = new URLSearchParams();
      q.append("format", format);
      if (filters.team_id) q.append("team_id", filters.team_id);
      if (filters.course_id) q.append("course_id", filters.course_id);
      if (filters.start_date) q.append("from_date", filters.start_date);
      if (filters.end_date) q.append("to_date", filters.end_date);

      // Download file directly
      const response = await identityApi.get(`/api/v1/enterprise/reports/export?${q.toString()}`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `enterprise_report_${new Date().toISOString().split('T')[0]}.${format === 'excel' ? 'xlsx' : 'pdf'}`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast.success(`${format.toUpperCase()} report exported successfully`);
    } catch (e) {
      toast.error(`Failed to export ${format.toUpperCase()} report`);
    } finally {
      if (format === "pdf") setExportingPdf(false);
      else setExportingExcel(false);
    }
  };

  const handleDownloadInvoice = async (invoiceId: string) => {
    try {
      const response = await identityApi.get(`/api/v1/payments/invoices/${invoiceId}/pdf`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `invoice_${invoiceId}.pdf`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast.success("Invoice downloaded successfully");
    } catch (e) {
      toast.error("Failed to download invoice");
    }
  };

  const stats = [
    {
      label: "Active learners",
      value: data?.total_learners ?? orgDetails?.activeLearnersCount ?? "—",
      accent: "bg-navy",
    },
    {
      label: "Completion rate",
      value: data?.pct_completed != null 
        ? `${Math.round(data.pct_completed <= 1 ? data.pct_completed * 100 : data.pct_completed)}%` 
        : "—",
      accent: "bg-coral",
    },
    {
      label: "Avg score",
      value: data?.avg_score != null 
        ? `${Math.round(data.avg_score <= 1 ? data.avg_score * 100 : data.avg_score)}%` 
        : "—",
      accent: "bg-success",
    },
    {
      label: "At-risk learners",
      value: data?.pct_at_risk != null ? `${Math.round(data.pct_at_risk <= 1 ? data.pct_at_risk * 100 : data.pct_at_risk)}%` : "—",
      accent: "bg-destructive",
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <TopNav />
      <OrgTabs />
      <div className="container-1200 py-12 flex-1">
        <div className="mb-10 flex items-end justify-between flex-wrap gap-4">
          <div>
            <span className="label-caps text-coral mb-2 inline-block">
              {orgDetails?.name || orgDetails?.org_name || "Organisation"}
            </span>
            <h1 className="text-4xl font-bold tracking-tight">Overview</h1>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => handleExport("excel")}
              disabled={exportingExcel}
              className="h-10 px-4 bg-surface-card border border-border text-text-primary text-sm font-medium inline-flex items-center gap-2 hover:border-primary transition-colors disabled:opacity-50"
            >
              <Table size={16} /> {exportingExcel ? "Exporting..." : "Excel Report"}
            </button>
            <button
              onClick={() => handleExport("pdf")}
              disabled={exportingPdf}
              className="h-10 px-4 bg-primary text-primary-foreground text-sm font-medium inline-flex items-center gap-2 hover:bg-primary-hover transition-colors disabled:opacity-50"
            >
              <FileText size={16} /> {exportingPdf ? "Exporting..." : "PDF Report"}
            </button>
          </div>
        </div>

        {/* Filters Section */}
        <div className="card-base p-4 mb-8 bg-surface-card border border-border flex flex-wrap gap-4 items-end">
          <div className="flex items-center gap-2 text-text-secondary w-full md:w-auto">
            <Filter size={18} />
            <span className="font-semibold text-sm">Filters:</span>
          </div>
          
          <div className="flex-1 min-w-[150px]">
            <label className="text-xs font-bold text-text-secondary mb-1 block">Team</label>
            <select 
              className="w-full text-sm p-2 border border-border bg-surface rounded-sm focus:border-primary outline-none"
              value={filters.team_id}
              onChange={(e) => setFilters(f => ({ ...f, team_id: e.target.value }))}
            >
              <option value="">All Teams</option>
              {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>

          <div className="flex-1 min-w-[150px]">
            <label className="text-xs font-bold text-text-secondary mb-1 block">Course</label>
            <select 
              className="w-full text-sm p-2 border border-border bg-surface rounded-sm focus:border-primary outline-none"
              value={filters.course_id}
              onChange={(e) => setFilters(f => ({ ...f, course_id: e.target.value }))}
            >
              <option value="">All Courses</option>
              {courses.map(c => <option key={c.id} value={c.id}>{c.title || c.id}</option>)}
            </select>
          </div>

          <div className="flex-1 min-w-[130px]">
            <label className="text-xs font-bold text-text-secondary mb-1 block">Start Date</label>
            <input 
              type="date"
              className="w-full text-sm p-2 border border-border bg-surface rounded-sm focus:border-primary outline-none"
              value={filters.start_date}
              onChange={(e) => setFilters(f => ({ ...f, start_date: e.target.value }))}
            />
          </div>

          <div className="flex-1 min-w-[130px]">
            <label className="text-xs font-bold text-text-secondary mb-1 block">End Date</label>
            <input 
              type="date"
              className="w-full text-sm p-2 border border-border bg-surface rounded-sm focus:border-primary outline-none"
              value={filters.end_date}
              onChange={(e) => setFilters(f => ({ ...f, end_date: e.target.value }))}
            />
          </div>
          
          <button 
            onClick={() => setFilters({ team_id: "", course_id: "", start_date: "", end_date: "" })}
            className="text-xs font-bold text-primary hover:underline pb-2 px-2"
          >
            Clear
          </button>
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
              {mounted && data?.course_completion_rates && data.course_completion_rates.length > 0 ? (
                <div className="h-72 w-full mt-6">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={data.course_completion_rates.map(c => ({
                        course: c.course || "Unknown Course",
                        enrolled: c.enrolled,
                        completion: Math.round(c.pct <= 1 ? c.pct * 100 : c.pct)
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
              {!data?.course_completion_rates || data.course_completion_rates.length === 0 ? (
                <div className="p-8 text-center text-text-secondary text-sm">
                  No course data yet.
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-surface">
                    <tr className="text-left">
                      <th className="px-6 py-3 label-caps text-text-secondary">Course</th>
                      <th className="px-6 py-3 label-caps text-text-secondary">Enrolled</th>
                      <th className="px-6 py-3 label-caps text-text-secondary">Completion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.course_completion_rates.map((row, idx) => {
                      const compRate = Math.round(row.pct <= 1 ? row.pct * 100 : row.pct);
                      const courseTitle = row.course || `Course ${idx + 1}`;
                      return (
                        <tr key={idx} className="border-t border-border">
                          <td className="px-6 py-4 font-medium text-sm truncate max-w-[200px]" title={courseTitle}>
                            {courseTitle}
                          </td>
                          <td className="px-6 py-4">{row.enrolled}</td>
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
              <h3 className="font-bold mb-1">Billing & Budget</h3>
              <p className="text-sm text-text-secondary mb-4">Manage your corporate training spend.</p>
              
              <div className="space-y-4 text-sm">
                <div className="flex justify-between border-b border-border pb-2.5">
                  <span className="text-text-secondary">Billing Status:</span>
                  <span className="font-bold text-success">{budget?.status || "Active"}</span>
                </div>
                <div className="flex justify-between border-b border-border pb-2.5">
                  <span className="text-text-secondary">Total Budget:</span>
                  <span className="font-bold text-primary">
                    {budget?.currency || "₦"}{(budget?.budget_ngn ?? 0).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between border-b border-border pb-2.5">
                  <span className="text-text-secondary">Spend per Learner:</span>
                  <span className="text-text-primary">
                    {budget?.currency || "₦"}{(budget?.spend_per_learner ?? 0).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between border-b border-border pb-2.5">
                  <span className="text-text-secondary">Remaining Balance:</span>
                  <span className="text-text-primary">
                    {budget?.currency || "₦"}{(budget?.remaining_ngn ?? 0).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between pt-1">
                  <span className="text-text-secondary">Next Invoice:</span>
                  <span className="font-mono text-xs text-text-primary">
                    {budget?.next_invoice_date ? new Date(budget.next_invoice_date).toLocaleDateString() : "—"}
                  </span>
                </div>
              </div>
            </div>

            <div className="card-base p-0 overflow-hidden">
              <div className="px-6 py-4 border-b border-border">
                <h3 className="font-bold">Invoice History</h3>
              </div>
              <div className="divide-y divide-border text-sm">
                {invoices.length === 0 ? (
                  <div className="p-8 text-center text-text-secondary text-sm">
                    No payment history found.
                  </div>
                ) : invoices.map((inv: any) => (
                  <div key={inv.id || inv.reference} className="p-4 flex items-center justify-between hover:bg-navy/[0.02] transition-colors">
                    <div>
                      <div className="font-mono text-xs font-bold text-text-primary">{inv.id || inv.reference}</div>
                      <div className="text-xs text-text-secondary mt-0.5">{new Date(inv.date || inv.created_at).toLocaleDateString()}</div>
                    </div>
                    <div className="flex items-center gap-4 text-right">
                      <div>
                        <div className="font-semibold text-text-primary">{inv.currency || "₦"}{inv.amount?.toLocaleString()}</div>
                        <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded-sm font-bold mt-1 ${inv.status?.toLowerCase() === 'paid' ? 'bg-success/15 text-success' : 'bg-primary/15 text-primary'}`}>
                          {inv.status || "Paid"}
                        </span>
                      </div>
                      <button
                        onClick={() => handleDownloadInvoice(inv.id || inv.reference)}
                        className="p-1.5 text-text-secondary hover:text-primary hover:bg-primary/10 rounded transition-colors"
                        title="Download Invoice"
                      >
                        <Download size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card-base bg-white border border-border mt-6">
              <h3 className="font-bold mb-1">Branding & Settings</h3>
              <p className="text-sm text-text-secondary mb-4">Customise your portal appearance.</p>
              
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-text-secondary mb-1 block">Organisation Name</label>
                  <input 
                    type="text" 
                    className="w-full text-sm p-2 border border-border bg-surface rounded-sm focus:border-primary outline-none" 
                    value={brandForm.org_name}
                    onChange={(e) => setBrandForm(f => ({...f, org_name: e.target.value}))}
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-text-secondary mb-1 block">Logo URL</label>
                  <input 
                    type="text" 
                    className="w-full text-sm p-2 border border-border bg-surface rounded-sm focus:border-primary outline-none" 
                    value={brandForm.logo_url}
                    placeholder="https://example.com/logo.png"
                    onChange={(e) => setBrandForm(f => ({...f, logo_url: e.target.value}))}
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-text-secondary mb-1 block">Primary Color</label>
                  <div className="flex items-center gap-2">
                    <input 
                      type="color" 
                      className="w-10 h-10 p-1 border border-border rounded-sm cursor-pointer" 
                      value={brandForm.primary_color}
                      onChange={(e) => setBrandForm(f => ({...f, primary_color: e.target.value}))}
                    />
                    <input 
                      type="text" 
                      className="flex-1 text-sm p-2 border border-border bg-surface rounded-sm focus:border-primary outline-none" 
                      value={brandForm.primary_color}
                      onChange={(e) => setBrandForm(f => ({...f, primary_color: e.target.value}))}
                    />
                  </div>
                </div>
                <button 
                  onClick={handleSaveBranding}
                  disabled={savingBrand}
                  className="w-full h-10 mt-2 bg-primary text-primary-foreground font-medium hover:bg-primary-hover transition-colors rounded-sm disabled:opacity-60 text-sm"
                >
                  {savingBrand ? "Saving..." : "Save Branding"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
