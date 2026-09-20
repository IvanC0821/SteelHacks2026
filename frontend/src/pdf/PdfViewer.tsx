import { lazy, Suspense } from "react";
import { ViewerPane } from "./Pane";
import type { PdfViewerProps } from "./PdfViewerImpl";

export type { PdfViewerProps } from "./PdfViewerImpl";

/** pdf.js is ~600 kB of the bundle and only three routes ever open a paper, so the real viewer
 *  lives behind a dynamic import. The props and the name are the ones Tasks 2 to 4 already use:
 *  `import { PdfViewer } from "../../pdf"` is unchanged, it simply loads its chunk on first paint. */
const PdfViewerImpl = lazy(() =>
  import("./PdfViewerImpl").then((module) => ({ default: module.PdfViewer })),
);

export function PdfViewer(props: PdfViewerProps) {
  return (
    <Suspense fallback={<ViewerPane className={props.className} label="Loading the paper" />}>
      <PdfViewerImpl {...props} />
    </Suspense>
  );
}
