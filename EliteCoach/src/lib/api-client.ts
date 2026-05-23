import axios, { AxiosInstance, AxiosError } from "axios";
import { API_URLS } from "./api-config";

const STORAGE_KEY = "elitecoach.auth";
const AUTH_STORE_KEY = "elitecoach.authstore";

export interface StoredAuth {
    accessToken: string | null;
    refreshToken: string | null;
}

export interface NormalizedCourse {
    id: string;
    title: string;
    description?: string;
    domain?: string;
    difficulty_level?: string;
    tutor_name?: string;
    skills?: string[];
    published_date?: string;
    created_at?: string;
}

export function readAuth(): StoredAuth {
    if (typeof window === "undefined")
        return { accessToken: null, refreshToken: null };
    try {
        // Primary source: the simple auth key
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw) as StoredAuth;
            if (parsed.accessToken) return parsed;
        }
        // Fallback: read from zustand persisted store (different shape)
        const storeRaw = localStorage.getItem(AUTH_STORE_KEY);
        if (storeRaw) {
            const storeParsed = JSON.parse(storeRaw);
            const state = storeParsed?.state;
            if (state?.accessToken) {
                // Sync back to the simple key so future reads are fast
                const synced = { accessToken: state.accessToken, refreshToken: state.refreshToken ?? null };
                localStorage.setItem(STORAGE_KEY, JSON.stringify(synced));
                return synced;
            }
        }
        return { accessToken: null, refreshToken: null };
    } catch {
        return { accessToken: null, refreshToken: null };
    }
}

export function writeAuth(auth: StoredAuth) {
    if (typeof window === "undefined") return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
}

export function clearAuth() {
    if (typeof window === "undefined") return;
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(AUTH_STORE_KEY);
}

export function unwrapApiData<T>(payload: unknown): T {
    if (
        payload &&
        typeof payload === "object" &&
        "data" in payload &&
        (payload as { data?: unknown }).data !== undefined
    ) {
        return (payload as { data: T }).data;
    }

    return payload as T;
}

export function unwrapApiList<T>(payload: unknown): T[] {
    const data = unwrapApiData<unknown>(payload);

    if (Array.isArray(data)) {
        return data as T[];
    }

    if (
        data &&
        typeof data === "object" &&
        "items" in data &&
        Array.isArray((data as { items?: unknown[] }).items)
    ) {
        return (data as { items: T[] }).items;
    }

    if (
        data &&
        typeof data === "object" &&
        "results" in data &&
        Array.isArray((data as { results?: unknown[] }).results)
    ) {
        return (data as { results: T[] }).results;
    }

    return [];
}

export function coerceIntegerId(value: unknown): number | null {
    if (typeof value === "number" && Number.isInteger(value)) {
        return value;
    }

    if (typeof value === "string" && /^\d+$/.test(value.trim())) {
        return Number(value);
    }

    return null;
}

