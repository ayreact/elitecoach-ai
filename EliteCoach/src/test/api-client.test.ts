import { describe, it, expect } from "vitest";
import {
  readAuth,
  writeAuth,
  clearAuth,
  unwrapApiData,
  unwrapApiList,
  normalizeCourse,
  normalizeCourses,
  extractErrorMessage,
  findNestedString,
  findNestedObject,
  coerceIntegerId,
} from "@/lib/api-client";

// ── readAuth / writeAuth / clearAuth ──────────────────────────────────────

describe("readAuth", () => {
  it("returns nulls when localStorage is empty", () => {
    localStorage.clear();
    const auth = readAuth();
    expect(auth.accessToken).toBeNull();
    expect(auth.refreshToken).toBeNull();
  });

  it("returns stored tokens after writeAuth", () => {
    writeAuth({ accessToken: "acc", refreshToken: "ref" });
    const auth = readAuth();
    expect(auth.accessToken).toBe("acc");
    expect(auth.refreshToken).toBe("ref");
  });

  it("clearAuth removes stored tokens", () => {
    writeAuth({ accessToken: "acc", refreshToken: "ref" });
    clearAuth();
    const auth = readAuth();
    expect(auth.accessToken).toBeNull();
    expect(auth.refreshToken).toBeNull();
  });
});

// ── unwrapApiData ──────────────────────────────────────────────────────────

describe("unwrapApiData", () => {
  it("unwraps a { data } envelope", () => {
    const result = unwrapApiData<{ name: string }>({ data: { name: "Alice" } });
    expect(result).toEqual({ name: "Alice" });
  });

  it("returns payload as-is when there is no data key", () => {
    const result = unwrapApiData<string>("raw");
    expect(result).toBe("raw");
  });

  it("returns null data field when data is null", () => {
    const result = unwrapApiData<null>({ data: null });
    expect(result).toBeNull();
  });
});

// ── unwrapApiList ──────────────────────────────────────────────────────────

describe("unwrapApiList", () => {
  it("returns array from root-level array", () => {
    const result = unwrapApiList<number>([1, 2, 3]);
    expect(result).toEqual([1, 2, 3]);
  });

  it("extracts list from { data: [...] } envelope", () => {
    const result = unwrapApiList<string>({ data: ["a", "b"] });
    expect(result).toEqual(["a", "b"]);
  });

  it("extracts list from { data: { items: [...] } } envelope", () => {
    const result = unwrapApiList<number>({ data: { items: [10, 20] } });
    expect(result).toEqual([10, 20]);
  });

  it("extracts list from { data: { results: [...] } } envelope", () => {
    const result = unwrapApiList<number>({ data: { results: [7, 8] } });
    expect(result).toEqual([7, 8]);
  });

  it("returns empty array for unrecognised shape", () => {
    const result = unwrapApiList({ foo: "bar" });
    expect(result).toEqual([]);
  });
});

// ── normalizeCourse ────────────────────────────────────────────────────────

describe("normalizeCourse", () => {
  it("normalizes a minimal course object", () => {
    const course = normalizeCourse({ id: "1", title: "Intro to AI" });
    expect(course).not.toBeNull();
    expect(course!.id).toBe("1");
    expect(course!.title).toBe("Intro to AI");
  });

  it("accepts courseId as the id field", () => {
    const course = normalizeCourse({ courseId: "42", title: "ML Basics" });
    expect(course!.id).toBe("42");
  });

  it("returns null when title is missing", () => {
    expect(normalizeCourse({ id: "1" })).toBeNull();
  });

  it("returns null for non-object input", () => {
    expect(normalizeCourse(null)).toBeNull();
    expect(normalizeCourse("string")).toBeNull();
  });

  it("maps skill_tags to skills", () => {
    const course = normalizeCourse({
      id: "1",
      title: "Test",
      skill_tags: ["Python", "ML"],
    });
    expect(course!.skills).toEqual(["Python", "ML"]);
  });
});

// ── normalizeCourses ───────────────────────────────────────────────────────

describe("normalizeCourses", () => {
  it("normalizes an array of courses", () => {
    const courses = normalizeCourses([
      { id: "1", title: "Course A" },
      { id: "2", title: "Course B" },
    ]);
    expect(courses).toHaveLength(2);
    expect(courses[0].id).toBe("1");
  });

  it("filters out invalid courses silently", () => {
    const courses = normalizeCourses([
      { id: "1", title: "Valid" },
      { title: "No ID" },
      null,
    ]);
    expect(courses).toHaveLength(1);
  });

  it("returns empty array for empty input", () => {
    expect(normalizeCourses([])).toEqual([]);
  });
});

// ── extractErrorMessage ────────────────────────────────────────────────────

describe("extractErrorMessage", () => {
  it("returns fallback for non-axios errors", () => {
    expect(extractErrorMessage("oops", "default")).toBe("default");
  });

  it("returns Error.message for generic Errors", () => {
    expect(extractErrorMessage(new Error("boom"))).toBe("boom");
  });
});

// ── findNestedString ───────────────────────────────────────────────────────

describe("findNestedString", () => {
  it("finds a string at root level", () => {
    expect(findNestedString({ token: "abc" }, ["token"])).toBe("abc");
  });

  it("finds a string one level deep", () => {
    expect(findNestedString({ data: { accessToken: "xyz" } }, ["accessToken"])).toBe("xyz");
  });

  it("returns null when key not found", () => {
    expect(findNestedString({ foo: "bar" }, ["missing"])).toBeNull();
  });

  it("handles circular references without hanging", () => {
    const obj: Record<string, unknown> = { a: 1 };
    obj["self"] = obj;
    expect(() => findNestedString(obj, ["token"])).not.toThrow();
  });
});

// ── findNestedObject ───────────────────────────────────────────────────────

describe("findNestedObject", () => {
  it("finds an object at root level by key", () => {
    const result = findNestedObject({ user: { id: "1" } }, ["user"]);
    expect(result).toEqual({ id: "1" });
  });

  it("returns null when key not found", () => {
    expect(findNestedObject({ a: "string" }, ["user"])).toBeNull();
  });
});

// ── coerceIntegerId ────────────────────────────────────────────────────────

describe("coerceIntegerId", () => {
  it("returns number as-is", () => {
    expect(coerceIntegerId(5)).toBe(5);
  });

  it("coerces numeric string to number", () => {
    expect(coerceIntegerId("42")).toBe(42);
  });

  it("returns null for non-numeric string", () => {
    expect(coerceIntegerId("abc")).toBeNull();
  });

  it("returns null for null input", () => {
    expect(coerceIntegerId(null)).toBeNull();
  });

  it("returns null for floats", () => {
    expect(coerceIntegerId(3.14)).toBeNull();
  });
});
