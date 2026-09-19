// Unit tests for the localStorage-backed session helpers. jsdom provides real localStorage.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearSession, defaultApiBase, loadSession, saveSession } from "./session";

const KEY = "verity.session";

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("defaultApiBase", () => {
  it("falls back to the local backend when VITE_API_BASE is not set", () => {
    expect(defaultApiBase()).toBe("http://127.0.0.1:8026");
  });
});

describe("the session store", () => {
  it("is empty before anything is saved", () => {
    expect(loadSession()).toBeNull();
  });

  it("returns null for malformed JSON", () => {
    localStorage.setItem(KEY, "{not json");
    expect(loadSession()).toBeNull();
  });

  it("returns null when the stored value has no token", () => {
    localStorage.setItem(KEY, JSON.stringify({ api: "http://127.0.0.1:8026" }));
    expect(loadSession()).toBeNull();
  });

  it("returns the stored token and api", () => {
    localStorage.setItem(KEY, JSON.stringify({ token: "abc123", api: "http://example.test" }));
    expect(loadSession()).toEqual({ token: "abc123", api: "http://example.test" });
  });

  it("falls back to the default api when the stored value omits it", () => {
    localStorage.setItem(KEY, JSON.stringify({ token: "abc123" }));
    expect(loadSession()).toEqual({ token: "abc123", api: defaultApiBase() });
  });

  it("returns null when localStorage.getItem throws (private mode)", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(loadSession()).toBeNull();
  });

  it("round-trips a session through saveSession and loadSession", () => {
    saveSession({ token: "tok-1", api: "http://127.0.0.1:8026" });
    expect(loadSession()).toEqual({ token: "tok-1", api: "http://127.0.0.1:8026" });
  });

  it("clearSession removes the stored session", () => {
    saveSession({ token: "tok-1", api: "http://127.0.0.1:8026" });
    clearSession();
    expect(loadSession()).toBeNull();
  });

  it("never puts the token anywhere but the one key", () => {
    saveSession({ token: "secret", api: "http://127.0.0.1:8026" });
    expect(Object.keys(localStorage)).toEqual([KEY]);
  });

  it("does not throw when localStorage.setItem fails (private mode)", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(() => saveSession({ token: "tok-1", api: "http://127.0.0.1:8026" })).not.toThrow();
  });

  it("does not throw when localStorage.removeItem fails", () => {
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(() => clearSession()).not.toThrow();
  });
});
