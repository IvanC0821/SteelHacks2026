import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PdfDocument } from "./pdfjs";
import { PdfViewer } from "./PdfViewer";
import { PageThumbnails } from "./PageThumbnails";

const { openDocument } = vi.hoisted(() => ({ openDocument: vi.fn() }));
vi.mock("./pdfjs", () => ({ openDocument }));

beforeEach(() => {
  openDocument.mockReset();
  vi.stubGlobal("ResizeObserver", class {
    observe() {}
    disconnect() {}
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

for (const component of ["viewer", "thumbnails"] as const) {
  describe(`${component} PDF lifecycle`, () => {
    function mount() {
      const blob = new Blob([], { type: "application/pdf" });
      return render(component === "viewer"
        ? <PdfViewer blob={blob} page={1} onPageChange={() => {}} />
        : <PageThumbnails blob={blob} />);
    }

    function pendingDocument() {
      let resolve!: (document: PdfDocument) => void;
      const promise = new Promise<PdfDocument>((done) => { resolve = done; });
      const destroy = vi.fn().mockResolvedValue(undefined);
      const document = { numPages: 0, loadingTask: { destroy } } as unknown as PdfDocument;
      openDocument.mockReturnValue(promise);
      return { resolve, document, destroy };
    }

    it("destroys the loading task when a loaded document unmounts", async () => {
      const pending = pendingDocument();
      const view = mount();
      await act(async () => { pending.resolve(pending.document); });
      expect(pending.destroy).not.toHaveBeenCalled();
      view.unmount();
      expect(pending.destroy).toHaveBeenCalledOnce();
    });

    it("destroys a document that finishes opening after unmount", async () => {
      const pending = pendingDocument();
      const view = mount();
      view.unmount();
      await act(async () => { pending.resolve(pending.document); });
      expect(pending.destroy).toHaveBeenCalledOnce();
    });
  });
}
