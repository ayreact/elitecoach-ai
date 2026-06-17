import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, FormEvent } from "react";
import { AuthLayout } from "@/components/AuthLayout";
import { resetPassword, extractErrorMessage } from "@/lib/api-client";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password/$token")({
  head: () => ({
    meta: [
      { title: "Reset password — EliteCoach" },
      {
        name: "description",
        content: "Enter your new password to secure your account.",
      },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      await resetPassword(token, password);
      setSuccess(true);
      toast.success("Password updated successfully");
      setTimeout(() => {
        navigate({ to: "/login" });
      }, 3000);
    } catch (err) {
      console.error("[ResetPassword] Error:", err);
      toast.error(extractErrorMessage(err, "Failed to reset password"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Create new password"
      subtitle={
        success
          ? "Your password has been reset successfully."
          : "Please enter your new password below."
      }
    >
      {success ? (
        <div className="space-y-6">
          <div className="bg-success/10 border border-success/30 rounded-lg p-5 text-sm text-text-primary leading-relaxed">
            Your password has been successfully updated. You are being redirected to login page...
          </div>
          <div className="text-center">
            <Link
              to="/login"
              className="text-primary font-medium hover:underline text-sm"
            >
              Go to login page now
            </Link>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-5">
          <div>
            <label className="label-caps text-text-secondary block mb-2">
              New Password
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full h-12 px-4 border border-border focus:border-primary outline-none transition-colors"
              placeholder="At least 8 characters"
            />
          </div>

          <div>
            <label className="label-caps text-text-secondary block mb-2">
              Confirm New Password
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full h-12 px-4 border border-border focus:border-primary outline-none transition-colors"
              placeholder="Confirm password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 bg-primary text-primary-foreground font-medium hover:bg-primary-hover transition-colors disabled:opacity-60"
          >
            {loading ? "Updating password..." : "Update password"}
          </button>
        </form>
      )}
    </AuthLayout>
  );
}
