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
  const roles = user?.roles ?? [];
  const isTutor = roles.includes("tutor_author") || roles.includes("tutor_responder") || (user as any)?.userType === "TUTOR";
  const isOrgAdmin = roles.includes("enterprise_admin") || (user as any)?.userType === "ORG_ADMIN";
  if (isTutor) {
    if (roles.includes("tutor_author")) {
      throw redirect({ to: "/tutor/courses" });
    } else {
      throw redirect({ to: "/tutor/inbox" });
    }
  }
  if (isOrgAdmin) {
    throw redirect({ to: "/enterprise/dashboard" });
  }
  // Treat undefined/null/empty userType as LEARNER (the default role)
}

/** Throws a redirect to /login if the user is not a TUTOR. */
export function requireTutor() {
  const { isLoggedIn, user } = useAuthStore.getState();
  if (!isLoggedIn) {
    throw redirect({ to: "/login" });
  }
  const roles = user?.roles ?? [];
  const isTutor = roles.includes("tutor_author") || roles.includes("tutor_responder") || (user as any)?.userType === "TUTOR";
  if (!isTutor) {
    throw redirect({ to: "/dashboard" });
  }
}

/** Throws a redirect to /login if the user is not an ORG_ADMIN. */
export function requireOrgAdmin() {
  const { isLoggedIn, user } = useAuthStore.getState();
  const roles = user?.roles ?? [];
  const isOrgAdmin = roles.includes("enterprise_admin") || (user as any)?.userType === "ORG_ADMIN";
  if (!isLoggedIn || !isOrgAdmin) {
    throw redirect({ to: "/login" });
  }
}

/** Throws a redirect to /tutor/courses if the user is a TUTOR. */
export function redirectIfTutor() {
  const { isLoggedIn, user } = useAuthStore.getState();
  if (isLoggedIn) {
    const roles = user?.roles ?? [];
    const isTutor = roles.includes("tutor_author") || roles.includes("tutor_responder") || (user as any)?.userType === "TUTOR";
    if (isTutor) {
      if (roles.includes("tutor_author")) {
        throw redirect({ to: "/tutor/courses" });
      } else {
        throw redirect({ to: "/tutor/inbox" });
      }
    }
  }
}

/** Throws a redirect to /dashboard if the user is already logged in. */
export function redirectIfLoggedIn() {
  const { isLoggedIn, user } = useAuthStore.getState();
  if (isLoggedIn) {
    const roles = user?.roles ?? [];
    const isTutor = roles.includes("tutor_author") || roles.includes("tutor_responder") || (user as any)?.userType === "TUTOR";
    const isOrgAdmin = roles.includes("enterprise_admin") || (user as any)?.userType === "ORG_ADMIN";
    if (isTutor) {
      if (roles.includes("tutor_author")) {
        throw redirect({ to: "/tutor/courses" });
      } else {
        throw redirect({ to: "/tutor/inbox" });
      }
    } else if (isOrgAdmin) {
      throw redirect({ to: "/enterprise/dashboard" });
    } else {
      throw redirect({ to: "/dashboard" });
    }
  }
}
