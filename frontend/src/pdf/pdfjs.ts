// One place that configures pdf.js. The worker ships with the installed package; Vite's ?url
// import hashes it into the bundle so nothing is fetched from a CDN.
import * as pdfjs from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export { pdfjs };
export type PdfDocument = Awaited<ReturnType<typeof pdfjs.getDocument>["promise"]>;
export type PdfPage = Awaited<ReturnType<PdfDocument["getPage"]>>;

/** Opens a Blob as a pdf.js document. The caller destroys it when the blob changes or unmounts. */
export async function openDocument(blob: Blob): Promise<PdfDocument> {
  const data = new Uint8Array(await blob.arrayBuffer());
  return pdfjs.getDocument({ data }).promise;
}
