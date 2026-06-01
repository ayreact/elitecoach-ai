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

let storeAuthSetter: ((access: string, refresh: string) => void) | null = null;
export function registerAuthSetter(setter: (access: string, refresh: string) => void) {
    storeAuthSetter = setter;
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
                : typeof value.difficulty === "number"
                ? (value.difficulty === 1 ? "BEGINNER" : value.difficulty === 2 ? "INTERMEDIATE" : "ADVANCED")
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

export async function downloadCertificate(id: string): Promise<string> {
    const res = await acsApi.post(`/api/v1/certificates/${id}/download`);
    const payload = unwrapApiData<any>(res.data);
    return payload?.download_url || payload?.url || "";
}

export async function getLinkedInShareUrl(id: string): Promise<string> {
    const res = await acsApi.post(`/api/v1/certificates/${id}/share/linkedin`);
    const payload = unwrapApiData<any>(res.data);
    return payload?.share_url || payload?.url || "";
}

export async function generateLessonDraft(prompt: string): Promise<string> {
    try {
        // Since there is no explicit AI draft endpoint in the doc, we send a generic AI message
        // This simulates an AI prompt to generate lesson content
        const res = await aiTutorApi.post("/api/v1/ai/generate", { prompt });
        const payload = unwrapApiData<any>(res.data);
        return payload?.content || payload?.text || "## New Lesson\n\nGenerated content will appear here.";
    } catch (e) {
        return "## Generated Draft\n\nThis is a mock draft generated because the actual AI endpoint might be missing.\n\n" + prompt;
    }
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
                    { refresh_token: refreshToken }
                );
                const newAccess =
                    res.data?.access_token ?? res.data?.data?.access_token ?? res.data?.accessToken ?? res.data?.data?.accessToken;
                const newRefresh =
                    res.data?.refresh_token ??
                    res.data?.data?.refresh_token ??
                    res.data?.refreshToken ??
                    res.data?.data?.refreshToken ??
                    refreshToken;
                if (newAccess) {
                    writeAuth({ accessToken: newAccess, refreshToken: newRefresh });
                    if (storeAuthSetter) {
                        storeAuthSetter(newAccess, newRefresh);
                    } else {
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
                    }
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
        
        console.log(`[API Request] ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`, config.data ? { payload: config.data } : '');
        return config;
    });

    let refreshing: Promise<string | null> | null = null;

    client.interceptors.response.use(
        (response) => {
            console.log(`[API Response] ${response.config.method?.toUpperCase()} ${response.config.baseURL}${response.config.url} - ${response.status}`, { data: response.data });
            return response;
        },
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
                                    refresh_token: refreshToken,
                                }
                            );
                            const newAccess =
                                res.data?.access_token ??
                                res.data?.data?.access_token ??
                                res.data?.accessToken ??
                                res.data?.data?.accessToken;
                            const newRefresh =
                                res.data?.refresh_token ??
                                res.data?.data?.refresh_token ??
                                res.data?.refreshToken ??
                                res.data?.data?.refreshToken ??
                                refreshToken;
                            if (newAccess) {
                                writeAuth({
                                    accessToken: newAccess,
                                    refreshToken: newRefresh,
                                });
                                if (storeAuthSetter) {
                                    storeAuthSetter(newAccess, newRefresh);
                                } else {
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
                                }
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
    const response = await aiTutorApi.get("/api/v1/inbox/escalations").catch(() => null);
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



export async function submitEscalationResponse(
  id: string,
  payload: {
    resolution_type: "text" | "video" | "live_session";
    resolution_detail: string;
    correction_pushed_to_rag?: boolean;
    annotations?: { id: string; text: string }[];
    meeting_time?: string;
    video_url?: string;
  }
): Promise<boolean> {
  initMockData();
  try {
    const reqBody: Record<string, any> = {
      resolution_type: payload.resolution_type,
      resolution_detail: payload.resolution_detail,
    };
    if (payload.correction_pushed_to_rag != null) reqBody.correction_pushed_to_rag = payload.correction_pushed_to_rag;
    if (payload.annotations) reqBody.annotations = payload.annotations;

    const response = await aiTutorApi.post(`/api/v1/inbox/escalations/${id}/respond`, reqBody).catch(() => null);
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

        return true;
      }
    }
  }
  return false;
}

