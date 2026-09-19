import { useRef, useState, type DragEvent } from "react";
import { UploadCloud } from "lucide-react";
import { Button, Icon, Notice, Spinner } from "../../components";
import { useCapabilities } from "../../app";
import { uploadError, uploadHint } from "./lib/upload";

export interface UploadZoneProps {
  /** hands back a validated PDF; the caller does the POST and reports its own failure */
  onFile: (file: File) => void;
  busy?: boolean;
  /** a failure from the upload call itself, already in plain words */
  failure?: string | null;
  /** the reason uploading is closed, e.g. after the due date */
  disabledReason?: string | null;
  label?: string;
  className?: string;
}

/** A PDF drop zone with a real file button behind it. Validation happens here so an obvious
 *  mistake never costs a round trip, but the backend stays the authority. */
export function UploadZone({
  onFile,
  busy = false,
  failure,
  disabledReason,
  label = "Drop your PDF here",
  className,
}: UploadZoneProps) {
  const capabilities = useCapabilities();
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [local, setLocal] = useState<string | null>(null);
  const disabled = Boolean(disabledReason) || busy;

  function take(file: File | undefined | null) {
    if (!file || disabled) return;
    const problem = uploadError(file, capabilities);
    setLocal(problem);
    if (!problem) onFile(file);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setOver(false);
    take(event.dataTransfer.files?.[0]);
  }

  return (
    <div className={["v-upload", className ?? ""].filter(Boolean).join(" ")}>
      <div
        className={`v-upload__zone${over ? " is-over" : ""}${disabled ? " is-disabled" : ""}`}
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
      >
        <Icon glyph={UploadCloud} size={20} className="v-upload__glyph" />
        <p className="v-copy-16 v-upload__label">{disabledReason ?? label}</p>
        <p className="v-copy-14 v-upload__hint">{uploadHint(capabilities)}</p>
        <Button
          variant="primary"
          size="lg"
          busy={busy}
          disabled={disabled}
          title={disabledReason ?? undefined}
          onClick={() => inputRef.current?.click()}
        >
          Choose a PDF
        </Button>
        {busy ? (
          <p className="v-copy-14 v-upload__busy" role="status">
            <Spinner size={16} /> Uploading your PDF
          </p>
        ) : null}
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="v-visually-hidden"
          aria-label="Choose a PDF"
          disabled={disabled}
          onChange={(event) => {
            take(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
      </div>
      {local || failure ? (
        <Notice tone="error" className="v-upload__error">
          {local ?? failure}
        </Notice>
      ) : null}
    </div>
  );
}
