import { createFileRoute } from "@tanstack/react-router";
import { requireOrgAdmin } from "@/lib/auth-guard";

import { useRef, useState, DragEvent, useEffect } from "react";
import { TopNav } from "@/components/TopNav";
import { OrgTabs } from "@/components/OrgTabs";
import {
  buildNotificationPayload,
  identityApi,
  contentApi,
  toIsoDateTime,
  extractErrorMessage,
  notificationsApi,
} from "@/lib/api-client";
import { useAuthStore } from "@/lib/stores";
import { toast } from "sonner";
import { Upload, Plus, X, Users, Shield, BookOpen } from "lucide-react";

export const Route = createFileRoute("/enterprise/learners")({
  beforeLoad: () => {
    requireOrgAdmin();
  },
  head: () => ({ meta: [{ title: "Manage learners — EliteCoach" }] }),
  component: ManageLearnersPage,
});

function ManageLearnersPage() {
  const user = useAuthStore((s) => s.user);
  const [activeTab, setActiveTab] = useState<"learners" | "teams" | "assignments" | "import">("learners");

  const [users, setUsers] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Import states
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{
    imported: number;
    failed: number;
    errors?: string[];
  } | null>(null);

  // Assign states
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignForm, setAssignForm] = useState({
    course_id: "",
    target_type: "org" as "org" | "team" | "learner",
    target_id: "",
    deadline: "",
  });
  const [assigning, setAssigning] = useState(false);

  // Invite states
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: "", team_id: "" });
  const [inviting, setInviting] = useState(false);

  // Team states
  const [teamOpen, setTeamOpen] = useState(false);
  const [teamForm, setTeamForm] = useState({ name: "" });
  const [creatingTeam, setCreatingTeam] = useState(false);

  // Add to team state
  const [addToTeamOpen, setAddToTeamOpen] = useState<string | null>(null);
  const [selectedTeamForUser, setSelectedTeamForUser] = useState("");

  const fetchData = async () => {
    setLoading(true);
    try {
      const [uRes, tRes, cRes, aRes] = await Promise.all([
        identityApi.get("/api/v1/enterprise/users").catch(() => ({ data: [] })),
        identityApi.get("/api/v1/enterprise/teams").catch(() => ({ data: [] })),
        contentApi.get("/api/v1/courses/").catch(() => ({ data: [] })),
        identityApi.get("/api/v1/enterprise/assignments").catch(() => ({ data: [] })),
      ]);
      setUsers(uRes.data?.data ?? uRes.data ?? []);
      setTeams(tRes.data?.data ?? tRes.data ?? []);
      setCourses(cRes.data?.data ?? cRes.data ?? []);
      setAssignments(aRes.data?.data ?? aRes.data ?? []);
    } catch (err) {
      // Ignore initial load errors
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Actions
  const handleDeactivate = async (userId: string) => {
    if (!confirm("Are you sure you want to deactivate this user?")) return;
    try {
      await identityApi.post(`/api/v1/enterprise/users/${userId}/deactivate`);
      toast.success("User deactivated");
      fetchData();
    } catch (err) {
      toast.error(extractErrorMessage(err, "Failed to deactivate user"));
    }
  };

  const handleCreateTeam = async () => {
    if (!teamForm.name.trim()) return;
    setCreatingTeam(true);
    try {
      await identityApi.post("/api/v1/enterprise/teams", { name: teamForm.name });
      toast.success("Team created");
      setTeamOpen(false);
      setTeamForm({ name: "" });
      fetchData();
    } catch (err) {
      toast.error(extractErrorMessage(err, "Failed to create team"));
    } finally {
      setCreatingTeam(false);
    }
  };

  const handleInvite = async () => {
    if (!inviteForm.email.trim()) return;
    setInviting(true);
    try {
      const payload: any = { email: inviteForm.email };
      if (inviteForm.team_id) payload.team_id = inviteForm.team_id;
      
      await identityApi.post("/api/v1/enterprise/invite", payload);
      toast.success("Invite sent");
      setInviteOpen(false);
      setInviteForm({ email: "", team_id: "" });
      fetchData();
    } catch (err) {
      toast.error(extractErrorMessage(err, "Failed to send invite"));
    } finally {
      setInviting(false);
    }
  };

  const handleAddToTeam = async (userId: string) => {
    if (!selectedTeamForUser) return;
    try {
      await identityApi.post(`/api/v1/enterprise/teams/${selectedTeamForUser}/members`, { user_ids: [userId] });
      toast.success("Added to team");
      setAddToTeamOpen(null);
      setSelectedTeamForUser("");
      fetchData();
    } catch (err) {
      toast.error(extractErrorMessage(err, "Failed to add to team"));
    }
  };

  const handleUpload = async (file: File) => {
    setImporting(true);
    try {
      const fd = new FormData();
      fd.append("csvFile", file);
      const res = await identityApi.post(
        `/api/v1/enterprise/users/import`,
        fd,
        { headers: { "Content-Type": "multipart/form-data" } },
      );
      const data = res.data?.data ?? res.data;
      setResult({
        imported: data?.imported ?? data?.successCount ?? 0,
        failed: data?.failed ?? data?.failureCount ?? 0,
        errors: data?.errors ?? [],
      });
      toast.success("Import complete");
      fetchData();
    } catch (err) {
      toast.error(extractErrorMessage(err, "Import failed"));
    } finally {
      setImporting(false);
    }
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleUpload(f);
  };

  const submitAssign = async () => {
    if (!assignForm.course_id) {
      toast.error("Please select a course");
      return;
    }
    if (assignForm.target_type !== "org" && !assignForm.target_id) {
      toast.error("Please select a target team or learner");
      return;
    }

    setAssigning(true);
    try {
      const payload: any = {
        course_id: assignForm.course_id,
        assignee_type: assignForm.target_type === "learner" ? "user" : assignForm.target_type,
      };
      
      if (assignForm.target_type !== "org") {
        payload.assignee_id = assignForm.target_id;
      }
      if (assignForm.deadline) {
        const iso = toIsoDateTime(assignForm.deadline);
        payload.deadline = iso ? iso.split('T')[0] : assignForm.deadline;
      }

      await identityApi.post(`/api/v1/enterprise/assignments`, payload);
      toast.success("Course assigned");
      setAssignOpen(false);
      setAssignForm({ course_id: "", target_type: "org", target_id: "", deadline: "" });
      fetchData();
    } catch (err) {
      toast.error(extractErrorMessage(err, "Assignment failed"));
    } finally {
      setAssigning(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <TopNav />
      <OrgTabs />
      <div className="container-1200 py-12 flex-1">
        <div className="flex items-end justify-between mb-8 flex-wrap gap-4">
          <div>
            <span className="label-caps text-coral mb-2 inline-block">
              Organisation
            </span>
            <h1 className="text-4xl font-bold tracking-tight">
              Manage Setup & Teams
            </h1>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setAssignOpen(true)}
              className="h-11 px-4 bg-surface-card border border-border text-text-primary font-medium inline-flex items-center gap-2 hover:border-primary transition-colors"
            >
              <Shield size={16} /> Assign Course
            </button>
            <button
              onClick={() => setInviteOpen(true)}
              className="h-11 px-4 bg-primary text-primary-foreground font-medium inline-flex items-center gap-2 hover:bg-primary-hover transition-colors"
            >
              <Plus size={16} /> Invite User
            </button>
          </div>
        </div>

        <div className="flex gap-6 border-b border-border mb-8 overflow-x-auto">
          {(["learners", "teams", "assignments", "import"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-3 border-b-2 font-medium capitalize whitespace-nowrap transition-colors ${
                activeTab === tab
                  ? "border-primary text-primary"
                  : "border-transparent text-text-secondary hover:text-text-primary"
              }`}
            >
              {tab === "import" ? "Bulk Import" : tab}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="animate-pulse flex space-x-4">
            <div className="flex-1 space-y-4 py-1">
              <div className="h-4 bg-border rounded w-3/4"></div>
              <div className="space-y-2">
                <div className="h-4 bg-border rounded"></div>
                <div className="h-4 bg-border rounded w-5/6"></div>
              </div>
            </div>
          </div>
        ) : (
          <>
            {activeTab === "learners" && (
              <div className="card-base p-0 overflow-hidden">
                <div className="px-6 py-4 border-b border-border flex justify-between items-center">
                  <h3 className="font-semibold">Learners List</h3>
                  <span className="text-sm text-text-secondary">{users.length} users</span>
                </div>
                {users.length === 0 ? (
                  <div className="p-12 text-center text-text-secondary text-sm">
                    No learners found. Invite users or upload a CSV to get started.
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-surface">
                      <tr className="text-left">
                        <th className="px-6 py-3 label-caps text-text-secondary">Name</th>
                        <th className="px-6 py-3 label-caps text-text-secondary">Email</th>
                        <th className="px-6 py-3 label-caps text-text-secondary">Status</th>
                        <th className="px-6 py-3 label-caps text-text-secondary text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {users.map((u) => (
                        <tr key={u.id} className="hover:bg-surface-hover transition-colors">
                          <td className="px-6 py-4 font-medium">{u.full_name || "N/A"}</td>
                          <td className="px-6 py-4 font-mono text-xs">{u.email}</td>
                          <td className="px-6 py-4">
                            <span className={`inline-block px-2 py-1 text-[10px] font-bold rounded-sm ${u.is_active ? 'bg-success/15 text-success' : 'bg-destructive/15 text-destructive'}`}>
                              {u.is_active ? "ACTIVE" : "INACTIVE"}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right space-x-3 relative">
                            <button
                              onClick={() => setAddToTeamOpen(addToTeamOpen === u.id ? null : u.id)}
                              className="text-xs text-primary hover:underline font-medium"
                            >
                              Add to Team
                            </button>
                            {u.is_active && (
                              <button
                                onClick={() => handleDeactivate(u.id)}
                                className="text-xs text-destructive hover:underline font-medium"
                              >
                                Deactivate
                              </button>
                            )}
                            
                            {addToTeamOpen === u.id && (
                              <div className="absolute right-8 mt-2 w-64 bg-surface-card border border-border p-4 rounded shadow-lg z-10 text-left">
                                <h4 className="text-xs font-bold mb-2">Select Team</h4>
                                <select 
                                  value={selectedTeamForUser} 
                                  onChange={(e) => setSelectedTeamForUser(e.target.value)}
                                  className="w-full text-sm p-2 border border-border mb-3 bg-surface"
                                >
                                  <option value="">-- Choose Team --</option>
                                  {teams.map(t => (
                                    <option key={t.id} value={t.id}>{t.name}</option>
                                  ))}
                                </select>
                                <div className="flex justify-end gap-2">
                                  <button onClick={() => setAddToTeamOpen(null)} className="text-xs text-text-secondary px-2 py-1">Cancel</button>
                                  <button onClick={() => handleAddToTeam(u.id)} disabled={!selectedTeamForUser} className="text-xs bg-primary text-white px-3 py-1 rounded-sm disabled:opacity-50">Save</button>
                                </div>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {activeTab === "teams" && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-lg font-bold">Teams & Departments</h2>
                  <button
                    onClick={() => setTeamOpen(true)}
                    className="h-9 px-3 bg-primary text-primary-foreground text-sm font-medium inline-flex items-center gap-2 hover:bg-primary-hover transition-colors"
                  >
                    <Users size={14} /> Create Team
                  </button>
                </div>
                
                {teams.length === 0 ? (
                  <div className="card-base p-12 text-center text-text-secondary text-sm">
                    No teams created yet.
                  </div>
                ) : (
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {teams.map((t) => (
                      <div key={t.id} className="card-base hover:border-primary/50 transition-colors">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-10 h-10 bg-primary/10 text-primary rounded-full flex items-center justify-center">
                            <Users size={18} />
                          </div>
                          <div>
                            <h3 className="font-bold">{t.name}</h3>
                            <p className="text-xs font-mono text-text-secondary">{t.id.slice(0,8)}</p>
                          </div>
                        </div>
                        <button onClick={() => {
                          setAssignForm(f => ({...f, target_type: "team", target_id: t.id}));
                          setAssignOpen(true);
                        }} className="text-sm text-primary font-medium hover:underline">
                          Assign Course to Team
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === "assignments" && (
              <div className="card-base p-0 overflow-hidden">
                <div className="px-6 py-4 border-b border-border flex justify-between items-center">
                  <h3 className="font-semibold">Course Assignments</h3>
                  <button onClick={() => setAssignOpen(true)} className="text-sm text-primary font-medium hover:underline">
                    + New Assignment
                  </button>
                </div>
                {assignments.length === 0 ? (
                  <div className="p-12 text-center text-text-secondary text-sm">
                    No assignments found. Click "New Assignment" to create one.
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-surface">
                      <tr className="text-left">
                        <th className="px-6 py-3 label-caps text-text-secondary">Course ID</th>
                        <th className="px-6 py-3 label-caps text-text-secondary">Target</th>
                        <th className="px-6 py-3 label-caps text-text-secondary">Deadline</th>
                        <th className="px-6 py-3 label-caps text-text-secondary text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {assignments.map((a, i) => (
                        <tr key={i} className="hover:bg-surface-hover transition-colors">
                          <td className="px-6 py-4 font-mono text-xs font-medium">{a.course_id || a.courseId || "Unknown"}</td>
                          <td className="px-6 py-4">
                            {a.target_type === 'org' ? 'Entire Organization' : a.target_id || "Multiple"}
                          </td>
                          <td className="px-6 py-4">{a.deadline ? new Date(a.deadline).toLocaleDateString() : "No Deadline"}</td>
                          <td className="px-6 py-4 text-right">
                            <span className="inline-block px-2 py-1 text-[10px] font-bold rounded-sm bg-success/15 text-success">
                              ACTIVE
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {activeTab === "import" && (
              <div className="max-w-3xl">
                <div className="card-base card-interactive reveal-card mb-6">
                  <h3 className="font-semibold mb-2">Bulk import learners</h3>
                  <p className="text-sm text-text-secondary mb-6">
                    Upload a CSV with columns: email, full_name, phone (optional).
                  </p>
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOver(true);
                    }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={onDrop}
                    onClick={() => fileRef.current?.click()}
                    className={`border-2 border-dashed p-12 text-center cursor-pointer transition-colors ${
                      dragOver
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/40"
                    }`}
                  >
                    <Upload className="mx-auto mb-3 text-text-secondary" size={28} />
                    <p className="font-medium mb-1">
                      {importing ? "Uploading..." : "Drop CSV here or click to upload"}
                    </p>
                    <p className="text-xs text-text-secondary">
                      Max 10MB · CSV format only
                    </p>
                    <input
                      ref={fileRef}
                      type="file"
                      accept=".csv"
                      hidden
                      onChange={(e) =>
                        e.target.files?.[0] && handleUpload(e.target.files[0])
                      }
                    />
                  </div>
                </div>

                {result && (
                  <div
                    className="card-base card-interactive reveal-card"
                    style={{ animationDelay: "80ms" }}
                  >
                    <h3 className="font-semibold mb-3">Import result</h3>
                    <div className="flex gap-4 mb-4">
                      <span className="px-3 py-1.5 bg-success/10 text-success label-caps rounded-sm">
                        {result.imported} imported
                      </span>
                      <span className="px-3 py-1.5 bg-destructive/10 text-destructive label-caps rounded-sm">
                        {result.failed} failed
                      </span>
                    </div>
                    {result.errors && result.errors.length > 0 && (
                      <details className="text-sm">
                        <summary className="cursor-pointer text-text-secondary">
                          View errors
                        </summary>
                        <ul className="mt-3 space-y-1 font-mono text-xs">
                          {result.errors.map((e, i) => (
                            <li key={i} className="text-destructive break-words">
                              {e}
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Modals */}

      {assignOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-surface-card w-full max-w-lg p-8 rounded-lg relative shadow-xl">
            <button
              onClick={() => setAssignOpen(false)}
              className="absolute top-4 right-4 text-text-secondary hover:text-text-primary"
            >
              <X size={20} />
            </button>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-primary/10 text-primary flex items-center justify-center rounded-full">
                <BookOpen size={20} />
              </div>
              <h2 className="text-xl font-bold">Assign Course</h2>
            </div>
            
            <div className="space-y-5">
              <div>
                <label className="label-caps text-text-secondary block mb-2">
                  Select Course
                </label>
                <select
                  value={assignForm.course_id}
                  onChange={(e) =>
                    setAssignForm((f) => ({ ...f, course_id: e.target.value }))
                  }
                  className="w-full h-12 px-4 border border-border focus:border-primary outline-none text-sm bg-surface rounded-sm"
                >
                  <option value="">-- Choose Course --</option>
                  {courses.map(c => (
                    <option key={c.id} value={c.id}>{c.title || c.id}</option>
                  ))}
                  {/* Fallback option if courses are empty */}
                  {courses.length === 0 && (
                    <option disabled>No courses available</option>
                  )}
                </select>
              </div>

              <div>
                <label className="label-caps text-text-secondary block mb-2">
                  Target Group
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {(["org", "team", "learner"] as const).map(type => (
                    <label key={type} className={`cursor-pointer border p-3 rounded-sm text-center text-sm transition-colors ${assignForm.target_type === type ? 'border-primary bg-primary/5 text-primary font-medium' : 'border-border text-text-secondary hover:border-primary/50'}`}>
                      <input 
                        type="radio" 
                        name="target_type" 
                        value={type} 
                        checked={assignForm.target_type === type}
                        onChange={(e) => setAssignForm(f => ({ ...f, target_type: e.target.value as any, target_id: "" }))} 
                        className="hidden" 
                      />
                      {type === "org" ? "Entire Org" : type === "team" ? "Specific Team" : "Specific Learner"}
                    </label>
                  ))}
                </div>
              </div>

              {assignForm.target_type === "team" && (
                <div className="animate-in fade-in slide-in-from-top-2">
                  <label className="label-caps text-text-secondary block mb-2">
                    Select Team
                  </label>
                  <select
                    value={assignForm.target_id}
                    onChange={(e) =>
                      setAssignForm((f) => ({ ...f, target_id: e.target.value }))
                    }
                    className="w-full h-12 px-4 border border-border focus:border-primary outline-none text-sm bg-surface rounded-sm"
                  >
                    <option value="">-- Choose Team --</option>
                    {teams.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {assignForm.target_type === "learner" && (
                <div className="animate-in fade-in slide-in-from-top-2">
                  <label className="label-caps text-text-secondary block mb-2">
                    Select Learner
                  </label>
                  <select
                    value={assignForm.target_id}
                    onChange={(e) =>
                      setAssignForm((f) => ({ ...f, target_id: e.target.value }))
                    }
                    className="w-full h-12 px-4 border border-border focus:border-primary outline-none text-sm bg-surface rounded-sm"
                  >
                    <option value="">-- Choose Learner --</option>
                    {users.filter(u => u.is_active).map(u => (
                      <option key={u.id} value={u.id}>{u.full_name || u.email}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="label-caps text-text-secondary block mb-2">
                  Deadline <span className="text-text-secondary font-normal normal-case">(Optional)</span>
                </label>
                <input
                  type="date"
                  value={assignForm.deadline}
                  onChange={(e) =>
                    setAssignForm((f) => ({ ...f, deadline: e.target.value }))
                  }
                  className="w-full h-12 px-4 border border-border focus:border-primary outline-none rounded-sm"
                />
              </div>

              <button
                onClick={submitAssign}
                disabled={assigning}
                className="w-full h-12 mt-2 bg-primary text-primary-foreground font-medium hover:bg-primary-hover transition-colors rounded-sm disabled:opacity-60"
              >
                {assigning ? "Assigning..." : "Assign Course"}
              </button>
            </div>
          </div>
        </div>
      )}

      {inviteOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-surface-card w-full max-w-lg p-8 rounded-lg relative">
            <button
              onClick={() => setInviteOpen(false)}
              className="absolute top-4 right-4 text-text-secondary hover:text-text-primary"
            >
              <X size={20} />
            </button>
            <h2 className="text-xl font-bold mb-6">Invite User</h2>
            <div className="space-y-4">
              <div>
                <label className="label-caps text-text-secondary block mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={inviteForm.email}
                  onChange={(e) =>
                    setInviteForm((f) => ({ ...f, email: e.target.value }))
                  }
                  className="w-full h-12 px-4 border border-border focus:border-primary outline-none text-sm rounded-sm"
                  placeholder="user@company.com"
                />
              </div>
              <div>
                <label className="label-caps text-text-secondary block mb-2">
                  Assign to Team <span className="text-text-secondary font-normal normal-case">(Optional)</span>
                </label>
                <select
                  value={inviteForm.team_id}
                  onChange={(e) =>
                    setInviteForm((f) => ({ ...f, team_id: e.target.value }))
                  }
                  className="w-full h-12 px-4 border border-border focus:border-primary outline-none text-sm bg-surface rounded-sm"
                >
                  <option value="">-- No Team --</option>
                  {teams.map(t => (
                     <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={handleInvite}
                disabled={inviting || !inviteForm.email}
                className="w-full h-12 bg-primary text-primary-foreground font-medium hover:bg-primary-hover transition-colors rounded-sm disabled:opacity-60"
              >
                {inviting ? "Sending..." : "Send Invite"}
              </button>
            </div>
          </div>
        </div>
      )}

      {teamOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-surface-card w-full max-w-lg p-8 rounded-lg relative">
            <button
              onClick={() => setTeamOpen(false)}
              className="absolute top-4 right-4 text-text-secondary hover:text-text-primary"
            >
              <X size={20} />
            </button>
            <h2 className="text-xl font-bold mb-6">Create Team</h2>
            <div className="space-y-4">
              <div>
                <label className="label-caps text-text-secondary block mb-2">
                  Team Name
                </label>
                <input
                  value={teamForm.name}
                  onChange={(e) =>
                    setTeamForm((f) => ({ ...f, name: e.target.value }))
                  }
                  className="w-full h-12 px-4 border border-border focus:border-primary outline-none text-sm rounded-sm"
                  placeholder="e.g. Engineering, Sales"
                />
              </div>
              <button
                onClick={handleCreateTeam}
                disabled={creatingTeam || !teamForm.name}
                className="w-full h-12 bg-primary text-primary-foreground font-medium hover:bg-primary-hover transition-colors rounded-sm disabled:opacity-60"
              >
                {creatingTeam ? "Creating..." : "Create Team"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
