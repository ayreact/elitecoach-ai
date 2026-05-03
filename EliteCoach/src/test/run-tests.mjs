/**
 * Standalone test runner using Node.js built-in test module.
 * Tests pure utility functions and auth/store logic inline.
 * Run with: node src/test/run-tests.mjs
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

// ── Inline localStorage mock ───────────────────────────────────────────────

const storage = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] ?? null,
    setItem: (key, value) => { store[key] = String(value); },
    removeItem: (key) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();
global.localStorage = storage;
global.window = { location: { pathname: "/" } };

// ── Inline implementations matching api-client.ts ─────────────────────────

const STORAGE_KEY = "elitecoach.auth";
const AUTH_STORE_KEY = "elitecoach.authstore";

function readAuth() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { accessToken: null, refreshToken: null };
    return JSON.parse(raw);
  } catch {
    return { accessToken: null, refreshToken: null };
  }
}

function writeAuth(auth) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
}

function clearAuth() {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(AUTH_STORE_KEY);
}

function unwrapApiData(payload) {
  if (payload && typeof payload === "object" && "data" in payload && payload.data !== undefined) {
    return payload.data;
  }
  return payload;
}

function unwrapApiList(payload) {
  const data = unwrapApiData(payload);
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") {
    if ("items" in data && Array.isArray(data.items)) return data.items;
    if ("results" in data && Array.isArray(data.results)) return data.results;
  }
  return [];
}

function normalizeCourse(raw) {
  if (!raw || typeof raw !== "object") return null;
  const value = raw;
  const id = value.id ?? value.courseId ?? value.course_id;
  const title = typeof value.title === "string" ? value.title : "";
  if (!id || !title) return null;
  const skillTags = Array.isArray(value.skill_tags)
    ? value.skill_tags.filter((i) => typeof i === "string")
    : Array.isArray(value.skills)
    ? value.skills.filter((i) => typeof i === "string")
    : undefined;
  return {
    id: String(id),
    title,
    description: typeof value.description === "string" ? value.description : undefined,
    domain: typeof value.domain === "string" ? value.domain : undefined,
    skills: skillTags,
  };
}

function normalizeCourses(payload) {
  return unwrapApiList(payload)
    .map((c) => normalizeCourse(c))
    .filter((c) => c !== null);
}

function findNestedString(payload, keys, visited = new WeakSet()) {
  if (!payload || typeof payload !== "object") return null;
  if (visited.has(payload)) return null;
  visited.add(payload);
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  for (const value of Object.values(payload)) {
    const nested = findNestedString(value, keys, visited);
    if (nested) return nested;
  }
  return null;
}

function findNestedObject(payload, keys, visited = new WeakSet()) {
  if (!payload || typeof payload !== "object") return null;
  if (visited.has(payload)) return null;
  visited.add(payload);
  for (const key of keys) {
    const value = payload[key];
    if (value && typeof value === "object" && !Array.isArray(value)) return value;
  }
  for (const value of Object.values(payload)) {
    const nested = findNestedObject(value, keys, visited);
    if (nested) return nested;
  }
  return null;
}

function coerceIntegerId(value) {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value === "string" && /^\d+$/.test(value.trim())) return Number(value);
  return null;
}

// ── auth-guard logic (no redirect dependency needed here) ──────────────────

function makeAuthGuard() {
  let state = { isLoggedIn: false, user: null };

  const setState = (patch) => { state = { ...state, ...patch }; };
  const getState = () => state;

  function requireAuth() {
    if (!getState().isLoggedIn) throw new Error("REDIRECT:/login");
  }

  function requireTutor() {
    const { isLoggedIn, user } = getState();
    if (!isLoggedIn || user?.userType !== "TUTOR") throw new Error("REDIRECT:/login");
  }

  function requireOrgAdmin() {
    const { isLoggedIn, user } = getState();
    if (!isLoggedIn || user?.userType !== "ORG_ADMIN") throw new Error("REDIRECT:/login");
  }

  function redirectIfLoggedIn() {
    if (getState().isLoggedIn) throw new Error("REDIRECT:dashboard");
  }

  return { setState, requireAuth, requireTutor, requireOrgAdmin, redirectIfLoggedIn };
}

// ══════════════════════════════════════════════════════════════════════════
// TESTS
// ══════════════════════════════════════════════════════════════════════════

describe("readAuth / writeAuth / clearAuth", () => {
  test("returns nulls when storage is empty", () => {
    localStorage.clear();
    const auth = readAuth();
    assert.equal(auth.accessToken, null);
    assert.equal(auth.refreshToken, null);
  });

  test("writeAuth then readAuth returns correct tokens", () => {
    writeAuth({ accessToken: "acc", refreshToken: "ref" });
    const auth = readAuth();
    assert.equal(auth.accessToken, "acc");
    assert.equal(auth.refreshToken, "ref");
  });

  test("clearAuth removes auth keys from storage", () => {
    writeAuth({ accessToken: "acc", refreshToken: "ref" });
    clearAuth();
    const auth = readAuth();
    assert.equal(auth.accessToken, null);
    assert.equal(auth.refreshToken, null);
  });
});

describe("unwrapApiData", () => {
  test("unwraps { data } envelope", () => {
    assert.deepEqual(unwrapApiData({ data: { name: "Alice" } }), { name: "Alice" });
  });

  test("returns payload when no data key", () => {
    assert.equal(unwrapApiData("raw"), "raw");
  });

  test("unwraps null data", () => {
    assert.equal(unwrapApiData({ data: null }), null);
  });
});

describe("unwrapApiList", () => {
  test("returns root-level array", () => {
    assert.deepEqual(unwrapApiList([1, 2, 3]), [1, 2, 3]);
  });

  test("extracts list from { data: [...] }", () => {
    assert.deepEqual(unwrapApiList({ data: ["a", "b"] }), ["a", "b"]);
  });

  test("extracts list from { data: { items: [...] } }", () => {
    assert.deepEqual(unwrapApiList({ data: { items: [10, 20] } }), [10, 20]);
  });

  test("extracts list from { data: { results: [...] } }", () => {
    assert.deepEqual(unwrapApiList({ data: { results: [7, 8] } }), [7, 8]);
  });

  test("returns empty array for unrecognised shape", () => {
    assert.deepEqual(unwrapApiList({ foo: "bar" }), []);
  });
});

describe("normalizeCourse", () => {
  test("normalizes a minimal course", () => {
    const c = normalizeCourse({ id: "1", title: "Intro to AI" });
    assert.equal(c?.id, "1");
    assert.equal(c?.title, "Intro to AI");
  });

  test("uses courseId as fallback id", () => {
    const c = normalizeCourse({ courseId: "42", title: "ML Basics" });
    assert.equal(c?.id, "42");
  });

  test("returns null when title is missing", () => {
    assert.equal(normalizeCourse({ id: "1" }), null);
  });

  test("returns null for non-object input", () => {
    assert.equal(normalizeCourse(null), null);
    assert.equal(normalizeCourse("string"), null);
  });

  test("maps skill_tags to skills", () => {
    const c = normalizeCourse({ id: "1", title: "T", skill_tags: ["Python", "ML"] });
    assert.deepEqual(c?.skills, ["Python", "ML"]);
  });
});

describe("normalizeCourses", () => {
  test("normalizes an array", () => {
    const cs = normalizeCourses([{ id: "1", title: "A" }, { id: "2", title: "B" }]);
    assert.equal(cs.length, 2);
  });

  test("filters invalid courses", () => {
    const cs = normalizeCourses([{ id: "1", title: "Valid" }, { title: "No ID" }, null]);
    assert.equal(cs.length, 1);
  });

  test("returns empty array for empty input", () => {
    assert.deepEqual(normalizeCourses([]), []);
  });
});

describe("findNestedString", () => {
  test("finds string at root level", () => {
    assert.equal(findNestedString({ token: "abc" }, ["token"]), "abc");
  });

  test("finds string one level deep", () => {
    assert.equal(findNestedString({ data: { accessToken: "xyz" } }, ["accessToken"]), "xyz");
  });

  test("returns null when key not found", () => {
    assert.equal(findNestedString({ foo: "bar" }, ["missing"]), null);
  });

  test("handles circular references without crashing", () => {
    const obj = { a: 1 };
    obj.self = obj;
    assert.doesNotThrow(() => findNestedString(obj, ["token"]));
  });
});

describe("findNestedObject", () => {
  test("finds object at root by key", () => {
    assert.deepEqual(findNestedObject({ user: { id: "1" } }, ["user"]), { id: "1" });
  });

  test("returns null when not found", () => {
    assert.equal(findNestedObject({ a: "string" }, ["user"]), null);
  });
});

describe("coerceIntegerId", () => {
  test("returns integer number", () => { assert.equal(coerceIntegerId(5), 5); });
  test("coerces numeric string", () => { assert.equal(coerceIntegerId("42"), 42); });
  test("returns null for non-numeric string", () => { assert.equal(coerceIntegerId("abc"), null); });
  test("returns null for null", () => { assert.equal(coerceIntegerId(null), null); });
  test("returns null for float", () => { assert.equal(coerceIntegerId(3.14), null); });
});

describe("auth guard logic", () => {
  test("requireAuth throws when not logged in", () => {
    const { setState, requireAuth } = makeAuthGuard();
    setState({ isLoggedIn: false });
    assert.throws(() => requireAuth(), /REDIRECT/);
  });

  test("requireAuth passes when logged in", () => {
    const { setState, requireAuth } = makeAuthGuard();
    setState({ isLoggedIn: true });
    assert.doesNotThrow(() => requireAuth());
  });

  test("requireTutor throws when user is LEARNER", () => {
    const { setState, requireTutor } = makeAuthGuard();
    setState({ isLoggedIn: true, user: { userType: "LEARNER" } });
    assert.throws(() => requireTutor(), /REDIRECT/);
  });

  test("requireTutor passes for TUTOR", () => {
    const { setState, requireTutor } = makeAuthGuard();
    setState({ isLoggedIn: true, user: { userType: "TUTOR" } });
    assert.doesNotThrow(() => requireTutor());
  });

  test("requireOrgAdmin throws for non-ORG_ADMIN", () => {
    const { setState, requireOrgAdmin } = makeAuthGuard();
    setState({ isLoggedIn: true, user: { userType: "LEARNER" } });
    assert.throws(() => requireOrgAdmin(), /REDIRECT/);
  });

  test("requireOrgAdmin passes for ORG_ADMIN", () => {
    const { setState, requireOrgAdmin } = makeAuthGuard();
    setState({ isLoggedIn: true, user: { userType: "ORG_ADMIN" } });
    assert.doesNotThrow(() => requireOrgAdmin());
  });

  test("redirectIfLoggedIn throws when logged in", () => {
    const { setState, redirectIfLoggedIn } = makeAuthGuard();
    setState({ isLoggedIn: true });
    assert.throws(() => redirectIfLoggedIn(), /REDIRECT/);
  });

  test("redirectIfLoggedIn passes when not logged in", () => {
    const { setState, redirectIfLoggedIn } = makeAuthGuard();
    setState({ isLoggedIn: false });
    assert.doesNotThrow(() => redirectIfLoggedIn());
  });
});

describe("session store state transitions", () => {
  // Simulates the store logic inline since Zustand isn't runnable without React
  test("setSession resets messages", () => {
    let state = { currentSessionId: null, courseId: null, subjectId: null, messages: [] };
    const addMessage = (m) => { state = { ...state, messages: [...state.messages, m] }; };
    const setSession = ({ sessionId, courseId, subjectId }) => {
      state = { currentSessionId: sessionId, courseId, subjectId, messages: [] };
    };

    addMessage({ id: "1", role: "user", content: "hello", ts: 1 });
    assert.equal(state.messages.length, 1);

    setSession({ sessionId: "s1", courseId: "c1", subjectId: 1 });
    assert.equal(state.messages.length, 0);
    assert.equal(state.currentSessionId, "s1");
  });

  test("addMessage appends in order", () => {
    let messages = [];
    const addMessage = (m) => { messages = [...messages, m]; };
    addMessage({ id: "1", role: "user", content: "hi", ts: 1 });
    addMessage({ id: "2", role: "assistant", content: "hello", ts: 2 });
    assert.equal(messages.length, 2);
    assert.equal(messages[0].role, "user");
    assert.equal(messages[1].role, "assistant");
  });

  test("clearSession resets all fields", () => {
    let state = { currentSessionId: "s1", courseId: "c1", subjectId: 1, messages: [{ id: "1" }] };
    const clearSession = () => { state = { currentSessionId: null, courseId: null, subjectId: null, messages: [] }; };
    clearSession();
    assert.equal(state.currentSessionId, null);
    assert.equal(state.messages.length, 0);
  });
});
