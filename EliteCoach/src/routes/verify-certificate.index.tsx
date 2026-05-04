import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { TopNav } from "@/components/TopNav";
import { Footer } from "@/components/Footer";
import { Search } from "lucide-react";

export const Route = createFileRoute("/verify-certificate/")({
  head: () => ({ meta: [{ title: "Verify certificate — EliteCoach" }] }),
  component: VerifyCertificateIndexPage,
});

function VerifyCertificateIndexPage() {
  const [code, setCode] = useState("");
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.trim()) {
      navigate({
        to: "/verify-certificate/$code",
        params: { code: code.trim() },
      });
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <TopNav />
      <div className="container-1200 py-24 flex-1 flex flex-col items-center justify-center text-center">
        <span className="label-caps text-coral mb-4">Verification</span>
        <h1 className="text-5xl font-bold tracking-tight mb-4 max-w-2xl">
          Verify your professional certificate
        </h1>
        <p className="text-text-secondary text-lg mb-12 max-w-xl">
          Enter the unique verification code found on your EliteCoach certificate to confirm its authenticity.
        </p>

        <form onSubmit={handleSubmit} className="w-full max-w-lg relative">
          <div className="relative group">
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Enter verification code (e.g., CERT-12345)"
              className="w-full h-16 pl-14 pr-32 bg-white border-2 border-border focus:border-primary outline-none text-lg transition-all shadow-sm group-hover:shadow-md"
              autoFocus
            />
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-text-secondary group-focus-within:text-primary transition-colors" size={24} />
            <button
              type="submit"
              disabled={!code.trim()}
              className="absolute right-2 top-2 bottom-2 px-6 bg-primary text-primary-foreground font-semibold hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Verify
            </button>
          </div>
        </form>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-4xl text-left">
          <div className="card-base p-6">
            <h3 className="font-bold mb-2">Instant Validation</h3>
            <p className="text-sm text-text-secondary">Our system checks the database in real-time to confirm the certificate's validity.</p>
          </div>
          <div className="card-base p-6">
            <h3 className="font-bold mb-2">Secure Sharing</h3>
            <p className="text-sm text-text-secondary">Verified certificates can be shared directly to LinkedIn or downloaded as PDF.</p>
          </div>
          <div className="card-base p-6">
            <h3 className="font-bold mb-2">Official Record</h3>
            <p className="text-sm text-text-secondary">Every certificate is backed by our immutable learning record system.</p>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