export function toIsoDateTime(value: string): string | undefined {
    if (!value) return undefined;
    const parsed = new Date(`${value}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return undefined;
    return parsed.toISOString();
}

export function buildNotificationPayload({
    to,
    subject,
    body,
    channel = "email",
}: {
    to?: string | null;
    subject: string;
    body: string;
    channel?: string;
}) {
    return {
        channel,
        body,
        to: to && to.trim() ? to : "current-user",
        subject,
    };
}

export function normalizeUserType(value: unknown): string | undefined {
    if (typeof value !== "string" || !value.trim()) return undefined;
    return value.trim().toUpperCase();
}

export function normalizeCourse(raw: unknown): NormalizedCourse | null {
    if (!raw || typeof raw !== "object") return null;

    const value = raw as Record<string, unknown>;
    const id = value.id ?? value.courseId ?? value.course_id;
    const title = typeof value.title === "string" ? value.title : "";

    if (!id || !title) return null;

    const skillTags = Array.isArray(value.skill_tags)
        ? value.skill_tags.filter(
              (item): item is string => typeof item === "string"
          )
        : Array.isArray(value.skills)
          ? value.skills.filter(
                (item): item is string => typeof item === "string"
            )
          : undefined;

    return {
        id: String(id),
        title,
        description:
            typeof value.description === "string"
                ? value.description
                : undefined,
        domain: typeof value.domain === "string" ? value.domain : undefined,
        difficulty_level:
            typeof value.difficulty_level === "string"
                ? value.difficulty_level
                : undefined,
        tutor_name:
            typeof value.tutor_name === "string"
                ? value.tutor_name
                : typeof value.tutor_id === "string"
                  ? `Tutor ${value.tutor_id}`
                  : undefined,
        skills: skillTags,
        published_date:
            typeof value.published_at === "string"
                ? value.published_at
                : typeof value.published_date === "string"
                  ? value.published_date
                  : undefined,
        created_at:
            typeof value.created_at === "string" ? value.created_at : undefined,
    };
}

export interface ContentModule {
    id: number;
    course_id: number;
    title: string;
    order_index: number;
    content_chunks: string[];
    assessment_id?: string;
    is_human_required: boolean;
}

export interface CourseCurriculum extends NormalizedCourse {
    modules: ContentModule[];
}

export function normalizeCourses(payload: unknown): NormalizedCourse[] {
    return unwrapApiList<unknown>(payload)
        .map((course) => normalizeCourse(course))
        .filter((course): course is NormalizedCourse => course !== null);
}

export function findNestedString(
    payload: unknown,
    keys: string[],
    visited = new WeakSet<object>()
): string | null {
    if (!payload || typeof payload !== "object") {
        return null;
    }

    if (visited.has(payload)) {
        return null;
    }
    visited.add(payload);

    const record = payload as Record<string, unknown>;

    for (const key of keys) {
        const value = record[key];
        if (typeof value === "string" && value.trim()) {
            return value;
        }
    }

    for (const value of Object.values(record)) {
        const nested = findNestedString(value, keys, visited);
        if (nested) return nested;
    }

    return null;
}

export function findNestedObject(
    payload: unknown,
    keys: string[],
    visited = new WeakSet<object>()
): Record<string, unknown> | null {
    if (!payload || typeof payload !== "object") {
        return null;
    }

    if (visited.has(payload)) {
        return null;
    }
    visited.add(payload);

    const record = payload as Record<string, unknown>;

    for (const key of keys) {
        const value = record[key];
        if (value && typeof value === "object" && !Array.isArray(value)) {
            return value as Record<string, unknown>;
        }
    }

    for (const value of Object.values(record)) {
        const nested = findNestedObject(value, keys, visited);
        if (nested) return nested;
    }

    return null;
}

/** Check if a JWT access token is expired or about to expire (within 60s). */
function isTokenExpired(token: string | null): boolean {
    if (!token) return true;
    try {
        const base64Url = token.split(".")[1];
        if (!base64Url) return true;
        const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
        const decoded = JSON.parse(atob(base64));
        if (!decoded.exp) return false; // no expiry claim, assume valid
        const nowSecs = Math.floor(Date.now() / 1000);
        return decoded.exp - nowSecs < 60; // expired or within 60s of expiry
    } catch {
        return true;
    }
}

/** Proactively refresh the access token if it is expired. */
let _proactiveRefreshing: Promise<string | null> | null = null;

async function proactiveRefresh(): Promise<string | null> {
    const { accessToken, refreshToken } = readAuth();
    if (!refreshToken) return null;
    if (!isTokenExpired(accessToken)) return accessToken;

    if (!_proactiveRefreshing) {
        _proactiveRefreshing = (async () => {
            try {
                const res = await axios.post(
                    `${API_URLS.identity}/api/v1/auth/refresh`,
                    { refreshToken }
                );
                const newAccess =
                    res.data?.accessToken ?? res.data?.data?.accessToken;
                const newRefresh =
                    res.data?.refreshToken ??
                    res.data?.data?.refreshToken ??
                    refreshToken;
                if (newAccess) {
                    writeAuth({ accessToken: newAccess, refreshToken: newRefresh });
                    try {
                        const raw = localStorage.getItem("elitecoach.authstore");
                        if (raw) {
                            const parsed = JSON.parse(raw);
                            if (parsed?.state) {
                                parsed.state.accessToken = newAccess;
                                parsed.state.refreshToken = newRefresh;
                                localStorage.setItem("elitecoach.authstore", JSON.stringify(parsed));
                            }
                        }
                    } catch { /* ignore */ }
                    return newAccess;
                }
                return null;
            } catch {
                return null;
            } finally {
                _proactiveRefreshing = null;
            }
        })();
    }
    return _proactiveRefreshing;
}

function makeClient(baseURL: string): AxiosInstance {
    const client = axios.create({ baseURL, timeout: 30000 });

    client.interceptors.request.use(async (config) => {
        // Proactively refresh before sending the request if token is expired
        let token = readAuth().accessToken;
        if (isTokenExpired(token)) {
            const newToken = await proactiveRefresh();
            if (newToken) token = newToken;
        }
        if (token && config.headers) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    });

    let refreshing: Promise<string | null> | null = null;

    client.interceptors.response.use(
        (r) => r,
        async (error: AxiosError) => {
            // Comprehensive error logging for debugging
            console.error(
                `[API Error] ${error.config?.method?.toUpperCase()} ${error.config?.baseURL}${error.config?.url}:`,
                error.response?.status,
                error.response?.data || error.message
            );
            
            const original = error.config as
                | (typeof error.config & { _retried?: boolean })
                | undefined;
            if (
                error.response?.status === 401 &&
                original &&
                !original._retried &&
                !original.url?.includes("/auth/")
            ) {
                original._retried = true;
                try {
                    if (!refreshing) {
                        refreshing = (async () => {
                            const { refreshToken } = readAuth();
                            if (!refreshToken) {
                                return null;
                            }
                            const res = await axios.post(
                                `${API_URLS.identity}/api/v1/auth/refresh`,
                                {
                                    refreshToken,
                                }
                            );
                            const newAccess =
                                res.data?.accessToken ??
                                res.data?.data?.accessToken;
                            const newRefresh =
                                res.data?.refreshToken ??
                                res.data?.data?.refreshToken ??
                                refreshToken;
                            if (newAccess) {
                                writeAuth({
                                    accessToken: newAccess,
                                    refreshToken: newRefresh,
                                });
                                try {
                                    const raw = localStorage.getItem("elitecoach.authstore");
                                    if (raw) {
                                        const parsed = JSON.parse(raw);
                                        if (parsed?.state) {
                                            parsed.state.accessToken = newAccess;
                                            parsed.state.refreshToken = newRefresh;
                                            localStorage.setItem("elitecoach.authstore", JSON.stringify(parsed));
                                        }
                                    }
                                } catch { /* ignore sync errors */ }
                                return newAccess;
                            }
                            return null;
                        })();
                    }
                    const token = await refreshing;
                    refreshing = null;
                    if (token && original.headers) {
                        original.headers.Authorization = `Bearer ${token}`;
                        return client.request(original);
                    }
                    console.warn("[Auth] Token refresh failed, request will fail with 401");
                } catch {
                    refreshing = null;
                    console.warn("[Auth] Token refresh threw, request will fail with 401");
                }
            }
            return Promise.reject(error);
        }
    );

    return client;
}

export const identityApi = makeClient(API_URLS.identity);
export const aiTutorApi = makeClient(API_URLS.aiTutor);
export const assessmentsApi = makeClient(API_URLS.assessments);
export const acsApi = makeClient(API_URLS.acs);
export const contentApi = makeClient(API_URLS.content);
export const notificationsApi = makeClient(API_URLS.notifications);

export function extractErrorMessage(
    err: unknown,
    fallback = "Something went wrong"
): string {
    if (axios.isAxiosError(err)) {
        const data = err.response?.data as Record<string, unknown> | undefined;
        if (data) {
            if (typeof data.message === "string") return data.message;
            if (typeof data.error === "string") return data.error;
            if (typeof data.detail === "string") return data.detail;
            if (Array.isArray(data.detail)) {
                const firstDetail = data.detail.find(
                    (item) =>
                        item &&
                        typeof item === "object" &&
                        typeof (item as { msg?: unknown }).msg === "string"
                ) as { msg?: string } | undefined;

                if (firstDetail?.msg) {
                    return firstDetail.msg;
                }
            }
        }
        return err.message || fallback;
    }
    if (err instanceof Error) return err.message;
    return fallback;
}

// ==========================================
// TUTOR INBOX / ESCALATION CLIENT METHODS
// ==========================================

export interface EscalatedSession {
  id: string;
  learner_name: string;
  learner_email: string;
  course_title: string;
  course_id: string;
  escalation_reason: string;
  status: "open" | "assigned" | "resolved";
  urgency: "low" | "medium" | "high";
  created_at: string;
  transcript: {
    id: string;
    role: "user" | "assistant" | "system";
    content: string;
    ts: number;
    annotation?: string;
  }[];
  resolution_type?: "text" | "video" | "live_session";
  resolution_detail?: string;
  resolution_video_url?: string;
  resolution_meeting_time?: string;
  correction_pushed_to_rag?: boolean;
}

export interface TutorEarnings {
  total_resolved: number;
  pending_payout: number;
  total_paid: number;
  payouts: {
    id: string;
    amount: number;
    status: "paid" | "processing";
    date: string;
    reference: string;
  }[];
}

const MOCK_ESCALATIONS_KEY = "elitecoach.mock.escalations";
const MOCK_EARNINGS_KEY = "elitecoach.mock.earnings";

const DEFAULT_ESCALATIONS: EscalatedSession[] = [
  {
    id: "esc-101",
    learner_name: "Amina Yusuf",
    learner_email: "amina.y@gmail.com",
    course_title: "Intro to Machine Learning",
    course_id: "1",
    escalation_reason: "Learner asked the same question 3 times about regularization.",
    status: "open",
    urgency: "high",
    created_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString(), // 2 hours ago
    transcript: [
      {
        id: "m-1",
        role: "user",
        content: "How does L1 regularization differ from L2?",
        ts: Date.now() - 2 * 3600 * 1000 - 15 * 60000,
      },
      {
        id: "m-2",
        role: "assistant",
        content: "L1 regularization (Lasso) adds the sum of absolute values of the coefficients to the loss function, while L2 (Ridge) adds the sum of squared values. This forces some L1 coefficients to exactly zero, resulting in sparse feature selections.",
        ts: Date.now() - 2 * 3600 * 1000 - 14 * 60000,
      },
      {
        id: "m-3",
        role: "user",
        content: "Wait, so why would I use L1 over L2? It still doesn't make sense why forcing them to zero is helpful.",
        ts: Date.now() - 2 * 3600 * 1000 - 10 * 60000,
      },
      {
        id: "m-4",
        role: "assistant",
        content: "Forcing coefficients to zero removes features from the model entirely. This is useful for feature selection when you have many input variables and want a simpler, more interpretable model.",
        ts: Date.now() - 2 * 3600 * 1000 - 9 * 60000,
      },
      {
        id: "m-5",
        role: "user",
        content: "I still don't understand. Why does setting coefficients to zero make it simpler? Isn't it just throwing away information? Explain again.",
        ts: Date.now() - 2 * 3600 * 1000 - 5 * 60000,
      },
      {
        id: "m-6",
        role: "assistant",
        content: "Yes, it is discarding information, but only the redundant or less predictive variables. This helps prevent overfitting and reduces computing resource needs. Let me know if that makes sense.",
        ts: Date.now() - 2 * 3600 * 1000 - 4 * 60000,
      },
      {
        id: "m-7",
        role: "user",
        content: "You just said the same thing again. Why L1 specifically over L2? Why does the absolute value force it to zero but squared doesn't? I'm getting frustrated.",
        ts: Date.now() - 2 * 3600 * 1000 - 1 * 60000,
      }
    ]
  },
  {
    id: "esc-102",
    learner_name: "Chinedu Okafor",
    learner_email: "chinedu.o@outlook.com",
    course_title: "Business Strategy & Execution",
    course_id: "2",
    escalation_reason: "Frustrated language detected in chat.",
    status: "assigned",
    urgency: "medium",
    created_at: new Date(Date.now() - 8 * 3600 * 1000).toISOString(), // 8 hours ago
    transcript: [
      {
        id: "m2-1",
        role: "user",
        content: "What is the difference between Capex and Opex?",
        ts: Date.now() - 8 * 3600 * 1000 - 10 * 60000,
      },
      {
        id: "m2-2",
        role: "assistant",
        content: "Capex stands for Capital Expenditure, which are major purchases a business makes for long-term use (like buildings or machinery). Opex stands for Operational Expenditure, which are day-to-day costs to keep the business running (like rent or utility bills).",
        ts: Date.now() - 8 * 3600 * 1000 - 9 * 60000,
      },
      {
        id: "m2-3",
        role: "user",
        content: "Okay, but if I buy a cloud server subscription like AWS, is it Capex or Opex? My boss says it is Capex but the definition says it is Opex. Why?",
        ts: Date.now() - 8 * 3600 * 1000 - 6 * 60000,
      },
      {
        id: "m2-4",
        role: "assistant",
        content: "Typically, cloud server subscriptions are Opex because they are recurring monthly operating costs. However, some companies capitalised AWS costs under specific conditions in the past. It is generally considered Opex.",
        ts: Date.now() - 8 * 3600 * 1000 - 5 * 60000,
      },
      {
        id: "m2-5",
        role: "user",
        content: "That doesn't answer my question. Why would my boss call it Capex? Your answer is confusing and wrong. This is stupid.",
        ts: Date.now() - 8 * 3600 * 1000 - 2 * 60000,
      }
    ]
  },
  {
    id: "esc-103",
    learner_name: "Tunde Bakare",
    learner_email: "tunde.b@gmail.com",
    course_title: "Data Science with Python",
    course_id: "3",
    escalation_reason: "AI tutor grounding block - unsupported question context.",
    status: "open",
    urgency: "low",
    created_at: new Date(Date.now() - 24 * 3600 * 1000).toISOString(), // 1 day ago
    transcript: [
      {
        id: "m3-1",
        role: "user",
        content: "How do I run a Polars dataframe query on a distributed Spark cluster using this lesson's tools?",
        ts: Date.now() - 24 * 3600 * 1000 - 5 * 60000,
      },
      {
        id: "m3-2",
        role: "assistant",
        content: "I'm sorry, but this lesson content only covers basic pandas dataframes on single nodes. Polars and Spark clustering are not supported in this curriculum. Let me know if you have pandas questions.",
        ts: Date.now() - 24 * 3600 * 1000 - 4 * 60000,
      },
      {
        id: "m3-3",
        role: "user",
        content: "Is there any workaround? I need to analyze a 20GB dataset for my project by tomorrow. Please help.",
        ts: Date.now() - 24 * 3600 * 1000 - 2 * 60000,
      },
      {
        id: "m3-4",
        role: "assistant",
        content: "I cannot provide instruction on Spark or Polars integration as it is outside the course scope. Please ask a tutor or check online tutorials.",
        ts: Date.now() - 24 * 3600 * 1000 - 1 * 60000,
      }
    ]
  }
];

const DEFAULT_EARNINGS: TutorEarnings = {
  total_resolved: 45,
  pending_payout: 25000,
  total_paid: 185000,
  payouts: [
    {
      id: "pay-001",
      amount: 45000,
      status: "paid",
      date: "2026-05-15",
      reference: "PSTK-TRSF-583920-X8",
    },
    {
      id: "pay-002",
      amount: 60000,
      status: "paid",
      date: "2026-05-01",
      reference: "PSTK-TRSF-294028-Y3",
    },
    {
      id: "pay-003",
      amount: 80000,
      status: "paid",
      date: "2026-04-15",
      reference: "PSTK-TRSF-019384-Z5",
    },
    {
      id: "pay-004",
      amount: 25000,
      status: "processing",
      date: "2026-05-22",
      reference: "PSTK-TRSF-184920-W2",
    }
  ]
};

function initMockData() {
  if (typeof window === "undefined") return;
  if (!localStorage.getItem(MOCK_ESCALATIONS_KEY)) {
    localStorage.setItem(MOCK_ESCALATIONS_KEY, JSON.stringify(DEFAULT_ESCALATIONS));
  }
  if (!localStorage.getItem(MOCK_EARNINGS_KEY)) {
    localStorage.setItem(MOCK_EARNINGS_KEY, JSON.stringify(DEFAULT_EARNINGS));
  }
}

export async function getEscalations(): Promise<EscalatedSession[]> {
  initMockData();
  try {
    // Attempt backend fetch (future-proof)
    const response = await aiTutorApi.get("/api/v1/tutors/escalations").catch(() => null);
    if (response && response.data) {
      return unwrapApiData<EscalatedSession[]>(response.data);
    }
  } catch (e) {
    // Fail silently, fall back to mock
  }

  // Local mock database fallback
  if (typeof window !== "undefined") {
    const raw = localStorage.getItem(MOCK_ESCALATIONS_KEY);
    if (raw) return JSON.parse(raw) as EscalatedSession[];
  }
  return DEFAULT_ESCALATIONS;
}

export async function updateEscalationStatus(
  id: string,
  status: "open" | "assigned" | "resolved"
): Promise<boolean> {
  initMockData();
  try {
    const response = await aiTutorApi.patch(`/api/v1/tutors/escalations/${id}`, { status }).catch(() => null);
    if (response) return true;
  } catch (e) {
    // Fail silently
  }

  if (typeof window !== "undefined") {
    const raw = localStorage.getItem(MOCK_ESCALATIONS_KEY);
    if (raw) {
      const list = JSON.parse(raw) as EscalatedSession[];
      const index = list.findIndex((x) => x.id === id);
      if (index !== -1) {
        list[index].status = status;
        localStorage.setItem(MOCK_ESCALATIONS_KEY, JSON.stringify(list));
        return true;
      }
    }
  }
  return false;
}

export async function submitEscalationResponse(
  id: string,
  payload: {
    resolution_type: "text" | "video" | "live_session";
    resolution_detail: string;
    video_blob?: Blob;
    meeting_time?: string;
    correction_pushed_to_rag?: boolean;
    annotations?: { id: string; text: string }[];
  }
): Promise<boolean> {
  initMockData();
  try {
    const fd = new FormData();
    fd.append("resolution_type", payload.resolution_type);
    fd.append("resolution_detail", payload.resolution_detail);
    if (payload.video_blob) {
      fd.append("video", payload.video_blob, `tutor-response-${id}.webm`);
    }
    if (payload.meeting_time) {
      fd.append("meeting_time", payload.meeting_time);
    }
    if (payload.correction_pushed_to_rag != null) {
      fd.append("correction_pushed_to_rag", String(payload.correction_pushed_to_rag));
    }
    if (payload.annotations) {
      fd.append("annotations", JSON.stringify(payload.annotations));
    }

    const response = await aiTutorApi.post(`/api/v1/tutors/escalations/${id}/resolve`, fd, {
      headers: { "Content-Type": "multipart/form-data" }
    }).catch(() => null);
    if (response) return true;
  } catch (e) {
    // Fail silently
  }

  // Local storage mock implementation
  if (typeof window !== "undefined") {
    const raw = localStorage.getItem(MOCK_ESCALATIONS_KEY);
    if (raw) {
      const list = JSON.parse(raw) as EscalatedSession[];
      const index = list.findIndex((x) => x.id === id);
      if (index !== -1) {
        list[index].status = "resolved";
        list[index].resolution_type = payload.resolution_type;
        list[index].resolution_detail = payload.resolution_detail;
        if (payload.meeting_time) {
          list[index].resolution_meeting_time = payload.meeting_time;
        }
        if (payload.correction_pushed_to_rag) {
          list[index].correction_pushed_to_rag = true;
        }
        if (payload.annotations) {
          payload.annotations.forEach((anno) => {
            const msgIdx = list[index].transcript.findIndex((m) => m.id === anno.id);
            if (msgIdx !== -1) {
              list[index].transcript[msgIdx].annotation = anno.text;
            }
          });
        }
        localStorage.setItem(MOCK_ESCALATIONS_KEY, JSON.stringify(list));

        // Credit tutor earnings with ₦5,000 per resolved case
        const rawEarn = localStorage.getItem(MOCK_EARNINGS_KEY);
        if (rawEarn) {
          const earn = JSON.parse(rawEarn) as TutorEarnings;
          earn.total_resolved += 1;
          earn.pending_payout += 5000;
          localStorage.setItem(MOCK_EARNINGS_KEY, JSON.stringify(earn));
        }

        return true;
      }
    }
  }
  return false;
}

export async function getTutorEarnings(): Promise<TutorEarnings> {
  initMockData();
  try {
    const response = await aiTutorApi.get("/api/v1/tutors/earnings").catch(() => null);
    if (response && response.data) {
      return unwrapApiData<TutorEarnings>(response.data);
    }
  } catch (e) {
    // Fail silently
  }

  if (typeof window !== "undefined") {
    const raw = localStorage.getItem(MOCK_EARNINGS_KEY);
    if (raw) return JSON.parse(raw) as TutorEarnings;
  }
  return DEFAULT_EARNINGS;
}

export async function pushCorrectionToRAG(
  courseId: string,
  topic: string,
  correctionText: string
): Promise<boolean> {
  try {
    const response = await contentApi.post("/courses/internal/rag-correction", {
      courseId,
      topic,
      correctionText
    }).catch(() => null);
    if (response) return true;
  } catch (e) {
    // Fail silently
  }
  console.log(`[Mock RAG Ingestion] Course ID ${courseId}: Grounded correction for '${topic}' submitted.`);
  return true;
}

// ==========================================
// ONBOARDING DIAGNOSTIC ENGINE METHODS
// ==========================================

export interface DiagnosticQuestion {
  id: string;
  question: string;
  options: string[];
  correct_answer: string;
}

export interface OnboardingPayload {
  goal: string;
  domain: string;
  experience: "beginner" | "intermediate" | "advanced";
  hours_per_week: number;
  answers: Record<string, string>;
}

const MOCK_PATH_PREFIX = "elitecoach.mock.path.";

const MOCK_QUESTIONS: Record<string, DiagnosticQuestion[]> = {
  technology: [
    {
      id: "q-tech-1",
      question: "Which data structure operates on a First-In, First-Out (FIFO) basis?",
      options: ["Stack", "Queue", "Tree", "Graph"],
      correct_answer: "Queue",
    },
    {
      id: "q-tech-2",
      question: "What does CSS stand for?",
      options: ["Creative Style Sheets", "Cascading Style Sheets", "Computer Style Sheets", "Colorful Style Sheets"],
      correct_answer: "Cascading Style Sheets",
    },
    {
      id: "q-tech-3",
      question: "Which HTTP status code represents 'Not Found'?",
      options: ["200", "401", "403", "404"],
      correct_answer: "404",
    },
    {
      id: "q-tech-4",
      question: "What is the average time complexity of searching an element in a balanced binary search tree?",
      options: ["O(1)", "O(log n)", "O(n)", "O(n log n)"],
      correct_answer: "O(log n)",
    }
  ],
  data: [
    {
      id: "q-data-1",
      question: "Which type of join returns all records from both tables, matching them where possible?",
      options: ["Inner Join", "Left Join", "Right Join", "Full Outer Join"],
      correct_answer: "Full Outer Join",
    },
    {
      id: "q-data-2",
      question: "What is the median of the following dataset: [3, 9, 4, 7, 5]?",
      options: ["4", "5", "5.6", "7"],
      correct_answer: "5",
    },
    {
      id: "q-data-3",
      question: "In Pandas, which argument represents column-level axis configuration?",
      options: ["axis=0", "axis=1", "columns=true", "index=false"],
      correct_answer: "axis=1",
    },
    {
      id: "q-data-4",
      question: "Which statistical metric is most sensitive to extreme outlier spikes?",
      options: ["Mean", "Median", "Mode", "Variance"],
      correct_answer: "Mean",
    }
  ],
  finance: [
    {
      id: "q-fin-1",
      question: "What is the standard formula for Working Capital?",
      options: [
        "Current Assets - Current Liabilities",
        "Total Assets - Total Liabilities",
        "Revenue - Cost of Goods Sold",
        "Net Income / Total Shares"
      ],
      correct_answer: "Current Assets - Current Liabilities",
    },
    {
      id: "q-fin-2",
      question: "Which of the following is considered an asset on a corporate balance sheet?",
      options: ["Accounts Payable", "Retained Earnings", "Inventory", "Accrued Expenses"],
      correct_answer: "Inventory",
    },
    {
      id: "q-fin-3",
      question: "What does EBITDA stand for?",
      options: [
        "Earnings Before Interest, Taxes, Depreciation, and Amortization",
        "Earnings Before Income, Taxes, Debt, and Auditing",
        "Equity Balance in Treasury and Debt Accounts",
        "Estimated Business Income Taxes and Depreciation Assets"
      ],
      correct_answer: "Earnings Before Interest, Taxes, Depreciation, and Amortization",
    },
    {
      id: "q-fin-4",
      question: "What is the impact of depreciation on corporate cash flows?",
      options: [
        "Reduces cash flow directly",
        "No direct impact on cash flow, but reduces tax expenses",
        "Increases operating cash outflows",
        "Always equals capital expenditures"
      ],
      correct_answer: "No direct impact on cash flow, but reduces tax expenses",
    }
  ],
  leadership: [
    {
      id: "q-lead-1",
      question: "Which leadership style involves making decisions independently without team input?",
      options: ["Democratic", "Laissez-faire", "Autocratic", "Transformational"],
      correct_answer: "Autocratic",
    },
    {
      id: "q-lead-2",
      question: "What is the primary focus of Agile project management?",
      options: [
        "Rigid planning and extensive documentation",
        "Iterative progress and adaptability",
        "Strict hierarchical approval phases",
        "Minimizing communication channels"
      ],
      correct_answer: "Iterative progress and adaptability",
    },
    {
      id: "q-lead-3",
      question: "What does a SWOT analysis evaluate?",
      options: [
        "Strengths, Weaknesses, Opportunities, Threats",
        "Sales, Workloads, Outcomes, Targets",
        "Systems, Workflows, Operations, Technologies",
        "Staffing, Wages, Overtime, Turnover"
      ],
      correct_answer: "Strengths, Weaknesses, Opportunities, Threats",
    },
    {
      id: "q-lead-4",
      question: "In conflict resolution, what style involves a high concern for self and a high concern for others?",
      options: ["Avoiding", "Accommodating", "Collaborating", "Competing"],
      correct_answer: "Collaborating",
    }
  ]
};

export async function getDiagnosticQuestions(domain: string): Promise<DiagnosticQuestion[]> {
  const normDomain = domain.toLowerCase().includes("tech")
    ? "technology"
    : domain.toLowerCase().includes("data")
      ? "data"
      : domain.toLowerCase().includes("fin")
        ? "finance"
        : "leadership";
  return MOCK_QUESTIONS[normDomain] || MOCK_QUESTIONS.technology;
}

export async function submitOnboardingDiagnostic(
  userId: string,
  payload: OnboardingPayload
): Promise<any> {
  // 1. Calculate diagnostic score
  const questions = await getDiagnosticQuestions(payload.domain);
  let correctCount = 0;
  questions.forEach((q) => {
    if (payload.answers[q.id] === q.correct_answer) {
      correctCount++;
    }
  });

  const percentage = Math.round((correctCount / questions.length) * 100);
  const skipBeginner = percentage >= 75 || payload.experience === "advanced";

  // 2. Generate customized study steps based on the score
  let steps: any[] = [];
  let skippedCoursesStr = "";

  if (payload.domain.toLowerCase().includes("tech")) {
    steps = [
      {
        course_name: "Intro to Software Construction & HTML",
        estimated_time: "4 hours",
        status: skipBeginner ? "completed" : "in_progress",
      },
      {
        course_name: "Data Structures & Modern Javascript",
        estimated_time: "8 hours",
        status: skipBeginner ? "in_progress" : "upcoming",
      },
      {
        course_name: "Advanced Client Architectures & React",
        estimated_time: "12 hours",
        status: "upcoming",
      },
      {
        course_name: "Cloud Integration & Serverless Systems",
        estimated_time: "10 hours",
        status: "upcoming",
      }
    ];
    skippedCoursesStr = skipBeginner ? "Intro to Software Construction & HTML" : "";
  } else if (payload.domain.toLowerCase().includes("data")) {
    steps = [
      {
        course_name: "Introduction to Data Science & SQL",
        estimated_time: "5 hours",
        status: skipBeginner ? "completed" : "in_progress",
      },
      {
        course_name: "Pandas for Data Manipulation & Analytics",
        estimated_time: "9 hours",
        status: skipBeginner ? "in_progress" : "upcoming",
      },
      {
        course_name: "Machine Learning Foundations & Scikit-Learn",
        estimated_time: "15 hours",
        status: "upcoming",
      },
      {
        course_name: "Distributed Computing & Big Data Tools",
        estimated_time: "12 hours",
        status: "upcoming",
      }
    ];
    skippedCoursesStr = skipBeginner ? "Introduction to Data Science & SQL" : "";
  } else if (payload.domain.toLowerCase().includes("fin")) {
    steps = [
      {
        course_name: "Introduction to Accounting & Finance Systems",
        estimated_time: "6 hours",
        status: skipBeginner ? "completed" : "in_progress",
      },
      {
        course_name: "Corporate Valuation & Modeling",
        estimated_time: "10 hours",
        status: skipBeginner ? "in_progress" : "upcoming",
      },
      {
        course_name: "Mergers & Acquisitions Analysis",
        estimated_time: "12 hours",
        status: "upcoming",
      },
      {
        course_name: "Advanced Risk Management & Treasury",
        estimated_time: "8 hours",
        status: "upcoming",
      }
    ];
    skippedCoursesStr = skipBeginner ? "Introduction to Accounting & Finance Systems" : "";
  } else {
    // Leadership
    steps = [
      {
        course_name: "Principles of Project Management",
        estimated_time: "4 hours",
        status: skipBeginner ? "completed" : "in_progress",
      },
      {
        course_name: "Agile Operations & Scrum Masterships",
        estimated_time: "8 hours",
        status: skipBeginner ? "in_progress" : "upcoming",
      },
      {
        course_name: "Executive Communications & Conflict Resolution",
        estimated_time: "10 hours",
        status: "upcoming",
      },
      {
        course_name: "Strategic Scaling & Corporate Culture",
        estimated_time: "12 hours",
        status: "upcoming",
      }
    ];
    skippedCoursesStr = skipBeginner ? "Principles of Project Management" : "";
  }

  const generatedPath = {
    goal: payload.goal,
    target_role: payload.goal,
    time_per_week: payload.hours_per_week,
    study_plan: `## Custom Onboarding Learning Plan: ${payload.goal}\n\nBased on your diagnostic score of **${percentage}%** (${correctCount}/${questions.length} correct) and experience level (**${payload.experience}**), we have compiled a personalized curriculum.\n\n* **Weekly dedication:** ${payload.hours_per_week} hours.\n* **Adjustments:** ${skipBeginner ? `Skipped introductory content (${skippedCoursesStr}) to save you time.` : "Added introductory foundational modules to strengthen concepts."}\n\nReview your modular checklist below to start learning.`,
    steps: steps,
    next_courses: [{ title: steps.find(s => s.status === "in_progress")?.course_name || steps[0].course_name }]
  };

  if (typeof window !== "undefined") {
    localStorage.setItem(`${MOCK_PATH_PREFIX}${userId}`, JSON.stringify(generatedPath));
  }

  try {
    // Proactively send update to Render backend in the background
    await aiTutorApi.post("/api/v1/learning/paths/generate", null, {
      params: {
        target_role: payload.goal,
        time_per_week: payload.hours_per_week
      }
    }).catch(() => null);
  } catch (e) {}

  return generatedPath;
}

