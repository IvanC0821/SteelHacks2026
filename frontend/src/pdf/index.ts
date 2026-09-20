// The PDF contract for Tasks 2 and 4. Documented in design/DESIGN.md.
// `PdfViewer` and `PageThumbnails` are lazy wrappers: the props and names are unchanged, but the
// real components (and pdf.js with them) arrive in their own chunk on first mount.
export { PdfViewer, type PdfViewerProps } from "./PdfViewer";
export { ViewerToolbar, type ViewerToolbarProps } from "./ViewerToolbar";
export { PageThumbnails, type PageThumbnailsProps } from "./PageThumbnails";
export { usePdfBlob, type PdfBlobState } from "./usePdfBlob";
export { marksByPage, isUsableBbox, type Mark, type MarkTone } from "./marks";
