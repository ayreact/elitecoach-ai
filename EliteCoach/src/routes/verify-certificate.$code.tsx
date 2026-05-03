import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { TopNav } from "@/components/TopNav";
import { Footer } from "@/components/Footer";
import {
  acsApi,
  extractErrorMessage,
  findNestedObject,
  findNestedString,
  unwrapApiData,
} from "@/lib/api-client";

export const Route = createFileRoute("/verify-certificate/$code")({
  head: () => ({ meta: [{ title: "Verify certificate — EliteCoach" }] }),
  component: VerifyCertificatePage,
});

type CertificateStatus = "loading" | "verified" | "invalid" | "error";

interface CertificateInfo {
  id?: string;
  course_id?: string | number;
  issued_at?: string;
  learner_name?: string;
  verification_code?: string;
  pdf_url?: string;
  linkedin_share_url?: string;
}

function VerifyCertificatePage() {
  const { code } = Route.useParams();
  const [status, setStatus] = useState<CertificateStatus>("loading");
  const [message, setMessage] = useState<string | null>(null);
  const [certificate, setCertificate] = useState<CertificateInfo | null>(null);

  const safeCode = useMemo(() => code?.trim() ?? "", [code]);

  useEffect(() => {
    let alive = true;
    const verify = async () => {
      if (!safeCode) {
        setStatus("invalid");
        setMessage("Missing verification code.");
        return;
      }

      try {
        const directRes = await acsApi
          .get(`/v1/assessment/certificates/verify/${safeCode}`)
          .catch(async () =>
            acsApi.get("/v1/assessment/certificates/verify", {
              params: { code: safeCode },
            }),
          );
        const payload = unwrapApiData<unknown>(directRes.data);
        const dataObj =
          findNestedObject(payload, ["certificate", "data", "result"]) ??
          (payload && typeof payload === "object"
            ? (payload as Record<string, unknown>)
            : null);

        if (!dataObj) {
          throw new Error("Certificate response was empty.");
        }

        const isValid =
          findNestedString(payload, ["status", "state"])?.toLowerCase() ===
            "verified" ||
          (typeof dataObj.status === "string" &&
            dataObj.status.toLowerCase() === "verified") ||
          Boolean(dataObj.issued_at || dataObj.issue_date || dataObj.created_at);

        if (!isValid) {
          if (!alive) return;
          setStatus("invalid");
          setMessage("This certificate could not be verified.");
          return;
        }

        if (!alive) return;
        setCertificate({
          id: typeof dataObj.id === "string" ? dataObj.id : undefined,
          course_id: dataObj.course_id as string | number | undefined,
          issued_at:
            (typeof dataObj.issued_at === "string" && dataObj.issued_at) ||
            (typeof dataObj.issue_date === "string" && dataObj.issue_date) ||
            (typeof dataObj.created_at === "string" && dataObj.created_at) ||
            undefined,
          learner_name:
            typeof dataObj.learner_name === "string"
              ? dataObj.learner_name
              : typeof dataObj.recipient === "string"
                ? dataObj.recipient
                : undefined,
          verification_code:
            typeof dataObj.verification_code === "string"
              ? dataObj.verification_code
              : safeCode,
          pdf_url:
            typeof dataObj.pdf_url === "string" ? dataObj.pdf_url : undefined,
          linkedin_share_url:
            typeof dataObj.linkedin_share_url === "string"
              ? dataObj.linkedin_share_url
              : undefined,
        });
        setStatus("verified");
      } catch (err) {
        if (!alive) return;
        setStatus("error");
        setMessage(extractErrorMessage(err, "Verification failed"));
      }
    };

    verify();

    return () => {
      alive = false;
    };
  }, [safeCode]);

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <TopNav />
      <div className="container-1200 py-12 flex-1">
        <span className="label-caps text-coral mb-2 inline-block">
          Certificate
        </span>
        <h1 className="text-4xl font-bold tracking-tight">
          Verify certificate
        </h1>
        <p className="text-text-secondary mt-2">
          Code: <span className="font-mono">{safeCode || "—"}</span>
        </p>

        <div className="mt-8 card-base">
          {status === "loading" && (
            <div className="text-text-secondary">Verifying certificate...</div>
          )}
          {status === "invalid" && (
            <div>
              <p className="text-lg font-semibold">Not verified</p>
              <p className="text-text-secondary mt-2">
                {message ?? "This certificate could not be verified."}
              </p>
            </div>
          )}
          {status === "error" && (
            <div>
              <p className="text-lg font-semibold">Verification failed</p>
              <p className="text-text-secondary mt-2">
                {message ?? "We could not reach the verification service."}
              </p>
            </div>
          )}
          {status === "verified" && certificate && (
            <div className="space-y-4">
              <div>
                <p className="text-lg font-semibold">Verified</p>
                <p className="text-text-secondary mt-2">
                  This certificate is valid.
                </p>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <div className="label-caps text-text-secondary">
                    Recipient
                  </div>
                  <div className="font-medium">
                    {certificate.learner_name ?? "—"}
                  </div>
                </div>
                <div>
                  <div className="label-caps text-text-secondary">
                    Course ID
                  </div>
                  <div className="font-medium">
                    {certificate.course_id ?? "—"}
                  </div>
                </div>
                <div>
                  <div className="label-caps text-text-secondary">Issued</div>
                  <div className="font-medium">
                    {certificate.issued_at
                      ? new Date(certificate.issued_at).toLocaleDateString()
                      : "—"}
                  </div>
                </div>
                <div>
                  <div className="label-caps text-text-secondary">Code</div>
                  <div className="font-mono">
                    {certificate.verification_code ?? safeCode}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                {certificate.pdf_url && (
                  <a
                    href={certificate.pdf_url}
                    target="_blank"
                    rel="noreferrer"
                    className="h-10 px-4 inline-flex items-center bg-primary text-primary-foreground font-medium hover:bg-primary-hover transition-colors"
                  >
                    Download PDF
                  </a>
                )}
                {certificate.linkedin_share_url && (
                  <a
                    href={certificate.linkedin_share_url}
                    target="_blank"
                    rel="noreferrer"
                    className="h-10 px-4 inline-flex items-center border border-[#0077b5] text-[#0077b5] font-medium hover:bg-[#0077b5]/10 transition-colors"
                  >
                    Share on LinkedIn
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
}
