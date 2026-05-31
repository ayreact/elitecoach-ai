import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, FormEvent } from "react";
import { AuthLayout } from "@/components/AuthLayout";
import { forgotPassword, extractErrorMessage } from "@/lib/api-client";
import { toast } from "sonner";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Forgot password — EliteCoach" },
      {
        name: "description",
        content: "Enter your email to reset your password.",
      },
    ],
  }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await forgotPassword(email);
      setSubmitted(true);
      toast.success("Reset link sent if account exists");
    } catch (err) {
      console.error("[ForgotPassword] Error:", err);
      toast.error(extractErrorMessage(err, "Could not request reset link"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Reset your password"
      subtitle={
        submitted
          ? "We've sent a link to your email."
          : "Enter your email address and we'll send you a link to reset your password."
      }
    >
      {submitted ? (
        <div className="space-y-6">
          <div className="bg-success/10 border border-success/30 rounded-lg p-5 text-sm text-text-primary leading-relaxed">
            Please check your inbox at <strong className="text-navy">{email}</strong>. 
            If an account is associated with this email, you will receive instructions 
            to reset your password shortly.
          </div>
          <div className="text-center">
            <Link
              to="/login"
              className="text-primary font-medium hover:underline text-sm"
            >
              Return to login
            </Link>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-5">
          <div>
            <label className="label-caps text-text-secondary block mb-2">
              Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-12 px-4 border border-border focus:border-primary outline-none transition-colors"
              placeholder="you@example.com"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 bg-primary text-primary-foreground font-medium hover:bg-primary-hover transition-colors disabled:opacity-60"
          >
            {loading ? "Sending link..." : "Send reset link"}
          </button>

          <p className="text-sm text-text-secondary text-center">
            Remembered your password?{" "}
            <Link
              to="/login"
              className="text-primary font-medium hover:underline"
            >
              Log in
            </Link>
          </p>
        </form>
      )}
    </AuthLayout>
  );
}
