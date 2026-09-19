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

/** Fetches an original PDF with authorization and hands back the Blob plus an object URL.
 *  The URL is created and revoked here, so no bearer token ever reaches a URL and nothing leaks.
 *  Pass `documentId === null` to hold off (e.g. before a submission has loaded). */
export function usePdfBlob(client: VerityClient, documentId: string | null): PdfBlobState {
  const [state, setState] = useState<PdfBlobState>(
    documentId ? { ...IDLE, loading: true } : IDLE,
  );

  useEffect(() => {
    if (!documentId) {
      setState(IDLE);
      return;
    }
    let live = true;
    let url: string | null = null;
    setState({ ...IDLE, loading: true });
    client
      .documentBlob(documentId)
      .then((blob) => {
        if (!live) return;
        url = URL.createObjectURL(blob);
        setState({ blob, url, error: null, loading: false });
      })
      .catch((cause: unknown) => {
        if (!live) return;
        const code = cause instanceof ApiError ? cause.code : "unknown";
        setState({ ...IDLE, error: code });
      });
    return () => {
      live = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [client, documentId]);

  return state;
}
