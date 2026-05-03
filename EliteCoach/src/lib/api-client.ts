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
                    // Sync to zustand persisted store
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
                                // Sync refreshed tokens back into the zustand persisted store
                                // so page reloads don't lose the session
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
                    // Don't force-redirect — let the route guards handle it.
                    // The API call just fails; the UI will show an error state
                    // instead of yanking the user to /login for a transient 401.
                    console.warn("[Auth] Token refresh failed, request will fail with 401");
                } catch {
                    refreshing = null;
                    // Same as above: don't nuke the session for a transient failure.
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