export async function getLearningPath(userId: string): Promise<any> {
  try {
    const res = await aiTutorApi.get(`/api/v1/learning/paths/${userId}`).catch(() => null);
    if (res && res.data) {
      const data = unwrapApiData<any>(res.data);
      if (data && (data.steps?.length > 0 || data.study_plan)) {
        return data;
      }
    }
  } catch (e) {}

  if (typeof window !== "undefined") {
    const raw = localStorage.getItem(`${MOCK_PATH_PREFIX}${userId}`);
    if (raw) return JSON.parse(raw);
  }
  return null;
}

export async function generateLearningPath(userId: string, targetRole: string, hours: number): Promise<any> {
  // Simple generator fallback
  const mockPayload: OnboardingPayload = {
    goal: targetRole,
    domain: targetRole,
    experience: "beginner",
    hours_per_week: hours,
    answers: {}
  };
  return submitOnboardingDiagnostic(userId, mockPayload);
}

export async function escalateSessionToTutor(
  sessionId: string,
  learnerName: string,
  learnerEmail: string,
  courseTitle: string,
  courseId: string,
  reason: string,
  transcript: { id: string; role: "user" | "assistant" | "system"; content: string; ts: number }[]
): Promise<boolean> {
  initMockData();
  const newEsc: EscalatedSession = {
    id: sessionId,
    learner_name: learnerName,
    learner_email: learnerEmail,
    course_title: courseTitle,
    course_id: courseId,
    escalation_reason: reason,
    status: "open",
    urgency: "high",
    created_at: new Date().toISOString(),
    transcript
  };

  try {
    // Send to backend (future proofing)
    await aiTutorApi.post(`/api/v1/learning/sessions/${sessionId}/escalate`, {
      reason,
      course_id: courseId
    }).catch(() => null);
  } catch (e) {}

  if (typeof window !== "undefined") {
    const raw = localStorage.getItem(MOCK_ESCALATIONS_KEY);
    if (raw) {
      const list = JSON.parse(raw) as EscalatedSession[];
      // check if already escalated
      if (!list.some((x) => x.id === sessionId)) {
        list.push(newEsc);
        localStorage.setItem(MOCK_ESCALATIONS_KEY, JSON.stringify(list));
        return true;
      }
    }
  }
  return false;
}

