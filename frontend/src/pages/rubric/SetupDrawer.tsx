import { useRef, useState } from "react";
import { FileText, Upload } from "lucide-react";
import { Button } from "../../components/Button";
import { Drawer } from "../../components/Drawer";
import { Notice } from "../../components/Notice";
import { ApiError } from "../../api/client";
import type { VerityClient } from "../../api/client";
import type { Capabilities, DocumentMeta } from "../../api/types";
import { KIND_LABELS, REFERENCE_KINDS, formatBytes, ofKind, pageCount, uploadError, uploadFailureMessage, type ReferenceKind } from "./documents";

export interface SetupDrawerProps {
  open: boolean;
  onClose: () => void;
  client: VerityClient;
  assignmentId: string;
  documents: DocumentMeta[];
  capabilities: Capabilities;
  /** false for a TA: the drawer stays readable, the upload controls do not appear */
  canUpload: boolean;
  onUploaded: () => void;
}

const HINTS: Record<ReferenceKind, string> = {
  questions: "The blank paper students download.",
  solution: "Private to staff. The rubric is written against this.",
  graded_example: "Optional. Papers you have already marked, as a reference.",
};

/** Assignment setup: one card per reference kind with what is attached and an upload control. */
export function SetupDrawer({
  open,
  onClose,
  client,
  assignmentId,
  documents,
  capabilities,
  canUpload,
  onUploaded,
}: SetupDrawerProps) {
  const [busy, setBusy] = useState<ReferenceKind | null>(null);
  const [errors, setErrors] = useState<Partial<Record<ReferenceKind, string>>>({});

  return (
    <Drawer open={open} title="Assignment setup" onClose={onClose} width="420px">
      <div className="v-rubric-setup">
        {REFERENCE_KINDS.map((kind) => (
          <KindCard
            key={kind}
            kind={kind}
            documents={ofKind(documents, kind)}
            hint={HINTS[kind]}
            busy={busy === kind}
            error={errors[kind]}
            canUpload={canUpload}
            limit={capabilities.max_upload_bytes}
            onPick={async (file) => {
              const refusal = uploadError(file, capabilities);
              if (refusal) {
                setErrors((all) => ({ ...all, [kind]: refusal }));
                return;
              }
              setErrors((all) => ({ ...all, [kind]: undefined }));
              setBusy(kind);
              try {
                await client.upload(assignmentId, kind, file);
                onUploaded();
              } catch (cause) {
                const code = cause instanceof ApiError ? cause.code : "unknown";
                setErrors((all) => ({ ...all, [kind]: uploadFailureMessage(code) }));
              } finally {
                setBusy(null);
              }
            }}
          />
        ))}
        <p className="v-label-12 v-rubric-setup__note">
          Solutions and examples stay private to staff. New references attach to the next published rubric version.
        </p>
      </div>
    </Drawer>
  );
}

interface KindCardProps {
  kind: ReferenceKind;
  documents: DocumentMeta[];
  hint: string;
  busy: boolean;
  error?: string;
  canUpload: boolean;
  limit: number;
  onPick: (file: File) => void;
}

function KindCard({ kind, documents, hint, busy, error, canUpload, limit, onPick }: KindCardProps) {
  const input = useRef<HTMLInputElement>(null);
  const many = kind === "graded_example";

  return (
    <section className="v-rubric-setup__card">
      <div className="v-rubric-setup__head">
        <h3 className="v-heading-14">{KIND_LABELS[kind]}</h3>
        {canUpload ? (
          <Button
            variant="quiet"
            icon={Upload}
            onClick={() => input.current?.click()}
            busy={busy}
            aria-label={`${documents.length > 0 && !many ? "Replace" : "Add"} ${KIND_LABELS[kind].toLowerCase()}`}
          >
            {documents.length > 0 && !many ? "Replace" : "Add"}
          </Button>
        ) : null}
      </div>
      <p className="v-label-12">{hint}</p>
      {documents.length === 0 ? (
        <p className="v-copy-14 v-rubric-setup__none">Nothing attached yet</p>
      ) : (
        <ul className="v-rubric-setup__files">
          {documents.map((document) => (
            <li key={document.id} className="v-rubric-setup__file">
              <FileText size={16} strokeWidth={1.5} aria-hidden="true" />
              <span className="v-copy-14 v-rubric-setup__filename">{document.filename}</span>
              <span className="v-label-12">{pageCount(document.page_count)}</span>
            </li>
          ))}
        </ul>
      )}
      {error ? (
        <Notice tone="error" className="v-rubric-setup__error">
          {error}
        </Notice>
      ) : null}
      {canUpload ? (
        <>
          <p className="v-label-12">PDF only, up to {formatBytes(limit)}</p>
          <input
            ref={input}
            type="file"
            accept="application/pdf,.pdf"
            className="v-visually-hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) onPick(file);
            }}
          />
        </>
      ) : null}
    </section>
  );
}
