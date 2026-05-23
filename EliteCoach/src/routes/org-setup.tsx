import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, FormEvent } from "react";
import { AuthLayout } from "@/components/AuthLayout";
import { createOrganization, extractErrorMessage } from "@/lib/api-client";
import { useOrgStore } from "@/lib/stores";
import { toast } from "sonner";

export const Route = createFileRoute("/org-setup")({
  head: () => ({
    meta: [
      { title: "Set up your Organization — EliteCoach" },
      { name: "description", content: "Create your organization workspace." },
    ],
  }),
  component: OrgSetupPage,
});

function OrgSetupPage() {
  const navigate = useNavigate();
  const setOrg = useOrgStore((s) => s.setOrg);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    industry: "",
    country: "",
    website: "",
    planTier: "enterprise_pro",
  });

  const update = (k: keyof typeof form, v: string) =>
    setForm((s) => ({ ...s, [k]: v }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await createOrganization(form);
      setOrg({ organizationId: res.organizationId, planTier: res.planTier });
      toast.success("Organization created successfully.");
      navigate({ to: "/org/$orgId/dashboard", params: { orgId: res.organizationId } });
    } catch (err) {
      console.error("[OrgSetup] Failed to create organization:", err);
      toast.error(extractErrorMessage(err, "Failed to create organization"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Create your Workspace"
      subtitle="Set up your enterprise organization to start inviting learners."
    >
      <form onSubmit={submit} className="space-y-5">
        <div>
          <label className="label-caps text-text-secondary block mb-2">Organization Name</label>
          <input
            required
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
            className="w-full h-12 px-4 border border-border focus:border-primary outline-none"
            placeholder="Acme Corp"
          />
        </div>
        <div>
          <label className="label-caps text-text-secondary block mb-2">Industry</label>
          <select
            required
            value={form.industry}
            onChange={(e) => update("industry", e.target.value)}
            className="w-full h-12 px-4 border border-border focus:border-primary outline-none bg-background text-text-primary"
          >
            <option value="" disabled>Select an industry</option>
            <option value="Technology">Technology</option>
            <option value="Finance">Finance</option>
            <option value="Healthcare">Healthcare</option>
            <option value="Education">Education</option>
            <option value="Retail">Retail</option>
            <option value="Other">Other</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label-caps text-text-secondary block mb-2">Country</label>
            <input
              required
              value={form.country}
              onChange={(e) => update("country", e.target.value)}
              className="w-full h-12 px-4 border border-border focus:border-primary outline-none"
              placeholder="e.g. Nigeria"
            />
          </div>
          <div>
            <label className="label-caps text-text-secondary block mb-2">Website</label>
            <input
              type="url"
              required
              value={form.website}
              onChange={(e) => update("website", e.target.value)}
              className="w-full h-12 px-4 border border-border focus:border-primary outline-none"
              placeholder="https://acme.com"
            />
          </div>
        </div>
        
        <button
          type="submit"
          disabled={loading}
          className="w-full h-12 bg-primary text-primary-foreground font-medium hover:bg-primary-hover transition-colors disabled:opacity-60 mt-4"
        >
          {loading ? "Creating..." : "Complete Setup →"}
        </button>
      </form>
    </AuthLayout>
  );
}
