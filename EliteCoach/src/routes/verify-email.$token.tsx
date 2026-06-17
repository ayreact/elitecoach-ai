import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AuthLayout } from "@/components/AuthLayout";
import { identityApi, extractErrorMessage } from "@/lib/api-client";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";

export const Route = createFileRoute("/verify-email/$token")({
  head: () => ({
    meta: [
      { title: "Verifying your email — EliteCoach" },
      {
        name: "description",
        content: "Please wait while we verify your email.",
      },
    ],
  }),
  component: VerifyEmailPage,
});

type VerifyStatus = "loading" | "success" | "error";

function VerifyEmailPage() {
  const { token } = Route.useParams();
  const [status, setStatus] = useState<VerifyStatus>("loading");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let active = true;
    const verify = async () => {
      try {
        await identityApi.get(`/api/v1/auth/verify-email/${token}`);
        if (active) {
          setStatus("success");
          toast.success("Email verified successfully!");
        }
      } catch (err) {
        if (active) {
          setStatus("error");
          setErrorMessage(extractErrorMessage(err, "Invalid or expired token"));
          toast.error("Verification failed");
        }
      }
    };
    verify();
    return () => {
      active = false;
    };
  }, [token]);

  return (
    <AuthLayout
      title="Email Verification"
      subtitle={
        status === "loading"
          ? "We are verifying your account..."
          : status === "success"
            ? "Your email has been verified!"
            : "Verification failed."
      }
    >
      <div className="flex flex-col items-center justify-center py-6 text-center">
        {status === "loading" && (
          <div className="space-y-4">
            <Loader2 className="w-16 h-16 text-primary animate-spin mx-auto" />
            <p className="text-text-secondary text-sm">
              Confirming your security token with our server...
            </p>
          </div>
        )}

        {status === "success" && (
          <div className="space-y-6 w-full animate-in fade-in-50 zoom-in-95 duration-300">
            <CheckCircle2 className="w-16 h-16 text-success mx-auto" />
            <div className="bg-success/10 border border-success/30 rounded-lg p-4 text-sm text-text-primary">
              Thank you! Your email is now verified. You can log in and access all parts of the application.
            </div>
            <Link
              to="/login"
              className="w-full h-12 bg-primary text-primary-foreground font-medium rounded flex items-center justify-center hover:bg-primary-hover transition-colors shadow"
            >
              Continue to Login
            </Link>
          </div>
        )}

        {status === "error" && (
          <div className="space-y-6 w-full animate-in fade-in-50 zoom-in-95 duration-300">
            <XCircle className="w-16 h-16 text-destructive mx-auto" />
            <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 text-sm text-text-primary text-left">
              <strong className="text-destructive font-bold block mb-1">Reason:</strong>
              {errorMessage}
            </div>
            <div className="flex flex-col gap-3 w-full">
              <Link
                to="/verify-otp"
                search={{ email: "" }}
                className="w-full h-12 border border-border font-medium rounded flex items-center justify-center hover:bg-surface transition-colors"
              >
                Use Manual OTP Instead
              </Link>
              <Link
                to="/login"
                className="text-primary font-medium hover:underline text-sm mt-2"
              >
                Return to Login
              </Link>
            </div>
          </div>
        )}
      </div>
    </AuthLayout>
  );
}
