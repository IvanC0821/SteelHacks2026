import { lazy, Suspense } from "react";
import { ThumbsPane } from "./Pane";
import type { PageThumbnailsProps } from "./PageThumbnailsImpl";

export type { PageThumbnailsProps } from "./PageThumbnailsImpl";

/** Same dynamic import as the viewer, and the same pdf.js chunk: whichever surface a route mounts
 *  first pays for it once. The props and the name are unchanged. */
const PageThumbnailsImpl = lazy(() =>
  import("./PageThumbnailsImpl").then((module) => ({ default: module.PageThumbnails })),
);

export function PageThumbnails(props: PageThumbnailsProps) {
  return (
    <Suspense
      fallback={
        <ThumbsPane
          className={props.className}
          label="Loading pages"
          layout={props.layout ?? "grid"}
          tileWidth={props.tileWidth ?? 116}
        />
      }
    >
      <PageThumbnailsImpl {...props} />
    </Suspense>
  );
}
