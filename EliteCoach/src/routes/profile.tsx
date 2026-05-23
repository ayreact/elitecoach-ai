import { createFileRoute } from "@tanstack/react-router";
import { requireAuth } from "@/lib/auth-guard";
import { useEffect, useState } from "react";
import { TopNav } from "@/components/TopNav";
import { Footer } from "@/components/Footer";
import {
  identityApi,
  acsApi,
  notificationsApi,
  extractErrorMessage,
  unwrapApiData,
  unwrapApiList,
} from "@/lib/api-client";
import { type AuthUser, useAuthStore } from "@/lib/stores";
import { toast } from "sonner";

export const Route = createFileRoute("/profile")({
  beforeLoad: () => { requireAuth(); },
  head: () => ({ meta: [{ title: "Profile & settings — EliteCoach" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const [form, setForm] = useState({
    firstName: user?.firstName ?? "",
    lastName: user?.lastName ?? "",
    email: user?.email ?? "",
  });
  const [prefs, setPrefs] = useState({ email: true, in_app: true });
  const [saving, setSaving] = useState(false);
  const profileEditingSupported = false;
  const [certs, setCerts] = useState<any[]>([]);
  const [skillGap, setSkillGap] = useState<any>(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState("free");

  useEffect(() => {
    if (!user) return;
    const userId = user.id ?? user.userId ?? "learner";
    const sub = localStorage.getItem(`elitecoach.subscription.${userId}`);
    if (sub === "premium") {
      setSubscriptionStatus("premium");
    }

    const script = document.createElement("script");
    script.src = "https://js.paystack.co/v1/inline.js";
    script.async = true;
    document.body.appendChild(script);

    return () => {
      try {
        document.body.removeChild(script);
      } catch (e) {}
    };
  }, [user]);

  const handlePaystackPayment = () => {
    if (!(window as any).PaystackPop) {
      toast.error("Paystack SDK not loaded yet. Please wait a moment.");
      return;
    }
    
    const handler = (window as any).PaystackPop.setup({
      key: "pk_test_d3a5a7698544bd0db514ea40f6087b3a763806ba",
      email: form.email || user?.email || "learner@elitecoach.ai",
      amount: 10000 * 100, // 10,000 NGN in kobo
      currency: "NGN",
      callback: function(response: any) {
        toast.success("Upgrade successful! You are now an EliteCoach Premium member.");
        const userId = user?.id ?? user?.userId ?? "learner";
        localStorage.setItem(`elitecoach.subscription.${userId}`, "premium");
        setSubscriptionStatus("premium");

        // send notification email/WhatsApp
        try {
          notificationsApi.post(
            "/api/v1/notification/send",
            {
              channel: "email",
              to: form.email || user?.email,
              subject: "Premium Membership Activated — EliteCoach",
              body: `Hello ${form.firstName || "Learner"},\n\nYour Premium subscription has been successfully activated. Transaction Reference: ${response.reference}.\n\nStart learning with unlimited AI Tutoring and verified certificates now!`
            }
          ).catch(() => {});
        } catch (e) {}
      },
      onClose: function() {
        toast.info("Payment checkout cancelled.");
      }
    });
    handler.openIframe();
  };

  useEffect(() => {
    Promise.all([
      acsApi.get("/v1/assessment/certificates/").catch(() => ({ data: [] })),
      acsApi.get("/v1/assessment/stats/skill-gap").catch(() => ({ data: null })),
    ]).then(([certRes, gapRes]) => {
      const certList = unwrapApiList(certRes.data);
      setCerts(certList);
      const gapData = unwrapApiData(gapRes.data);
      setSkillGap(gapData);
    }).catch((err) => {
      console.warn("Could not load profile data", err);
    });
  }, []);

  useEffect(() => {
    identityApi
      .get("/api/v1/users/profile")
      .then((res) => {
        const data = unwrapApiData<Record<string, unknown> | null>(res.data);
        if (data) {
          setForm({
            firstName:
              typeof data.firstName === "string"
                ? data.firstName
                : (user?.firstName ?? ""),
            lastName:
              typeof data.lastName === "string"
                ? data.lastName
                : (user?.lastName ?? ""),
            email:
              typeof data.email === "string" ? data.email : (user?.email ?? ""),
          });
          if (data.userType || data.id) {
            const nextUser: AuthUser = {
              ...(user ?? {
                email:
                  typeof data.email === "string" ? data.email : "unknown@user",
              }),
              email:
                typeof data.email === "string"
                  ? data.email
                  : (user?.email ?? "unknown@user"),
              firstName:
                typeof data.firstName === "string"
                  ? data.firstName
                  : user?.firstName,
              lastName:
                typeof data.lastName === "string"
                  ? data.lastName
                  : user?.lastName,
              userType:
                typeof data.userType === "string"
                  ? data.userType
                  : user?.userType,
              id: typeof data.id === "string" ? data.id : user?.id,
            };
            setUser(nextUser);
          }
        }
      })
      .catch(() => {
        if (user)
          setForm({
            firstName: user.firstName ?? "",
            lastName: user.lastName ?? "",
            email: user.email,
          });
      });
  }, [setUser, user]);

  const save = async () => {
    if (!profileEditingSupported) {
      toast.error("Profile editing is not available from the backend yet.");
      return;
    }
    setSaving(true);
    try {
      await identityApi.put("/api/v1/users/profile", form);
      toast.success("Profile updated");
      if (user) setUser({ ...user, ...form });
    } catch (err) {
      toast.error(extractErrorMessage(err, "Could not save profile"));
    } finally {
      setSaving(false);
    }
  };

  const togglePref = async (k: "email" | "in_app", v: boolean) => {
    const nextPrefs = { ...prefs, [k]: v };
    setPrefs(nextPrefs);
    try {
      await notificationsApi.post(
        "/api/v1/notification/preferences",
        JSON.stringify(nextPrefs),
      );
      toast.success("Preferences saved");
    } catch {
      // silent
    }
  };

  const initials =
    `${form.firstName?.[0] ?? ""}${form.lastName?.[0] ?? ""}`.toUpperCase() ||
    "U";

  const isTutor = user?.userType === "TUTOR";

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <TopNav />
      <div className="container-1200 py-12 flex-1">
        <div className="mb-10">
          <span className="label-caps text-coral mb-2 inline-block">
            Account
          </span>
          <h1 className="text-4xl font-bold tracking-tight">
            Profile & settings
          </h1>
        </div>

        <div className="grid lg:grid-cols-[280px_1fr] gap-8">
          <aside className="card-base text-center">
            <div className="w-24 h-24 mx-auto rounded-full bg-primary text-white flex items-center justify-center text-2xl font-bold mb-4">
              {initials}
            </div>
            <h2 className="text-xl font-semibold">
              {form.firstName} {form.lastName}
            </h2>
            <p className="text-sm text-text-secondary mt-1">{form.email}</p>
            <span className="label-caps inline-block mt-4 px-3 py-1 bg-surface text-text-secondary rounded-sm">
              {user?.userType ?? "Learner"}
            </span>
          </aside>

          <div className="space-y-6">
            <div className="card-base">
              <h3 className="font-semibold mb-1">Personal details</h3>
              <p className="text-sm text-text-secondary mb-6">
                Update your name and contact info.
              </p>
              {!profileEditingSupported && (
                <div className="mb-4 rounded-sm border border-border bg-surface px-4 py-3 text-sm text-text-secondary">
                  Profile editing is not available yet. You can view your
                  profile data here, but updates are disabled until the backend
                  exposes a write endpoint.
                </div>
              )}
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="label-caps text-text-secondary block mb-2">
                    First name
                  </label>
                  <input
                    value={form.firstName}
                    onChange={(e) =>
                      setForm({ ...form, firstName: e.target.value })
                    }
                    disabled={!profileEditingSupported}
                    className="w-full h-12 px-4 border border-border focus:border-primary outline-none"
                  />
                </div>
                <div>
                  <label className="label-caps text-text-secondary block mb-2">
                    Last name
                  </label>
                  <input
                    value={form.lastName}
                    onChange={(e) =>
                      setForm({ ...form, lastName: e.target.value })
                    }
                    disabled={!profileEditingSupported}
                    className="w-full h-12 px-4 border border-border focus:border-primary outline-none"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="label-caps text-text-secondary block mb-2">
                    Email
                  </label>
                  <input
                    value={form.email}
                    disabled
                    className="w-full h-12 px-4 border border-border bg-surface text-text-secondary"
                  />
                </div>
              </div>
              <button
                onClick={save}
                disabled={saving || !profileEditingSupported}
                className="mt-6 h-11 px-5 bg-primary text-primary-foreground font-medium hover:bg-primary-hover transition-colors disabled:opacity-60"
              >
                {profileEditingSupported
                  ? saving
                    ? "Saving..."
                    : "Save changes"
                  : "Editing unavailable"}
              </button>
            </div>

            {!isTutor && (
              <div className="card-base relative overflow-hidden bg-gradient-to-br from-navy to-[#1f283d] text-white border-navy shadow-lg">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-2xl pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-coral/10 rounded-full blur-2xl pointer-events-none" />
                
                <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                  <div className="flex-1">
                    <span className="label-caps text-coral mb-2 inline-block">Subscription & Plans</span>
                    <h3 className="text-2xl font-bold text-white mb-2">
                      {subscriptionStatus === "premium" ? "Premium Membership Active" : "Get Premium Membership"}
                    </h3>
                    <p className="text-white/70 text-sm max-w-md leading-relaxed">
                      {subscriptionStatus === "premium"
                        ? "Thank you for supporting EliteCoach. You have unlimited access to all courses, diagnostic evaluations, RAG AI tutors, and custom certifications."
                        : "Unlock unlimited chats with your personal AI tutors, customized learning paths, and fully verified professional certificates for career advancement."}
                    </p>
                    
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-4 text-xs text-white/60 font-mono">
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-success" /> Unlimited AI tutor chats
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-success" /> Custom career pathways
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-success" /> Digital certification
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0 w-full md:w-auto text-center md:text-right border-t border-white/10 md:border-t-0 pt-4 md:pt-0">
                    <div className="mb-3">
                      <span className="text-3xl font-extrabold text-white">₦10,000</span>
                      <span className="text-white/60 text-xs"> / month</span>
                    </div>
                    {subscriptionStatus === "premium" ? (
                      <span className="inline-flex items-center gap-1.5 px-4 py-2 bg-success/20 text-success border border-success/30 rounded text-sm font-bold justify-center">
                        <span className="w-2 h-2 rounded-full bg-success animate-ping shrink-0" /> Premium Plan
                      </span>
                    ) : (
                      <button
                        onClick={handlePaystackPayment}
                        className="w-full md:w-auto h-11 px-6 bg-coral text-white font-bold hover:bg-coral/90 transition-all rounded shadow-md cursor-pointer"
                      >
                        Upgrade via Paystack
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {!isTutor && (
              <div className="card-base">
                <h3 className="font-semibold mb-1">Skill Gap Analysis</h3>
                <p className="text-sm text-text-secondary mb-6">
                  Your progress towards your career goal.
                </p>
                {skillGap ? (
                  <div className="space-y-4">
                    <p><strong>Career Goal:</strong> {skillGap.career_goal || "Not set"}</p>
                    <p><strong>Learning Velocity:</strong> {skillGap.learning_velocity || 0} points/week</p>
                    <div>
                      <p className="font-medium mb-2">Skill Gaps:</p>
                      {Object.keys(skillGap.skill_gap_analysis || {}).length > 0 ? (
                        <div className="grid gap-2">
                          {Object.entries(skillGap.skill_gap_analysis).map(([skill, gap]: [string, any]) => (
                            <div key={skill} className="flex justify-between items-center p-2 bg-surface rounded-sm">
                              <span className="text-sm">{skill}</span>
                              <span className="text-sm font-mono">{gap} gap</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-text-secondary">No skill gaps analyzed yet.</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-text-secondary">Loading skill gap data...</p>
                )}
              </div>
            )}
            
            {!isTutor && (
              <div className="card-base">
                <h3 className="font-semibold mb-1">My Certificates</h3>
                <p className="text-sm text-text-secondary mb-6">
                  Your completed course achievements.
                </p>
                {certs.length === 0 ? (
                  <div className="text-center py-6 text-text-secondary text-sm border border-dashed rounded-sm border-border">
                     No certificates earned yet. Complete a course assessment to earn one.
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {certs.map((cert) => (
                      <div key={cert.id} className="flex flex-col md:flex-row items-start md:items-center justify-between p-4 border border-border rounded-sm hover:shadow-sm transition-shadow">
                        <div>
                           <p className="font-semibold mb-1">Course {cert.course_id}</p>
                           <p className="text-xs text-text-secondary">Issued: {new Date(cert.issued_at).toLocaleDateString()} &bull; ID: {cert.verification_code}</p>
                        </div>
                        <div className="mt-3 md:mt-0 flex gap-2">
                           {cert.pdf_url && (
                             <a href={cert.pdf_url} target="_blank" rel="noreferrer" className="text-sm font-medium text-primary hover:underline px-3 py-1.5 bg-primary/10 rounded-sm">
                               Download PDF
                             </a>
                           )}
                           {cert.linkedin_share_url && (
                              <a href={cert.linkedin_share_url} target="_blank" rel="noreferrer" className="text-sm font-medium text-[#0077b5] hover:underline px-3 py-1.5 border border-[#0077b5] rounded-sm">
                                Share on LinkedIn
                              </a>
                           )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            
            <div className="card-base">
              <h3 className="font-semibold mb-1">Notifications</h3>
              <p className="text-sm text-text-secondary mb-6">
                Choose how you want to hear from EliteCoach.
              </p>
              <div className="space-y-4">
                {(
                  [
                    { key: "email", label: "Email notifications" },
                    { key: "in_app", label: "In-app notifications" },
                  ] as const
                ).map((row) => (
                  <div
                    key={row.key}
                    className="flex items-center justify-between py-3 border-b border-border last:border-b-0"
                  >
                    <span className="text-sm font-medium">{row.label}</span>
                    <button
                      onClick={() => togglePref(row.key, !prefs[row.key])}
                      className={`relative w-12 h-6 rounded-full transition-colors ${
                        prefs[row.key] ? "bg-primary" : "bg-border"
                      }`}
                      aria-pressed={prefs[row.key]}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                          prefs[row.key] ? "translate-x-6" : ""
                        }`}
                      />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
