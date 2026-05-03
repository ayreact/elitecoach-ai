import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { clearAuth, writeAuth } from "@/lib/api-client";

export interface AuthUser {
  id?: string;
  userId?: string;
  email: string;
  firstName?: string;
  lastName?: string;
  userType?: "LEARNER" | "TUTOR" | "ORG_ADMIN" | string;
  organizationId?: string;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  isLoggedIn: boolean;
  setSession: (data: {
    user: AuthUser;
    accessToken: string;
    refreshToken: string;
  }) => void;
  setUser: (user: AuthUser) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isLoggedIn: false,
      setSession: ({ user, accessToken, refreshToken }) => {
        writeAuth({ accessToken, refreshToken });
        set({ user, accessToken, refreshToken, isLoggedIn: true });
      },
      setUser: (user) => set({ user }),
      logout: () => {
        clearAuth();
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isLoggedIn: false,
        });
      },
    }),
    { name: "elitecoach.authstore" },
  ),
);

interface OrgState {
  organizationId: string | null;
  planTier: string | null;
  setOrg: (data: {
    organizationId: string | null;
    planTier?: string | null;
  }) => void;
}

export const useOrgStore = create<OrgState>()(
  persist(
    (set) => ({
      organizationId: null,
      planTier: null,
      setOrg: ({ organizationId, planTier }) =>
        set({ organizationId, planTier: planTier ?? null }),
    }),
    { name: "elitecoach.orgstore" },
  ),
);

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  ts: number;
}

interface SessionState {
  currentSessionId: string | null;
  courseId: string | null;
  subjectId: number | null;
  messages: ChatMessage[];
  setSession: (data: {
    sessionId: string;
    courseId: string;
    subjectId: number | null;
  }) => void;
  addMessage: (m: ChatMessage) => void;
  clearSession: () => void;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      currentSessionId: null,
      courseId: null,
      subjectId: null,
      messages: [],
      setSession: ({ sessionId, courseId, subjectId }) =>
        set({ currentSessionId: sessionId, courseId, subjectId, messages: [] }),
      addMessage: (m) => set((s) => ({ messages: [...s.messages, m] })),
      clearSession: () =>
        set({
          currentSessionId: null,
          courseId: null,
          subjectId: null,
          messages: [],
        }),
    }),
    {
      name: "elitecoach.session",
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
);
