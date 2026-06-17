import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { TopNav } from "@/components/TopNav";
import { Footer } from "@/components/Footer";
import {
  acsApi,
  extractErrorMessage,
  findNestedObject,
  findNestedString,
  unwrapApiData,
  downloadCertificate,
  getLinkedInShareUrl,
} from "@/lib/api-client";

export const Route = createFileRoute("/verify-certificate/$code")({
  head: () => ({ meta: [{ title: "Verify certificate — EliteCoach" }] }),
  component: VerifyCertificatePage,
});

type CertificateStatus = "loading" | "verified" | "invalid" | "error";

interface CertificateInfo {
  id?: string;
  course_id?: string | number;
  course_name?: string;
  issued_at?: string;
  learner_name?: string;
  owner_name?: string;
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
          .get(`/api/v1/certificates/${safeCode}`);
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

        // Extract fields more robustly by searching the whole payload
        const courseId =
          dataObj.course_id ??
          dataObj.courseId ??
          findNestedString(payload, ["course_id", "courseId", "id"]);
        
        const courseName =
          typeof dataObj.course_name === "string" ? dataObj.course_name :
          typeof dataObj.course_title === "string" ? dataObj.course_title :
          typeof dataObj.title === "string" ? dataObj.title :
          findNestedString(payload, ["course_name", "course_title", "title"]);

        const ownerName =
          typeof dataObj.owner_name === "string" ? dataObj.owner_name :
          typeof dataObj.learner_name === "string" ? dataObj.learner_name :
          typeof dataObj.recipient === "string" ? dataObj.recipient :
          findNestedString(payload, ["owner_name", "learner_name", "recipient"]);

        const issuedAt =
          (typeof dataObj.issued_at === "string" && dataObj.issued_at) ||
          (typeof dataObj.issue_date === "string" && dataObj.issue_date) ||
          (typeof dataObj.created_at === "string" && dataObj.created_at) ||
          findNestedString(payload, ["issued_at", "issue_date", "created_at"]);

        setCertificate({
          id: typeof dataObj.id === "string" ? dataObj.id : undefined,
          course_id: courseId as string | number | undefined,
          course_name: courseName ?? undefined,
          issued_at: issuedAt ?? undefined,
          owner_name: ownerName ?? undefined,
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

  const handleDownloadCert = async () => {
    if (!certificate) return;
    try {
      if (certificate.id) {
        const url = await downloadCertificate(certificate.id);
        if (url) {
          const link = document.createElement("a");
          link.href = url;
          link.download = `Certificate_${certificate.verification_code || "EC"}.pdf`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          return;
        }
      }
      
      if (!certificate.pdf_url) return;
      const downloadUrl = certificate.pdf_url.includes("res.cloudinary.com")
        ? certificate.pdf_url.replace("/upload/", "/upload/fl_attachment/")
        : certificate.pdf_url;
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.setAttribute("download", `Certificate-${certificate.verification_code || "EC"}.pdf`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      if (certificate.pdf_url) window.open(certificate.pdf_url, "_blank");
    }
  };

  const handleShareCert = async () => {
    if (!certificate) return;
    try {
      if (certificate.id) {
        const url = await getLinkedInShareUrl(certificate.id);
        if (url) {
          window.open(url, "_blank", "noopener,noreferrer");
          return;
        }
      }
      if (certificate.linkedin_share_url) {
        window.open(certificate.linkedin_share_url, "_blank", "noopener,noreferrer");
      }
    } catch (e) {
      if (certificate.linkedin_share_url) window.open(certificate.linkedin_share_url, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <TopNav />
      <div className="container-1200 py-12 flex-1">
        <span className="label-caps text-coral mb-2 inline-block">
          Certificate
        </span>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">
              Verify certificate
            </h1>
            <p className="text-text-secondary mt-2">
              Code: <span className="font-mono">{safeCode || "—"}</span>
            </p>
          </div>
          <Link
            to="/verify-certificate"
            className="text-sm font-medium text-primary hover:underline"
          >
            ← Verify another certificate
          </Link>
        </div>

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
                    {certificate.owner_name ?? certificate.learner_name ?? "—"}
                  </div>
                </div>
                <div>
                  <div className="label-caps text-text-secondary">Course</div>
                  <div className="font-medium">
                    {certificate.course_name ?? certificate.course_id ?? "—"}
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
                  <button
                    onClick={handleDownloadCert}
                    className="h-10 px-4 inline-flex items-center bg-primary text-primary-foreground font-medium hover:bg-primary-hover transition-colors cursor-pointer"
                  >
                    Download PDF
                  </button>
                )}
                {certificate.pdf_url && (
                  <a
                    href={certificate.pdf_url}
                    target="_blank"
                    rel="noreferrer"
                    className="h-10 px-4 inline-flex items-center border border-divider text-text-primary font-medium hover:bg-surface-hover transition-colors cursor-pointer"
                  >
                    View Certificate
                  </a>
                )}
                {certificate.linkedin_share_url && (
                  <button
                    onClick={handleShareCert}
                    className="h-10 px-4 inline-flex items-center border border-[#0077b5] text-[#0077b5] font-medium hover:bg-[#0077b5]/10 transition-colors cursor-pointer"
                  >
                    Share on LinkedIn
                  </button>
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
