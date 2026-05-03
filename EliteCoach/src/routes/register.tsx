import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { redirectIfLoggedIn } from "@/lib/auth-guard";
import { useState, FormEvent } from "react";
import { AuthLayout } from "@/components/AuthLayout";
import { identityApi, extractErrorMessage } from "@/lib/api-client";
import { toast } from "sonner";

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
  const [userType, setUserType] = useState<"LEARNER" | "TUTOR">("LEARNER");
  const [loading, setLoading] = useState(false);

  const update = (k: keyof typeof form, v: string) =>
    setForm((s) => ({ ...s, [k]: v }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await identityApi.post("/api/v1/auth/register", {
        ...form,
        userType: userType.toLowerCase(),
      });
      toast.success(
        "Account created. Check your email for a verification code.",
      );
      navigate({ to: "/verify-otp", search: { email: form.email } });
    } catch (err) {
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
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setUserType("LEARNER")}
            className={`h-12 border font-medium transition-colors ${
              userType === "LEARNER"
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border hover:border-primary"
            }`}
          >
            I'm a Learner
          </button>
          <button
            type="button"
            onClick={() => setUserType("TUTOR")}
            className={`h-12 border font-medium transition-colors ${
              userType === "TUTOR"
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border hover:border-primary"
            }`}
          >
            I'm a Tutor
          </button>
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
    </AuthLayout>
  );
}
