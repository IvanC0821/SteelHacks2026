import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearSession, defaultApiBase, loadSession, saveSession } from "./session";

const KEY = "verity.session";

describe("the session store", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("is empty before anything is saved", () => {
    expect(loadSession()).toBeNull();
  });

  it("round-trips a session", () => {
    saveSession({ token: "tok_1", api: "http://127.0.0.1:8026" });
    expect(loadSession()).toEqual({ token: "tok_1", api: "http://127.0.0.1:8026" });
  });

  it("falls back to the default API base when one was not stored", () => {
    localStorage.setItem(KEY, JSON.stringify({ token: "tok_1" }));
    expect(loadSession()).toEqual({ token: "tok_1", api: defaultApiBase() });
  });

  it("treats malformed JSON as no session rather than throwing", () => {
    localStorage.setItem(KEY, "{not json");
    expect(loadSession()).toBeNull();
  });

  it("treats a stored object with no token as no session", () => {
    localStorage.setItem(KEY, JSON.stringify({ api: "http://127.0.0.1:8026" }));
    expect(loadSession()).toBeNull();
  });

  it("clears", () => {
    saveSession({ token: "tok_1", api: "http://127.0.0.1:8026" });
    clearSession();
    expect(loadSession()).toBeNull();
  });

  it("survives a storage write that throws, as in a private window", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    expect(() => saveSession({ token: "tok_1", api: "x" })).not.toThrow();
  });

  it("never puts the token anywhere but the one key", () => {
    saveSession({ token: "secret", api: "http://127.0.0.1:8026" });
    const keys = Object.keys(localStorage);
    expect(keys).toEqual([KEY]);
  });
});
