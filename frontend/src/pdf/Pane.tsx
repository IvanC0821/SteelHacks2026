import { Spinner } from "../components/Spinner";
import "./Pane.css";

/** The ground a lazily loaded PDF surface stands on while its chunk arrives. It reserves the same
 *  space the real surface will take on the `--v-canvas` ground, so nothing jumps when it lands. */
export function ViewerPane({ className, label }: { className?: string; label: string }) {
  return (
    <div className={["v-pdf-pane", className ?? ""].filter(Boolean).join(" ")}>
      <Spinner size={20} label={label} />
    </div>
  );
}

/** The thumbnail strip's reserve: one tile's height, so the row or grid keeps its place. */
export function ThumbsPane({
  className,
  label,
  layout,
  tileWidth,
}: {
  className?: string;
  label: string;
  layout: "row" | "grid";
  tileWidth: number;
}) {
  return (
    <div
      className={["v-thumbs-pane", `v-thumbs-pane--${layout}`, className ?? ""]
        .filter(Boolean)
        .join(" ")}
      style={{ minHeight: Math.round(tileWidth * 1.294) + 10 }}
    >
      <Spinner size={16} label={label} />
    </div>
  );
}
