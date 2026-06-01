import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { redirectIfLoggedIn } from "@/lib/auth-guard";
import { useState, FormEvent } from "react";
import { AuthLayout } from "@/components/AuthLayout";
import { identityApi, extractErrorMessage } from "@/lib/api-client";
import { toast } from "sonner";
import { X } from "lucide-react";

export const Route = createFileRoute("/register")({
  beforeLoad: () => { redirectIfLoggedIn(); },
  head: () => ({
    meta: [
      { title: "Sign up — EliteCoach" },
      {
        name: "description",
        content: "Create a free EliteCoach account and start learning today.",
      },
    ],
  }),
  component: RegisterPage,
});

function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
  });
  const [role, setRole] = useState<"solo_learner" | "enterprise_admin" | "tutor_author">("solo_learner");
  const [loading, setLoading] = useState(false);
  const [agreeNdpr, setAgreeNdpr] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);

  const update = (k: keyof typeof form, v: string) =>
    setForm((s) => ({ ...s, [k]: v }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await identityApi.post("/api/v1/auth/register", {
        full_name: `${form.firstName} ${form.lastName}`.trim(),
        email: form.email,
        password: form.password,
        role: role,
      });
      toast.success(
        "Account created. Check your email for a verification code.",
      );
      navigate({ to: "/verify-otp", search: { email: form.email } });
    } catch (err) {
      console.error("[Register] Account creation failed:", err);
      toast.error(extractErrorMessage(err, "Registration failed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Free forever. No credit card required."
    >
      <form onSubmit={submit} className="space-y-5">
        <div>
          <label className="label-caps text-text-secondary block mb-2">
            Select Your Role
          </label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as any)}
            className="w-full h-12 px-4 border border-border focus:border-primary outline-none bg-surface-card cursor-pointer transition-colors"
          >
            <option value="solo_learner">Solo Learner</option>
            <option value="enterprise_admin">Enterprise Admin</option>
            <option value="tutor_author">Tutor</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label-caps text-text-secondary block mb-2">
              First name
            </label>
            <input
              required
              value={form.firstName}
              onChange={(e) => update("firstName", e.target.value)}
              className="w-full h-12 px-4 border border-border focus:border-primary outline-none"
            />
          </div>
          <div>
            <label className="label-caps text-text-secondary block mb-2">
              Last name
            </label>
            <input
              required
              value={form.lastName}
              onChange={(e) => update("lastName", e.target.value)}
              className="w-full h-12 px-4 border border-border focus:border-primary outline-none"
            />
          </div>
        </div>
        <div>
          <label className="label-caps text-text-secondary block mb-2">
            Email
          </label>
          <input
            type="email"
            required
            value={form.email}
            onChange={(e) => update("email", e.target.value)}
            className="w-full h-12 px-4 border border-border focus:border-primary outline-none"
          />
        </div>
        <div>
          <label className="label-caps text-text-secondary block mb-2">
            Password
          </label>
          <input
            type="password"
            required
            minLength={8}
            value={form.password}
            onChange={(e) => update("password", e.target.value)}
            className="w-full h-12 px-4 border border-border focus:border-primary outline-none"
            placeholder="At least 8 characters"
          />
        </div>

        <div className="flex items-start gap-3 py-1">
          <input
            id="agreeNdpr"
            type="checkbox"
            required
            checked={agreeNdpr}
            onChange={(e) => setAgreeNdpr(e.target.checked)}
            className="w-4 h-4 mt-0.5 accent-primary cursor-pointer shrink-0"
          />
          <label htmlFor="agreeNdpr" className="text-[11px] text-text-secondary leading-relaxed">
            I consent to the collection and storage of my personal data in compliance with the <span className="font-bold">Nigerian Data Protection Regulation (NDPR)</span>, and agree to the{" "}
            <button
              type="button"
              onClick={() => setShowTerms(true)}
              className="text-primary hover:underline font-bold inline-block p-0 bg-transparent border-0 cursor-pointer text-[11px]"
            >
              Terms of Service
            </button>{" "}
            and{" "}
            <button
              type="button"
              onClick={() => setShowPrivacy(true)}
              className="text-primary hover:underline font-bold inline-block p-0 bg-transparent border-0 cursor-pointer text-[11px]"
            >
              Privacy Policy
            </button>.
          </label>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full h-12 bg-primary text-primary-foreground font-medium hover:bg-primary-hover transition-colors disabled:opacity-60"
        >
          {loading ? "Creating account..." : "Create account →"}
        </button>

        <p className="text-sm text-text-secondary text-center">
          Already have an account?{" "}
          <Link
            to="/login"
            className="text-primary font-medium hover:underline"
          >
            Log in
          </Link>
        </p>
      </form>
      
      {showTerms && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-surface-card w-full max-w-lg p-8 rounded-lg relative overflow-y-auto max-h-[85vh]">
            <button
              onClick={() => setShowTerms(false)}
              className="absolute top-4 right-4 text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>
            <span className="label-caps text-coral mb-2 inline-block">Legal</span>
            <h2 className="text-2xl font-bold mb-4">Terms of Service</h2>
            <div className="text-sm text-text-secondary space-y-4 leading-relaxed font-normal">
              <p>
                Welcome to EliteCoach. By accessing or using our platform, you agree to comply with and be bound by these Terms of Service.
              </p>
              <h4 className="font-bold text-text-primary mt-4">1. Use of Service</h4>
              <p>
                You agree to use EliteCoach only for lawful educational purposes and in a manner that does not infringe the rights of, restrict, or inhibit anyone else's use of the platform.
              </p>
              <h4 className="font-bold text-text-primary mt-4">2. Account Responsibility</h4>
              <p>
                You are responsible for maintaining the confidentiality of your account password and are liable for all activities occurring under your account.
              </p>
              <h4 className="font-bold text-text-primary mt-4">3. Intellectual Property</h4>
              <p>
                All course contents, system prompt designs, assessment templates, and codebase structures are the property of EliteCoach.
              </p>
              <h4 className="font-bold text-text-primary mt-4">4. Plan Subscriptions</h4>
              <p>
                Payments made via Paystack are non-refundable after service delivery. Subscriptions renew automatically unless cancelled prior to the invoice date.
              </p>
            </div>
            <button
              onClick={() => setShowTerms(false)}
              className="mt-6 w-full h-11 bg-primary text-primary-foreground font-medium hover:bg-primary-hover transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {showPrivacy && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-surface-card w-full max-w-lg p-8 rounded-lg relative overflow-y-auto max-h-[85vh]">
            <button
              onClick={() => setShowPrivacy(false)}
              className="absolute top-4 right-4 text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>
            <span className="label-caps text-coral mb-2 inline-block">Compliance</span>
            <h2 className="text-2xl font-bold mb-4">Privacy Policy (NDPR)</h2>
            <div className="text-sm text-text-secondary space-y-4 leading-relaxed font-normal">
              <p>
                EliteCoach is committed to protecting your privacy in compliance with the **Nigerian Data Protection Regulation (NDPR)**.
              </p>
              <h4 className="font-bold text-text-primary mt-4">1. Information We Collect</h4>
              <p>
                We collect your first name, last name, email address, and account passwords to manage authentication and personalize your learning room.
              </p>
              <h4 className="font-bold text-text-primary mt-4">2. Purpose of Processing</h4>
              <p>
                Your data is processed to generate personalized study paths, manage tutor escalations, issue verified certificates, and send learning notifications. We do not sell your personal data to third parties.
              </p>
              <h4 className="font-bold text-text-primary mt-4">3. Your Consent and Rights</h4>
              <p>
                By ticking the consent checkbox, you voluntarily authorize EliteCoach to process your details. You hold the right to access, rectify, delete your data, or withdraw consent at any time by contacting our support officers.
              </p>
              <h4 className="font-bold text-text-primary mt-4">4. Data Security</h4>
              <p>
                We implement advanced encryption and database access control systems to secure your records from unauthorized breaches.
              </p>
            </div>
            <button
              onClick={() => setShowPrivacy(false)}
              className="mt-6 w-full h-11 bg-primary text-primary-foreground font-medium hover:bg-primary-hover transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </AuthLayout>
  );
}