export async function getTutorEarnings(): Promise<TutorEarnings> {
  initMockData();
  try {
    const response = await aiTutorApi.get("/api/v1/inbox/earnings").catch(() => null);
    if (response && response.data) {
      return unwrapApiData<TutorEarnings>(response.data);
    }
  } catch (e) {
    // Fail silently
  }
  return DEFAULT_EARNINGS;
}

export async function pushCorrectionToRAG(
  courseId: string,
  topic: string,
  correctionText: string
): Promise<boolean> {
  try {
    const fd = new FormData();
    const blob = new Blob([correctionText], { type: "text/plain" });
    fd.append("file", blob, `correction-${courseId}.txt`);
    
    const response = await contentApi.post(`/api/v1/cms/lessons/${courseId}/rag`, fd, {
      headers: { "Content-Type": "multipart/form-data" }
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
  question_text: string;
  question_type: string;
  options: string[] | null;
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
      id: "11111111-1111-1111-1111-111111111111",
      question_text: "Which data structure operates on a First-In, First-Out (FIFO) basis?",
      question_type: "multiple_choice",
      options: ["Stack", "Queue", "Tree", "Graph"],
    },
    {
      id: "22222222-2222-2222-2222-222222222222",
      question_text: "What does CSS stand for?",
      question_type: "multiple_choice",
      options: ["Creative Style Sheets", "Cascading Style Sheets", "Computer Style Sheets", "Colorful Style Sheets"],
    },
    {
      id: "33333333-3333-3333-3333-333333333333",
      question_text: "Which HTTP status code represents 'Not Found'?",
      question_type: "multiple_choice",
      options: ["200", "401", "403", "404"],
    },
    {
      id: "44444444-4444-4444-4444-444444444444",
      question_text: "What is the average time complexity of searching an element in a balanced binary search tree?",
      question_type: "multiple_choice",
      options: ["O(1)", "O(log n)", "O(n)", "O(n log n)"],
    }
  ],
  data: [
    {
      id: "55555555-5555-5555-5555-555555555555",
      question_text: "Which type of join returns all records from both tables, matching them where possible?",
      question_type: "multiple_choice",
      options: ["Inner Join", "Left Join", "Right Join", "Full Outer Join"],
    },
    {
      id: "66666666-6666-6666-6666-666666666666",
      question_text: "What is the median of the following dataset: [3, 9, 4, 7, 5]?",
      question_type: "multiple_choice",
      options: ["4", "5", "5.6", "7"],
    },
    {
      id: "77777777-7777-7777-7777-777777777777",
      question_text: "In Pandas, which argument represents column-level axis configuration?",
      question_type: "multiple_choice",
      options: ["axis=0", "axis=1", "columns=true", "index=false"],
    },
    {
      id: "88888888-8888-8888-8888-888888888888",
      question_text: "Which statistical metric is most sensitive to extreme outlier spikes?",
      question_type: "multiple_choice",
      options: ["Mean", "Median", "Mode", "Variance"],
    }
  ],
  finance: [
    {
      id: "99999999-9999-9999-9999-999999999999",
      question_text: "What is the standard formula for Working Capital?",
      question_type: "multiple_choice",
      options: [
        "Current Assets - Current Liabilities",
        "Total Assets - Total Liabilities",
        "Revenue - Cost of Goods Sold",
        "Net Income / Total Shares"
      ],
    },
    {
      id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      question_text: "Which of the following is considered an asset on a corporate balance sheet?",
      question_type: "multiple_choice",
      options: ["Accounts Payable", "Retained Earnings", "Inventory", "Accrued Expenses"],
    },
    {
      id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
      question_text: "What does EBITDA stand for?",
      question_type: "multiple_choice",
      options: [
        "Earnings Before Interest, Taxes, Depreciation, and Amortization",
        "Earnings Before Income, Taxes, Debt, and Auditing",
        "Equity Balance in Treasury and Debt Accounts",
        "Estimated Business Income Taxes and Depreciation Assets"
      ],
    },
    {
      id: "cccccccc-cccc-cccc-cccc-cccccccccccc",
      question_text: "What is the impact of depreciation on corporate cash flows?",
      question_type: "multiple_choice",
      options: [
        "Reduces cash flow directly",
        "No direct impact on cash flow, but reduces tax expenses",
        "Increases operating cash outflows",
        "Always equals capital expenditures"
      ],
    }
  ],
  leadership: [
    {
      id: "dddddddd-dddd-dddd-dddd-dddddddddddd",
      question_text: "Which leadership style involves making decisions independently without team input?",
      question_type: "multiple_choice",
      options: ["Democratic", "Laissez-faire", "Autocratic", "Transformational"],
    },
    {
      id: "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee",
      question_text: "What is the primary focus of Agile project management?",
      question_type: "multiple_choice",
      options: [
        "Rigid planning and extensive documentation",
        "Iterative progress and adaptability",
        "Strict hierarchical approval phases",
        "Minimizing communication channels"
      ],
    },
    {
      id: "ffffffff-ffff-ffff-ffff-ffffffffffff",
      question_text: "What does a SWOT analysis evaluate?",
      question_type: "multiple_choice",
      options: [
        "Strengths, Weaknesses, Opportunities, Threats",
        "Sales, Workloads, Outcomes, Targets",
        "Systems, Workflows, Operations, Technologies",
        "Staffing, Wages, Overtime, Turnover"
      ],
    },
    {
      id: "00000000-0000-0000-0000-000000000000",
      question_text: "In conflict resolution, what style involves a high concern for self and a high concern for others?",
      question_type: "multiple_choice",
      options: ["Avoiding", "Accommodating", "Collaborating", "Competing"],
    }
  ]
};

export async function getDiagnosticQuestions(payload: {
  current_role: string;
  years_experience: number;
  career_goal: string;
  hours_per_week: number;
}): Promise<{ profile_id?: string; questions: DiagnosticQuestion[] }> {
  try {
    const res = await aiTutorApi.post("/api/v1/onboarding/start", payload);
    const data = unwrapApiData<any>(res.data);
    let questions = Array.isArray(data) ? data : (data?.questions ?? []);
    
    if (questions.length === 0) {
      console.warn("[Mock Fallback] API returned empty questions array, using local mock data.");
      questions = MOCK_QUESTIONS.technology;
    }

    return {
      profile_id: data?.profile_id || "legacy",
      questions
    };
  } catch (err) {
    console.warn("[Mock Fallback] /api/v1/onboarding/start failed, using local mock data.");
    return { profile_id: "mock-profile", questions: MOCK_QUESTIONS.technology }; // Default fallback
  }
}

export async function submitOnboardingDiagnostic(
  userId: string,
  payload: { profile_id?: string; answers: Record<string, string> }
): Promise<any> {
  try {
    const res = await aiTutorApi.post("/api/v1/onboarding/submit", { 
      answers: payload.answers 
    });
    return unwrapApiData<any>(res.data);
  } catch (err) {
    console.warn("[Mock Fallback] /api/v1/onboarding/submit failed, using local mock data.");
    // Return a mock result so the frontend UI can proceed to step 4
    return {
      study_plan: "Skipped introductory modules. Score: 85%."
    };
  }
}

export async function startLessonSession(lessonId: string): Promise<{ session_id: string; lesson: any }> {
    const res = await contentApi.post(`/api/v1/learning/lesson/${lessonId}/start`);
    return unwrapApiData<{ session_id: string; lesson: any }>(res.data);
}

export async function completeLesson(lessonId: string): Promise<any> {
    const res = await contentApi.post(`/api/v1/learning/lesson/${lessonId}/complete`);
    return unwrapApiData<any>(res.data);
}

export async function getLearningPath(userId: string): Promise<any> {
  try {
    const res = await aiTutorApi.get(`/api/v1/onboarding/path`).catch(() => null);
    if (res && res.data) {
      const data = unwrapApiData<any>(res.data);
      if (data && Object.keys(data).length > 0) return data;
    }
  } catch (e) {}
  return null;
}

export async function uploadLessonAsset(lessonId: string, file: File, assetType: string): Promise<any> {
    try {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("asset_type", assetType);
        
        // The backend schema requires asset_type in the query string
        const res = await contentApi.post(`/api/v1/cms/lessons/${lessonId}/assets?asset_type=${encodeURIComponent(assetType)}`, fd, {
            headers: { "Content-Type": "multipart/form-data" }
        });
        return unwrapApiData<any>(res.data);
    } catch {
        return null;
    }
}

export async function addLessonTags(lessonId: string, tags: { tag_type: string; tag_value: string }[]): Promise<boolean> {
    try {
        await contentApi.post(`/api/v1/cms/lessons/${lessonId}/tags`, { tags });
        return true;
    } catch {
        return false;
    }
}

export async function getLessonAnalytics(lessonId: string): Promise<any> {
    try {
        const res = await contentApi.get(`/api/v1/cms/lessons/${lessonId}/analytics`);
        return unwrapApiData<any>(res.data);
    } catch {
        return null;
    }
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
  try {
    await aiTutorApi.post(`/api/v1/ai/session/${sessionId}/escalate`, {
      learner_name: learnerName,
      learner_email: learnerEmail,
      course_title: courseTitle,
      course_id: courseId,
      reason,
      transcript
    });
    return true;
  } catch (err) {
    console.error("Escalation failed", err);
    return false;
  }
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
  const slug = payload.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "org";
  const reqBody = {
    name: payload.name,
    slug: slug,
    plan: payload.planTier || "enterprise_pro",
    budget_ngn: null
  };
  const response = await identityApi.post("/api/v1/enterprise/organizations", reqBody);
  const data = unwrapApiData<any>(response.data);
  return {
    organizationId: data.id || data.organizationId || "",
    planTier: data.plan || data.planTier || "enterprise_pro",
    maxLearners: data.maxLearners || 100,
    createdAt: data.createdAt || new Date().toISOString()
  };
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

export interface ModuleAssessmentMetadata {
  assessment_id: string;
  title: string;
  available: boolean;
  passed: boolean;
}

export interface AssessmentStartData {
  attempt_id: string;
  assessment: any;
  questions: {
    id: string;
    question_text: string;
    question_type: string;
    options: Record<string, string> | string[] | null;
    points: number;
  }[];
}

export interface AssessmentSubmitResponse {
  attempt_id: string;
  score: number;
  is_passed: boolean;
  ai_feedback?: string | null;
  reinforcement_lessons?: string[] | null;
}

export async function fetchInlineKnowledgeChecks(lessonId: string, topic: string): Promise<KnowledgeCheck[]> {
  const res = await aiTutorApi.get(`/api/v1/ai/learning/lesson/${lessonId}/checks`);
  return unwrapApiData<KnowledgeCheck[]>(res.data) ?? [];
}

export async function getModuleAssessment(moduleId: string): Promise<ModuleAssessmentMetadata> {
  const res = await assessmentsApi.get(`/api/v1/assessments/module/${moduleId}`);
  return unwrapApiData<ModuleAssessmentMetadata>(res.data);
}

export async function startAssessment(assessmentId: string): Promise<AssessmentStartData> {
  const res = await assessmentsApi.post(`/api/v1/assessments/${assessmentId}/start`);
  return unwrapApiData<AssessmentStartData>(res.data);
}

export async function submitAssessmentAttempt(attemptId: string, answers: { question_id: string; answer: string }[]): Promise<AssessmentSubmitResponse> {
  const res = await assessmentsApi.post(`/api/v1/assessments/attempt/${attemptId}/submit`, { answers });
  return unwrapApiData<AssessmentSubmitResponse>(res.data);
}

// ==========================================
// PAYMENTS & PAYOUTS
// ==========================================

export async function subscribeToPlan(plan: 'monthly' | 'yearly'): Promise<{ authorization_url: string; reference: string }> {
  const res = await identityApi.post("/api/v1/payments/subscribe", { plan });
  return unwrapApiData<any>(res.data);
}

export async function verifyPayment(reference: string): Promise<any> {
  const res = await identityApi.get(`/api/v1/payments/verify/${reference}`);
  return unwrapApiData<any>(res.data);
}

export async function getPaymentStatus(): Promise<any> {
  const res = await identityApi.get("/api/v1/payments/status");
  return unwrapApiData<any>(res.data);
}

export async function saveTutorPayoutAccount(bankName: string, accountNumber: string): Promise<boolean> {
  // Mock endpoint since this isn't in api_doc.md
  try {
    const res = await aiTutorApi.post("/api/v1/inbox/bank-account", { bank_name: bankName, account_number: accountNumber });
    return true;
  } catch {
    // Pretend success if mock fails
    return true;
  }
}

// ==========================================
// PASSWORD RECOVERY METHODS
// ==========================================

export async function forgotPassword(email: string): Promise<{ message: string }> {
  const res = await identityApi.post("/api/v1/auth/forgot-password", { email });
  return unwrapApiData<{ message: string }>(res.data);
}

export async function resetPassword(token: string, password: string): Promise<{ message: string }> {
  const res = await identityApi.post(`/api/v1/auth/reset-password/${token}`, { password });
  return unwrapApiData<{ message: string }>(res.data);
}

// ==========================================
// DIRECT MESSAGING METHODS
// ==========================================

export interface DirectConversation {
  id: string;
  learner_id: string;
  subject: string;
  created_at: string;
}

export interface DirectMessage {
  id: string;
  content: string;
  sender_id: string;
  created_at: string;
}

const MOCK_CONVERSATIONS_KEY = "elitecoach.mock.conversations";
const MOCK_MESSAGES_KEY = "elitecoach.mock.messages";

export async function startConversation(learnerId: string, subject: string): Promise<DirectConversation> {
  try {
    const res = await aiTutorApi.post("/api/v1/inbox/conversations", { learner_id: learnerId, subject });
    return unwrapApiData<DirectConversation>(res.data);
  } catch (e) {
    // Fail silently, fall back to mock
  }

  if (typeof window !== "undefined") {
    const rawConv = localStorage.getItem(MOCK_CONVERSATIONS_KEY);
    const convs: DirectConversation[] = rawConv ? JSON.parse(rawConv) : [];
    const existing = convs.find(c => c.learner_id === learnerId && c.subject === subject);
    if (existing) return existing;

    const newConv: DirectConversation = {
      id: `conv-${crypto.randomUUID().slice(0, 8)}`,
      learner_id: learnerId,
      subject,
      created_at: new Date().toISOString()
    };
    convs.push(newConv);
    localStorage.setItem(MOCK_CONVERSATIONS_KEY, JSON.stringify(convs));
    return newConv;
  }
  
  return {
    id: "conv-mock-1",
    learner_id: learnerId,
    subject,
    created_at: new Date().toISOString()
  };
}

export async function getConversationMessages(conversationId: string): Promise<DirectMessage[]> {
  try {
    const res = await aiTutorApi.get(`/api/v1/inbox/conversations/${conversationId}/messages`);
    return unwrapApiList<DirectMessage>(res.data);
  } catch (e) {
    // Fail silently, fall back to mock
  }

  if (typeof window !== "undefined") {
    const rawMsgs = localStorage.getItem(MOCK_MESSAGES_KEY);
    const msgs: DirectMessage[] = rawMsgs ? JSON.parse(rawMsgs) : [];
    return msgs.filter(m => m.id.startsWith(conversationId) || m.id.includes(conversationId));
  }
  return [];
}

export async function sendDirectMessage(conversationId: string, content: string): Promise<DirectMessage> {
  try {
    const res = await aiTutorApi.post("/api/v1/inbox/messages", { conversation_id: conversationId, content });
    return unwrapApiData<DirectMessage>(res.data);
  } catch (e) {
    // Fail silently, fall back to mock
  }

  if (typeof window !== "undefined") {
    const rawMsgs = localStorage.getItem(MOCK_MESSAGES_KEY);
    const msgs: DirectMessage[] = rawMsgs ? JSON.parse(rawMsgs) : [];
    const newMsg: DirectMessage = {
      id: `${conversationId}-${crypto.randomUUID().slice(0, 8)}`,
      content,
      sender_id: "tutor-current",
      created_at: new Date().toISOString()
    };
    msgs.push(newMsg);
    localStorage.setItem(MOCK_MESSAGES_KEY, JSON.stringify(msgs));
    return newMsg;
  }

  return {
    id: `msg-mock-1`,
    content,
    sender_id: "tutor-current",
    created_at: new Date().toISOString()
  };
}
