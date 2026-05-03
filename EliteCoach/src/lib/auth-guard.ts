import { redirect } from "@tanstack/react-router";
import { useAuthStore } from "@/lib/stores";

/** Throws a redirect to /login if the user is not authenticated. */
export function requireAuth() {
  const { isLoggedIn } = useAuthStore.getState();
  if (!isLoggedIn) {
    throw redirect({ to: "/login" });
  }
}

/** Throws a redirect to /login if the user is not a LEARNER. */
export function requireLearner() {
  const { isLoggedIn, user } = useAuthStore.getState();
  if (!isLoggedIn) {
    throw redirect({ to: "/login" });
  }
  if (user?.userType === "TUTOR") {
    throw redirect({ to: "/tutor/courses" });
  }
  if (user?.userType === "ORG_ADMIN") {
    const orgId = String((user as any).organizationId ?? "unknown");
    throw redirect({ to: "/org/$orgId/dashboard", params: { orgId } });
  }
  // Treat undefined/null/empty userType as LEARNER (the default role)
}

/** Throws a redirect to /login if the user is not a TUTOR. */
export function requireTutor() {
  const { isLoggedIn, user } = useAuthStore.getState();
  if (!isLoggedIn) {
    throw redirect({ to: "/login" });
  }
  if (user?.userType === "LEARNER") {
    throw redirect({ to: "/dashboard" });
  }
  if (user?.userType !== "TUTOR") {
    throw redirect({ to: "/login" });
  }
}

/** Throws a redirect to /login if the user is not an ORG_ADMIN. */
export function requireOrgAdmin() {
  const { isLoggedIn, user } = useAuthStore.getState();
  if (!isLoggedIn || user?.userType !== "ORG_ADMIN") {
    throw redirect({ to: "/login" });
  }
}

/** Throws a redirect to /tutor/courses if the user is a TUTOR. */
export function redirectIfTutor() {
  const { isLoggedIn, user } = useAuthStore.getState();
  if (isLoggedIn && user?.userType === "TUTOR") {
    throw redirect({ to: "/tutor/courses" });
  }
}

/** Throws a redirect to /dashboard if the user is already logged in. */
export function redirectIfLoggedIn() {
  const { isLoggedIn, user } = useAuthStore.getState();
  if (isLoggedIn) {
    throw redirect({ to: user?.userType === "TUTOR" ? "/tutor/courses" : "/dashboard" });
  }
}
