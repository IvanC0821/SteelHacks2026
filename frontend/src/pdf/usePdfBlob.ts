import { useEffect, useState } from "react";
import type { VerityClient } from "../api/client";
import { ApiError } from "../api/client";

export interface PdfBlobState {
  blob: Blob | null;
  /** an object URL for the same blob, for a download link or an <embed>; revoked on unmount */
  url: string | null;
  /** the ApiError code, e.g. "http_403" or "network"; null while fine */
  error: string | null;
  loading: boolean;
}

const IDLE: PdfBlobState = { blob: null, url: null, error: null, loading: false };
const LOADING: PdfBlobState = { blob: null, url: null, error: null, loading: true };

/** Fetches an original PDF with authorization and hands back the Blob plus an object URL.
 *  The URL is created and revoked here, so no bearer token ever reaches a URL and nothing leaks.
 *  Pass `documentId === null` to hold off (e.g. before a submission has loaded). */
export function usePdfBlob(client: VerityClient, documentId: string | null): PdfBlobState {
  // The settled fetch is keyed by the identity and the document it belongs to, so a change to
  // either reads as "loading" during render instead of being reset from inside the effect.
  const [settled, setSettled] = useState<{
    client: VerityClient;
    documentId: string;
    state: PdfBlobState;
  } | null>(null);

  const current =
    settled !== null && settled.client === client && settled.documentId === documentId
      ? settled.state
      : null;
  const state = documentId === null ? IDLE : (current ?? LOADING);

  useEffect(() => {
    if (!documentId) return;
    let live = true;
    let url: string | null = null;
    client
      .documentBlob(documentId)
      .then((blob) => {
        if (!live) return;
        url = URL.createObjectURL(blob);
        setSettled({ client, documentId, state: { blob, url, error: null, loading: false } });
      })
      .catch((cause: unknown) => {
        if (!live) return;
        const code = cause instanceof ApiError ? cause.code : "unknown";
        setSettled({ client, documentId, state: { ...IDLE, error: code } });
      });
    return () => {
      live = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [client, documentId]);

  return state;
}
