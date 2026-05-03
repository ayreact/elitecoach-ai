import { describe, it, expect, beforeEach } from "vitest";
import { useAuthStore, useSessionStore } from "@/lib/stores";

beforeEach(() => {
  // Reset auth store to initial state before each test
  useAuthStore.setState({
    user: null,
    accessToken: null,
    refreshToken: null,
    isLoggedIn: false,
  });
  useSessionStore.getState().clearSession();
  localStorage.clear();
  sessionStorage.clear();
});

// ── Auth store ─────────────────────────────────────────────────────────────

describe("useAuthStore", () => {
  it("starts with no session", () => {
    const { user, accessToken, isLoggedIn } = useAuthStore.getState();
    expect(user).toBeNull();
    expect(accessToken).toBeNull();
    expect(isLoggedIn).toBe(false);
  });

  it("setSession sets user, tokens and isLoggedIn", () => {
    const mockUser = {
      id: "u1",
      email: "test@example.com",
      firstName: "Test",
      lastName: "User",
    };
    useAuthStore.getState().setSession({
      user: mockUser,
      accessToken: "acc123",
      refreshToken: "ref456",
    });

    const state = useAuthStore.getState();
    expect(state.isLoggedIn).toBe(true);
    expect(state.user?.email).toBe("test@example.com");
    expect(state.accessToken).toBe("acc123");
    expect(state.refreshToken).toBe("ref456");
  });

  it("logout clears all auth state", () => {
    useAuthStore.getState().setSession({
      user: { email: "test@example.com" },
      accessToken: "acc",
      refreshToken: "ref",
    });

    useAuthStore.getState().logout();
    const state = useAuthStore.getState();

    expect(state.isLoggedIn).toBe(false);
    expect(state.user).toBeNull();
    expect(state.accessToken).toBeNull();
    expect(state.refreshToken).toBeNull();
  });

  it("setUser updates user without touching tokens", () => {
    useAuthStore.getState().setSession({
      user: { email: "a@b.com", firstName: "Old" },
      accessToken: "tok",
      refreshToken: "ref",
    });

    useAuthStore.getState().setUser({ email: "a@b.com", firstName: "New" });

    const state = useAuthStore.getState();
    expect(state.user?.firstName).toBe("New");
    expect(state.accessToken).toBe("tok");
  });

  it("setSession writes token to localStorage", () => {
    useAuthStore.getState().setSession({
      user: { email: "x@y.com" },
      accessToken: "stored-acc",
      refreshToken: "stored-ref",
    });

    const raw = localStorage.getItem("elitecoach.auth");
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.accessToken).toBe("stored-acc");
  });

  it("logout clears localStorage auth key", () => {
    useAuthStore.getState().setSession({
      user: { email: "x@y.com" },
      accessToken: "acc",
      refreshToken: "ref",
    });
    useAuthStore.getState().logout();

    expect(localStorage.getItem("elitecoach.auth")).toBeNull();
  });
});

// ── Session store ──────────────────────────────────────────────────────────

describe("useSessionStore", () => {
  it("starts with empty state", () => {
    const { currentSessionId, messages } = useSessionStore.getState();
    expect(currentSessionId).toBeNull();
    expect(messages).toHaveLength(0);
  });

  it("setSession records sessionId and resets messages", () => {
    useSessionStore.getState().addMessage({
      id: "m0",
      role: "user",
      content: "old",
      ts: 0,
    });

    useSessionStore.getState().setSession({
      sessionId: "s1",
      courseId: "c1",
      subjectId: 42,
    });

    const state = useSessionStore.getState();
    expect(state.currentSessionId).toBe("s1");
    expect(state.courseId).toBe("c1");
    expect(state.subjectId).toBe(42);
    expect(state.messages).toHaveLength(0);
  });

  it("addMessage appends messages in order", () => {
    useSessionStore.getState().setSession({ sessionId: "s1", courseId: "c1", subjectId: null });

    useSessionStore.getState().addMessage({ id: "1", role: "user", content: "hi", ts: 1 });
    useSessionStore.getState().addMessage({ id: "2", role: "assistant", content: "hello", ts: 2 });

    const { messages } = useSessionStore.getState();
    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe("user");
    expect(messages[1].role).toBe("assistant");
  });

  it("clearSession resets all fields", () => {
    useSessionStore.getState().setSession({ sessionId: "s1", courseId: "c1", subjectId: 1 });
    useSessionStore.getState().addMessage({ id: "1", role: "user", content: "msg", ts: 1 });

    useSessionStore.getState().clearSession();

    const state = useSessionStore.getState();
    expect(state.currentSessionId).toBeNull();
    expect(state.courseId).toBeNull();
    expect(state.subjectId).toBeNull();
    expect(state.messages).toHaveLength(0);
  });
});