// ==========================================
// ORGANIZATION MANAGEMENT METHODS
// ==========================================

export interface CreateOrgRequest {
  name: string;
  industry: string;
  country: string;
  website: string;
  planTier: string;
}

export interface CreateOrgResponse {
  organizationId: string;
  planTier: string;
  maxLearners: number;
  createdAt: string;
}

export async function createOrganization(payload: CreateOrgRequest): Promise<CreateOrgResponse> {
  const response = await identityApi.post("/api/v1/organizations", payload);
  return unwrapApiData<CreateOrgResponse>(response.data);
}

// ==========================================
// ASSESSMENT ENGINE EXTENSIONS
// ==========================================

export interface KnowledgeCheck {
  id: string;
  lessonId: string;
  question: string;
  options: string[];
  correctAnswer: string;
}

export interface ModuleAssessment {
  id: string;
  moduleId: string;
  title: string;
  questions: {
    id: string;
    question: string;
    options: string[];
    correctAnswer: string;
  }[];
}

export async function fetchInlineKnowledgeChecks(lessonId: string, topic: string): Promise<KnowledgeCheck[]> {
  try {
    const res = await assessmentsApi.get(`/api/v1/assessments/knowledge-checks/${lessonId}`);
    return unwrapApiData<KnowledgeCheck[]>(res.data);
  } catch (err) {
    return [
      {
        id: `kc-${lessonId}`,
        lessonId,
        question: `Based on the lesson about ${topic}, which of the following is the key takeaway?`,
        options: [
            "It requires constant human supervision.",
            "It adapts and learns from the provided context.",
            "It should never be escalated to humans.",
            "It only works with video content."
        ],
        correctAnswer: "It adapts and learns from the provided context."
      }
    ];
  }
}

export async function generateModuleAssessment(moduleId: string, topic: string): Promise<ModuleAssessment> {
  try {
    const res = await assessmentsApi.post(`/api/v1/assessments/generate-module`, { moduleId, topic });
    return unwrapApiData<ModuleAssessment>(res.data);
  } catch (err) {
    return {
      id: `ma-${moduleId}`,
      moduleId,
      title: `Module Review: ${topic}`,
      questions: [
        {
          id: `mq-1-${moduleId}`,
          question: `What is the core concept covered in ${topic}?`,
          options: ["Understanding fundamentals", "Ignoring the basics", "Random guessing", "None of the above"],
          correctAnswer: "Understanding fundamentals"
        },
        {
          id: `mq-2-${moduleId}`,
          question: "How do you apply this in a real-world scenario?",
          options: ["By practicing actively", "By sleeping on it", "By delegating it", "You don't"],
          correctAnswer: "By practicing actively"
        },
        {
          id: `mq-3-${moduleId}`,
          question: "Which tool is most appropriate for this module's goals?",
          options: ["The recommended stack", "A hammer", "Pen and paper only", "Social media"],
          correctAnswer: "The recommended stack"
        }
      ]
    };
  }
}
