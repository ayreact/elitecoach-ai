import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock @tanstack/react-router's redirect
vi.mock("@tanstack/react-router", () => ({
  redirect: (opts: unknown) => {
    const err = new Error("REDIRECT");
    (err as unknown as Record<string, unknown>)["redirect"] = opts;
    return err;
  },
}));

import { useAuthStore } from "@/lib/stores";
import { requireAuth, requireTutor, requireOrgAdmin, redirectIfLoggedIn } from "@/lib/auth-guard";

function resetStore(patch: Partial<ReturnType<typeof useAuthStore.getState>> = {}) {
  useAuthStore.setState({
    user: null,
    accessToken: null,
    refreshToken: null,
    isLoggedIn: false,
    ...patch,
  });
}

beforeEach(() => resetStore());

// ── requireAuth ────────────────────────────────────────────────────────────

describe("requireAuth", () => {
  it("throws a redirect to /login when not logged in", () => {
    resetStore({ isLoggedIn: false });
    expect(() => requireAuth()).toThrow("REDIRECT");
  });

  it("does not throw when logged in", () => {
    resetStore({ isLoggedIn: true });
    expect(() => requireAuth()).not.toThrow();
  });
});

// ── requireTutor ───────────────────────────────────────────────────────────

describe("requireTutor", () => {
  it("throws when not logged in", () => {
    resetStore({ isLoggedIn: false });
    expect(() => requireTutor()).toThrow("REDIRECT");
  });

  it("throws when logged in but not TUTOR", () => {
    resetStore({ isLoggedIn: true, user: { email: "a@b.com", userType: "LEARNER" } });
    expect(() => requireTutor()).toThrow("REDIRECT");
  });

  it("does not throw when user is TUTOR", () => {
    resetStore({ isLoggedIn: true, user: { email: "t@b.com", userType: "TUTOR" } });
    expect(() => requireTutor()).not.toThrow();
  });
});

// ── requireOrgAdmin ────────────────────────────────────────────────────────

describe("requireOrgAdmin", () => {
  it("throws when not logged in", () => {
    resetStore({ isLoggedIn: false });
    expect(() => requireOrgAdmin()).toThrow("REDIRECT");
  });

  it("throws when logged in but not ORG_ADMIN", () => {
    resetStore({ isLoggedIn: true, user: { email: "a@b.com", userType: "LEARNER" } });
    expect(() => requireOrgAdmin()).toThrow("REDIRECT");
  });

  it("does not throw when user is ORG_ADMIN", () => {
    resetStore({ isLoggedIn: true, user: { email: "o@b.com", userType: "ORG_ADMIN" } });
    expect(() => requireOrgAdmin()).not.toThrow();
  });
});

// ── redirectIfLoggedIn ─────────────────────────────────────────────────────

describe("redirectIfLoggedIn", () => {
  it("throws a redirect when already logged in as LEARNER", () => {
    resetStore({ isLoggedIn: true, user: { email: "l@b.com", userType: "LEARNER" } });
    expect(() => redirectIfLoggedIn()).toThrow("REDIRECT");
  });

  it("throws a redirect when already logged in as TUTOR", () => {
    resetStore({ isLoggedIn: true, user: { email: "t@b.com", userType: "TUTOR" } });
    expect(() => redirectIfLoggedIn()).toThrow("REDIRECT");
  });

  it("does not throw when not logged in", () => {
    resetStore({ isLoggedIn: false });
    expect(() => redirectIfLoggedIn()).not.toThrow();
  });
});
