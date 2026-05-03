import { createFileRoute } from "@tanstack/react-router";
import { requireOrgAdmin } from "@/lib/auth-guard";
import { useOrgStore } from "@/lib/stores";
import { useRef, useState, DragEvent } from "react";
import { TopNav } from "@/components/TopNav";
import { OrgTabs } from "@/components/OrgTabs";
import {
  buildNotificationPayload,
  identityApi,
  toIsoDateTime,
  extractErrorMessage,
  notificationsApi,
} from "@/lib/api-client";
import { useAuthStore } from "@/lib/stores";
import { toast } from "sonner";
import { Upload, Plus, X } from "lucide-react";

export const Route = createFileRoute("/org/$orgId/learners")({
  beforeLoad: ({ params }) => {
    requireOrgAdmin();
    useOrgStore.getState().setOrg({ organizationId: params.orgId });
  },
  head: () => ({ meta: [{ title: "Manage learners — EliteCoach" }] }),
  component: ManageLearnersPage,
});

function ManageLearnersPage() {
  const { orgId } = Route.useParams();
  const user = useAuthStore((s) => s.user);
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{
    imported: number;
    failed: number;
    errors?: string[];
  } | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignForm, setAssignForm] = useState({
    course_id: "",
    learners: "",
    deadline: "",
  });
  const [assigning, setAssigning] = useState(false);

  const handleUpload = async (file: File) => {
    setImporting(true);
    try {
      const fd = new FormData();
      fd.append("csvFile", file);
      const res = await identityApi.post(
        `/api/v1/organizations/${orgId}/import-learners`,
        fd,
        { headers: { "Content-Type": "multipart/form-data" } },
      );
      const data = res.data?.data ?? res.data;
      setResult({
        imported: data?.imported ?? data?.successCount ?? 0,
        failed: data?.failed ?? data?.failureCount ?? 0,
        errors: data?.errors ?? [],
      });
      notificationsApi
        .post(
          "/api/v1/notification/send",
          buildNotificationPayload({
            to: user?.email,
            subject: "Import complete",
            body: `${data?.imported ?? 0} learners imported`,
          }),
        )
        .catch(() => {});
      toast.success("Import complete");
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
    setAssigning(true);
    try {
      await identityApi.post(`/api/v1/organizations/${orgId}/assign-course`, {
        courseId: assignForm.course_id,
        learnersOrTeamIds: assignForm.learners
          .split(",")
          .map((l) => l.trim())
          .filter(Boolean),
        deadline: toIsoDateTime(assignForm.deadline),
      });
      toast.success("Course assigned");
      setAssignOpen(false);
      setAssignForm({ course_id: "", learners: "", deadline: "" });
    } catch (err) {
      toast.error(extractErrorMessage(err, "Assignment failed"));
    } finally {
      setAssigning(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <TopNav />
      <OrgTabs orgId={orgId} />
      <div className="container-1200 py-12 flex-1">
        <div className="flex items-end justify-between mb-10 flex-wrap gap-4">
          <div>
            <span className="label-caps text-coral mb-2 inline-block">
              Organisation
            </span>
            <h1 className="text-4xl font-bold tracking-tight">
              Manage learners
            </h1>
          </div>
          <button
            onClick={() => setAssignOpen(true)}
            className="h-11 px-4 bg-primary text-primary-foreground font-medium inline-flex items-center gap-2 hover:bg-primary-hover transition-colors"
          >
            <Plus size={16} /> Assign course
          </button>
        </div>

        <div className="card-base card-interactive reveal-card mb-6">
          <h3 className="font-semibold mb-2">Bulk import learners</h3>
          <p className="text-sm text-text-secondary mb-6">
            Upload a CSV with columns: email, firstName, lastName.
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
                    <li key={i} className="text-destructive">
                      {e}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}
      </div>

      {assignOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-surface-card w-full max-w-lg p-8 rounded-lg relative">
            <button
              onClick={() => setAssignOpen(false)}
              className="absolute top-4 right-4 text-text-secondary"
            >
              <X size={20} />
            </button>
            <h2 className="text-xl font-bold mb-6">Assign course</h2>
            <div className="space-y-4">
              <div>
                <label className="label-caps text-text-secondary block mb-2">
                  Course ID (UUID)
                </label>
                <input
                  value={assignForm.course_id}
                  onChange={(e) =>
                    setAssignForm((f) => ({ ...f, course_id: e.target.value }))
                  }
                  className="w-full h-12 px-4 border border-border focus:border-primary outline-none font-mono text-sm"
                />
              </div>
              <div>
                <label className="label-caps text-text-secondary block mb-2">
                  Learner IDs (comma-separated)
                </label>
                <textarea
                  value={assignForm.learners}
                  onChange={(e) =>
                    setAssignForm((f) => ({ ...f, learners: e.target.value }))
                  }
                  rows={3}
                  className="w-full px-4 py-3 border border-border focus:border-primary outline-none font-mono text-sm"
                />
              </div>
              <div>
                <label className="label-caps text-text-secondary block mb-2">
                  Deadline
                </label>
                <input
                  type="date"
                  value={assignForm.deadline}
                  onChange={(e) =>
                    setAssignForm((f) => ({ ...f, deadline: e.target.value }))
                  }
                  className="w-full h-12 px-4 border border-border focus:border-primary outline-none"
                />
              </div>
              <button
                onClick={submitAssign}
                disabled={assigning}
                className="w-full h-12 bg-primary text-primary-foreground font-medium hover:bg-primary-hover transition-colors disabled:opacity-60"
              >
                {assigning ? "Assigning..." : "Assign course"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
