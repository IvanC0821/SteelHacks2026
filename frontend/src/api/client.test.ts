// Unit tests for the typed API client against a mocked fetch. No network, no backend required.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, VerityClient } from "./client";
import type { Session } from "./session";

const SESSION: Session = { token: "test-token-123", api: "http://127.0.0.1:8026" };

function makeClient(session: Session = SESSION): VerityClient {
  return new VerityClient(session);
}

interface MockResponseInit {
  ok: boolean;
  status: number;
  jsonBody?: unknown;
  blob?: Blob;
}

function mockResponse({ ok, status, jsonBody, blob }: MockResponseInit) {
  return {
    ok,
    status,
    json: () => Promise.resolve(jsonBody),
    text: () => Promise.resolve(jsonBody === undefined ? "" : JSON.stringify(jsonBody)),
    blob: () => Promise.resolve(blob ?? new Blob()),
  };
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("VerityClient request headers and bodies", () => {
  it("sends the bearer token on every call", async () => {
    fetchMock.mockResolvedValue(mockResponse({ ok: true, status: 200, jsonBody: { id: "u1", name: "Dana", role: "instructor" } }));
    const client = makeClient();
    await client.me();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://127.0.0.1:8026/api/me");
    expect(init.headers.Authorization).toBe("Bearer test-token-123");
  });

  it("sends a JSON body with a JSON content-type for object payloads", async () => {
    fetchMock.mockResolvedValue(mockResponse({ ok: true, status: 200, jsonBody: { id: "c1", name: "x", created_at: "", role: "instructor" } }));
    const client = makeClient();
    await client.createCourse("Linear Algebra");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://127.0.0.1:8026/api/courses");
    expect(init.method).toBe("POST");
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(init.body).toBe(JSON.stringify({ name: "Linear Algebra" }));
  });

  it("sends multipart form data for uploads with no JSON content-type header", async () => {
    fetchMock.mockResolvedValue(mockResponse({ ok: true, status: 200, jsonBody: { id: "doc1" } }));
    const client = makeClient();
    const file = new File(["hello"], "hw.pdf", { type: "application/pdf" });
    await client.upload("asg1", "questions", file);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://127.0.0.1:8026/api/assignments/asg1/documents?kind=questions");
    expect(init.method).toBe("POST");
    expect(init.body).toBeInstanceOf(FormData);
    expect(init.headers["Content-Type"]).toBeUndefined();
    expect(init.headers.Authorization).toBe("Bearer test-token-123");
  });

  it("sends no body for plain GET calls", async () => {
    fetchMock.mockResolvedValue(mockResponse({ ok: true, status: 200, jsonBody: [] }));
    const client = makeClient();
    await client.courses();

    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe("GET");
    expect(init.body).toBeUndefined();
    expect(init.headers["Content-Type"]).toBeUndefined();
  });
});

describe("VerityClient error mapping", () => {
  it.each([401, 403, 409, 422])("maps a %i response's detail.code and detail.fields onto ApiError", async (status) => {
    const fields = [{ path: "questions.q1.score", type: "missing" }];
    fetchMock.mockResolvedValue(
      mockResponse({ ok: false, status, jsonBody: { detail: { code: "some_code", fields } } }),
    );
    const client = makeClient();

    const error = await client.me().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    const apiError = error as ApiError;
    expect(apiError.status).toBe(status);
    expect(apiError.code).toBe("some_code");
    expect(apiError.fields).toEqual(fields);
  });

  it("exposes expired/denied/conflict getters for 401/403/409", async () => {
    const client = makeClient();

    fetchMock.mockResolvedValueOnce(mockResponse({ ok: false, status: 401, jsonBody: { detail: { code: "expired" } } }));
    const expired = (await client.me().catch((e: unknown) => e)) as ApiError;
    expect(expired.expired).toBe(true);
    expect(expired.denied).toBe(false);
    expect(expired.conflict).toBe(false);

    fetchMock.mockResolvedValueOnce(mockResponse({ ok: false, status: 403, jsonBody: { detail: { code: "denied" } } }));
    const denied = (await client.me().catch((e: unknown) => e)) as ApiError;
    expect(denied.denied).toBe(true);

    fetchMock.mockResolvedValueOnce(mockResponse({ ok: false, status: 409, jsonBody: { detail: { code: "stale_review_reload" } } }));
    const conflict = (await client.me().catch((e: unknown) => e)) as ApiError;
    expect(conflict.conflict).toBe(true);
  });

  it("defaults fields to an empty array when the backend omits them", async () => {
    fetchMock.mockResolvedValue(mockResponse({ ok: false, status: 422, jsonBody: { detail: { code: "invalid" } } }));
    const client = makeClient();
    const error = (await client.me().catch((e: unknown) => e)) as ApiError;
    expect(error.fields).toEqual([]);
  });

  it("uses a plain string detail as the error code", async () => {
    fetchMock.mockResolvedValue(mockResponse({ ok: false, status: 400, jsonBody: { detail: "not_configured" } }));
    const client = makeClient();
    const error = (await client.me().catch((e: unknown) => e)) as ApiError;
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(400);
    expect(error.code).toBe("not_configured");
    expect(error.fields).toEqual([]);
  });

  it("falls back to an http_<status> code when the body is not JSON", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.reject(new Error("not json")),
      text: () => Promise.resolve(""),
    });
    const client = makeClient();
    const error = (await client.me().catch((e: unknown) => e)) as ApiError;
    expect(error.code).toBe("http_500");
  });

  it("maps a thrown fetch failure to a network ApiError", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    const client = makeClient();
    const error = (await client.me().catch((e: unknown) => e)) as ApiError;
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(0);
    expect(error.code).toBe("network");
  });
});

