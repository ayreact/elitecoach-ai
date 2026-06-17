import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { redirectIfLoggedIn } from "@/lib/auth-guard";
import { useState, FormEvent } from "react";
import { AuthLayout } from "@/components/AuthLayout";
import {
  identityApi,
  aiTutorApi,
  extractErrorMessage,
  findNestedObject,
  findNestedString,
} from "@/lib/api-client";
import { type AuthUser, useAuthStore } from "@/lib/stores";
import { toast } from "sonner";

function pickString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }

  return null;
}

export const Route = createFileRoute("/login")({
  beforeLoad: () => { redirectIfLoggedIn(); },
  head: () => ({
    meta: [
      { title: "Log in — EliteCoach" },
      {
        name: "description",
        content: "Log in to EliteCoach to continue learning.",
      },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [overrideRole, setOverrideRole] = useState<string>("");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErrors({});
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append("username", email);
      params.append("password", password);
      
      const res = await identityApi.post("/api/v1/auth/login", params, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" }
      });
      const payload =
        res.data && typeof res.data === "object"
          ? (res.data as Record<string, unknown>)
          : {};
      const data =
        payload.data && typeof payload.data === "object"
          ? (payload.data as Record<string, unknown>)
          : payload;
      const accessToken =
        pickString(
          payload.accessToken,
          payload.access_token,
          payload.token,
          payload.jwt,
          data.accessToken,
          data.access_token,
          data.token,
          data.jwt,
        ) ??
        findNestedString(payload, [
          "accessToken",
          "access_token",
          "token",
          "jwt",
        ]);
      const refreshToken =
        pickString(
          payload.refreshToken,
          payload.refresh_token,
          data.refreshToken,
          data.refresh_token,
        ) ??
        findNestedString(payload, ["refreshToken", "refresh_token"]) ??
        "";
      const rawUser =
        findNestedObject(payload, ["user", "profile", "account"]) ?? data;
      const fullName =
        pickString(rawUser.fullname, rawUser.fullName, rawUser.name) ?? "";
      const [derivedFirstName, ...derivedLastName] = fullName
        .split(" ")
        .filter(Boolean);
      const user: AuthUser = {
        ...rawUser,
        email:
          typeof rawUser.email === "string" && rawUser.email
            ? rawUser.email
            : email,
        firstName:
          pickString(rawUser.firstName, rawUser.first_name) ??
          findNestedString(rawUser, ["firstName", "first_name"]) ??
          derivedFirstName ??
          undefined,
        lastName:
          pickString(rawUser.lastName, rawUser.last_name) ??
          findNestedString(rawUser, ["lastName", "last_name"]) ??
          (derivedLastName.length > 0
            ? derivedLastName.join(" ")
            : undefined) ??
          undefined,
        id:
          pickString(rawUser.id, rawUser.userId, rawUser.user_id) ??
          findNestedString(rawUser, ["id", "userId", "user_id"]) ??
          undefined,
        userId:
          pickString(rawUser.userId, rawUser.user_id) ??
          findNestedString(rawUser, ["userId", "user_id"]) ??
          undefined,
        organizationId:
          pickString(rawUser.organizationId, rawUser.orgId, rawUser.org_id, data.organizationId, data.orgId, data.org_id) ??
          findNestedString(payload, ["organizationId", "orgId", "org_id"]) ??
          undefined,
        roles: overrideRole ? overrideRole.split(',') : (
          Array.isArray(rawUser.roles) ? rawUser.roles :
          Array.isArray(data.roles) ? data.roles :
          []
        ),
      };
      if (!accessToken) throw new Error("No access token returned");
      setSession({ user, accessToken, refreshToken });

      toast.success(
        `Welcome back${user.firstName ? ", " + user.firstName : ""}`,
      );
      const roles = user.roles ?? [];
      if (roles.includes("tutor_author")) {
        navigate({ to: "/tutor/courses" });
      } else if (roles.includes("tutor_responder")) {
        navigate({ to: "/tutor/inbox" });
      }
      else if (roles.includes("enterprise_admin")) {
        navigate({ to: "/enterprise/dashboard" });
      }
      else {
        try {
          await aiTutorApi.get("/api/v1/onboarding/path");
          navigate({ to: "/dashboard" });
        } catch (e: any) {
          if (e.response?.status === 404) navigate({ to: "/onboarding" });
          else navigate({ to: "/dashboard" });
        }
      }
    } catch (err) {
      console.error("[Login] Authentication failed:", err);
      const message = extractErrorMessage(err, "Login failed");
      if (/verify/i.test(message)) {
        toast.error("Please verify your email first.");
        navigate({ to: "/verify-otp", search: { email } });
      } else {
        toast.error(message);
        setErrors({
          password: /invalid|unauthorized|credential|password|email/i.test(
            message,
          )
            ? message
            : "Login failed. Check the API response shape or your credentials.",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Log in to continue your learning journey."
    >
      <form onSubmit={submit} className="space-y-5">
        <div>
          <label className="label-caps text-text-secondary block mb-2">
            Email
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
        <div>
          <label className="label-caps text-text-secondary block mb-2">
            Password
          </label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full h-12 px-4 border border-border focus:border-primary outline-none transition-colors"
            placeholder="••••••••"
          />
          <div className="flex justify-between items-center mt-2">
            <div>
              {errors.password && (
                <p className="text-[13px] text-destructive">
                  {errors.password}
                </p>
              )}
            </div>
            <Link
              to="/forgot-password"
              className="text-xs text-primary hover:underline font-medium"
            >
              Forgot password?
            </Link>
          </div>
        </div>

        <div>
          <label className="label-caps text-text-secondary block mb-2">
            Test Role Override (MVP Only)
          </label>
          <select
            value={overrideRole}
            onChange={(e) => setOverrideRole(e.target.value)}
            className="w-full h-12 px-4 border border-border focus:border-primary outline-none transition-colors bg-surface-card cursor-pointer"
          >
            <option value="">Auto-detect from backend</option>
            <option value="tutor_author,tutor_responder">Force Tutor</option>
            <option value="enterprise_admin">Force Org Admin</option>
            <option value="solo_learner">Force Learner</option>
          </select>
          <p className="text-[11px] text-text-secondary mt-1">
            Since the backend ignores roles on registration, use this to test different dashboards.
          </p>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full h-12 bg-primary text-primary-foreground font-medium hover:bg-primary-hover transition-colors disabled:opacity-60"
        >
          {loading ? "Signing in..." : "Log in"}
        </button>

        <p className="text-sm text-text-secondary text-center">
          Don't have an account?{" "}
          <Link
            to="/register"
            className="text-primary font-medium hover:underline"
          >
            Create one
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
