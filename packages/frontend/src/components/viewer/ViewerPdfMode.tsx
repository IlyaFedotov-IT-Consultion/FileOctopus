import { useEffect, useRef, useState, useCallback } from "react";
import type { FileEntryDto, FsClient } from "@fileoctopus/ts-api";
import { normalizeIpcError } from "@fileoctopus/ts-api";
import { operationErrorMessage } from "../../dialogs/OperationDialogView";

interface ViewerPdfModeProps {
  entry: FileEntryDto;
  fs: FsClient;
}

const MAX_PDF_BYTES = 20 * 1024 * 1024;

function dataUriToArrayBuffer(dataUri: string): ArrayBuffer {
  const commaIdx = dataUri.indexOf(",");
  if (commaIdx === -1) throw new Error("Invalid data URI");
  const base64 = dataUri.slice(commaIdx + 1);
  const binaryStr = atob(base64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  return bytes.buffer;
}

export function ViewerPdfMode({ entry, fs }: ViewerPdfModeProps) {
  const [byteSize, setByteSize] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pageCount, setPageCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pdfJsError, setPdfJsError] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pdfDocRef = useRef<unknown>(null);
  const renderTaskRef = useRef<unknown>(null);

  const renderPage = useCallback(async (pageNum: number) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfDoc = pdfDocRef.current as any;
    if (!pdfDoc || !canvasRef.current) return;

    // Cancel previous render task
    if (renderTaskRef.current) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (renderTaskRef.current as any).cancel();
      } catch {
        // ignore cancel errors
      }
    }

    try {
      const page = await pdfDoc.getPage(pageNum);
      const canvas = canvasRef.current;
      const context = canvas.getContext("2d");
      if (!context) return;

      const scale = 1.5;
      const viewport = page.getViewport({ scale });

      canvas.height = viewport.height;
      canvas.width = viewport.width;

      const renderTask = page.render({
        canvasContext: context,
        viewport,
      });
      renderTaskRef.current = renderTask;
      await renderTask.promise;
      renderTaskRef.current = null;
    } catch (err) {
      // RenderingCancelledException is expected when navigating pages fast
      if (
        err &&
        typeof err === "object" &&
        "name" in err &&
        (err as { name: string }).name === "RenderingCancelledException"
      ) {
        return;
      }
      // Other render errors are non-fatal
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setByteSize(null);
    setPageCount(0);
    setCurrentPage(1);
    setPdfJsError(false);

    fs.readFileAsDataUri({ uri: entry.uri, maxBytes: MAX_PDF_BYTES })
      .then(async (response) => {
        if (cancelled) return;
        setByteSize(response.byteSize);

        try {
          const pdfjs = await import("pdfjs-dist");
          const arrayBuffer = dataUriToArrayBuffer(response.dataUri);
          const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
          const pdf = await loadingTask.promise;
          if (cancelled) return;
          pdfDocRef.current = pdf;
          setPageCount(pdf.numPages);
          setCurrentPage(1);
          setPdfJsError(false);
        } catch {
          if (cancelled) return;
          setPdfJsError(true);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        const normalized = normalizeIpcError(err);
        setError(operationErrorMessage(normalized.code, normalized.message));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      if (renderTaskRef.current) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (renderTaskRef.current as any).cancel();
        } catch {
          // ignore
        }
      }
    };
  }, [entry.uri, fs]);

  // Render page whenever currentPage changes or pdf loads
  useEffect(() => {
    if (pdfDocRef.current && canvasRef.current) {
      renderPage(currentPage);
    }
  }, [currentPage, renderPage, pageCount]);

  const goToPrev = useCallback(() => {
    setCurrentPage((p) => Math.max(1, p - 1));
  }, []);

  const goToNext = useCallback(() => {
    setCurrentPage((p) => Math.min(pageCount, p + 1));
  }, [pageCount]);

  if (loading) return <div className="fo-viewer-loading">Loading PDF…</div>;
  if (error) return <div className="fo-viewer-error">{error}</div>;

  if (pdfJsError) {
    return (
      <div className="fo-viewer-pdf-wrap">
        <div className="fo-viewer-pdf-error">
          Unable to render PDF. The file may be corrupted or unsupported.
        </div>
        <div className="fo-viewer-footer">
          {byteSize !== null && (
            <span className="fo-viewer-filesize">
              {byteSize.toLocaleString()} bytes
            </span>
          )}
          {entry.modifiedAt && (
            <span className="fo-viewer-modified">
              Modified: {new Date(entry.modifiedAt).toLocaleDateString()}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="fo-viewer-pdf-wrap">
      <div className="fo-viewer-pdf">
        <canvas ref={canvasRef} />
      </div>
      {pageCount > 0 && (
        <div className="fo-viewer-pdf-controls">
          <button
            className="fo-viewer-pdf-prev"
            onClick={goToPrev}
            disabled={currentPage <= 1}
            aria-label="Previous page"
          >
            ‹
          </button>
          <span className="fo-viewer-pdf-page">
            {currentPage} / {pageCount}
          </span>
          <button
            className="fo-viewer-pdf-next"
            onClick={goToNext}
            disabled={currentPage >= pageCount}
            aria-label="Next page"
          >
            ›
          </button>
        </div>
      )}
      <div className="fo-viewer-footer">
        {byteSize !== null && (
          <span className="fo-viewer-filesize">
            {byteSize.toLocaleString()} bytes
          </span>
        )}
        {entry.modifiedAt && (
          <span className="fo-viewer-modified">
            Modified: {new Date(entry.modifiedAt).toLocaleDateString()}
          </span>
        )}
      </div>
    </div>
  );
}