describe("VerityClient.waitForJob", () => {
  it("polls with a growing delay (400ms -> 600ms) until the job succeeds", async () => {
    vi.useFakeTimers();
    const statuses = ["queued", "running", "succeeded"];
    let call = 0;
    fetchMock.mockImplementation(() =>
      Promise.resolve(
        mockResponse({
          ok: true,
          status: 200,
          jsonBody: {
            id: "job1",
            kind: "assessment",
            target_id: "sub1",
            status: statuses[Math.min(call++, statuses.length - 1)],
            attempts: 1,
            created_at: "",
            updated_at: "",
            error_code: null,
          },
        }),
      ),
    );
    const client = makeClient();

    const resultPromise = client.waitForJob("job1");

    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1); // first poll: queued, fires immediately

    await vi.advanceTimersByTimeAsync(399);
    expect(fetchMock).toHaveBeenCalledTimes(1); // 400ms delay not yet elapsed

    await vi.advanceTimersByTimeAsync(1);
    expect(fetchMock).toHaveBeenCalledTimes(2); // second poll: running

    await vi.advanceTimersByTimeAsync(599);
    expect(fetchMock).toHaveBeenCalledTimes(2); // next delay grew to 600ms (400 * 1.5)

    await vi.advanceTimersByTimeAsync(1);
    expect(fetchMock).toHaveBeenCalledTimes(3); // third poll: succeeded, loop stops

    const job = await resultPromise;
    expect(job.status).toBe("succeeded");
  });

  it("stops polling on failed as well as succeeded", async () => {
    vi.useFakeTimers();
    fetchMock.mockResolvedValue(
      mockResponse({
        ok: true,
        status: 200,
        jsonBody: {
          id: "job2",
          kind: "assessment",
          target_id: "sub1",
          status: "failed",
          attempts: 1,
          created_at: "",
          updated_at: "",
          error_code: "provider_failed",
        },
      }),
    );
    const client = makeClient();
    const job = await client.waitForJob("job2");
    expect(job.status).toBe("failed");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("VerityClient.documentBlob", () => {
  it("fetches with authorization and never puts the token in the URL", async () => {
    const blob = new Blob(["%PDF-1.4"], { type: "application/pdf" });
    fetchMock.mockResolvedValue(mockResponse({ ok: true, status: 200, blob }));
    const client = makeClient();

    const result = await client.documentBlob("doc1");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://127.0.0.1:8026/api/documents/doc1/file");
    expect(url).not.toContain("test-token-123");
    expect(url).not.toContain("token=");
    expect(init.headers.Authorization).toBe("Bearer test-token-123");
    expect(result).toBe(blob);
  });

  it("throws an ApiError on a non-ok response", async () => {
    fetchMock.mockResolvedValue(mockResponse({ ok: false, status: 403 }));
    const client = makeClient();
    const error = (await client.documentBlob("doc1").catch((e: unknown) => e)) as ApiError;
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(403);
    expect(error.code).toBe("http_403");
  });

  it("maps a thrown fetch failure to a network ApiError", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    const client = makeClient();
    const error = (await client.documentBlob("doc1").catch((e: unknown) => e)) as ApiError;
    expect(error.code).toBe("network");
  });
});
