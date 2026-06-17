import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { TopNav } from "@/components/TopNav";
import { Footer } from "@/components/Footer";
import { verifyPayment, extractErrorMessage } from "@/lib/api-client";
import { useAuthStore } from "@/lib/stores";
import { toast } from "sonner";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";

export const Route = createFileRoute("/payment/verify")({
  component: PaymentVerifyPage,
  validateSearch: (search: Record<string, unknown>) => {
    return {
      reference: search.reference as string | undefined,
    };
  },
});

function PaymentVerifyPage() {
  const { reference } = Route.useSearch();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Verifying your payment...");

  useEffect(() => {
    if (!reference) {
      setStatus("error");
      setMessage("No payment reference found.");
      return;
    }

    verifyPayment(reference)
      .then((res) => {
        if (res && res.status === "success") {
          setStatus("success");
          setMessage("Payment verified successfully! You are now a Premium member.");
          toast.success("Upgrade successful!");
          
          if (user) {
            const userId = user.id ?? user.userId ?? "learner";
            localStorage.setItem(`elitecoach.subscription.${userId}`, "premium");
          }

          // Redirect to profile after a short delay
          setTimeout(() => {
            navigate({ to: "/profile" });
          }, 3000);
        } else {
          setStatus("error");
          setMessage("Payment verification failed. Please contact support.");
        }
      })
      .catch((err) => {
        setStatus("error");
        setMessage(extractErrorMessage(err, "Failed to verify payment."));
      });
  }, [reference, navigate, user]);

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <TopNav />
      <div className="container-1200 py-24 flex-1 flex flex-col items-center justify-center text-center">
        <div className="card-base max-w-md w-full mx-auto p-8 border border-border">
          {status === "loading" && (
            <>
              <Loader2 className="w-16 h-16 text-primary animate-spin mx-auto mb-6" />
              <h2 className="text-2xl font-bold mb-2">Verifying Payment</h2>
              <p className="text-text-secondary">{message}</p>
            </>
          )}

          {status === "success" && (
            <>
              <CheckCircle className="w-16 h-16 text-success mx-auto mb-6" />
              <h2 className="text-2xl font-bold mb-2">Success!</h2>
              <p className="text-text-secondary">{message}</p>
              <p className="text-sm text-text-secondary mt-4">Redirecting you to your profile...</p>
            </>
          )}

          {status === "error" && (
            <>
              <XCircle className="w-16 h-16 text-coral mx-auto mb-6" />
              <h2 className="text-2xl font-bold mb-2">Verification Failed</h2>
              <p className="text-text-secondary">{message}</p>
              <button
                onClick={() => navigate({ to: "/profile" })}
                className="mt-6 px-6 py-2 bg-primary text-white rounded hover:bg-primary/90 transition-colors font-medium"
              >
                Return to Profile
              </button>
            </>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
}
