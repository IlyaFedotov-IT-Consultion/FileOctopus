import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import {
  render,
  screen,
  cleanup,
  waitFor,
  fireEvent,
} from "@testing-library/react";
import type { FileEntryDto, FsClient } from "@fileoctopus/ts-api";

function makeEntry(overrides: Partial<FileEntryDto> = {}): FileEntryDto {
  return {
    uri: "local:///home/user/doc.pdf",
    name: "doc.pdf",
    kind: "file",
    size: 1024,
    modifiedAt: "2026-05-27T00:00:00Z",
    extension: ".pdf",
    ...overrides,
  } as FileEntryDto;
}

function createMockFs() {
  return {
    readFileAsDataUri:
      vi.fn<
        () => Promise<{ dataUri: string; byteSize: number; mimeType: string }>
      >(),
  } as unknown as FsClient;
}

const mockPage = {
  getViewport: vi.fn().mockReturnValue({ height: 800, width: 600 }),
  render: vi.fn().mockReturnValue({
    promise: Promise.resolve(),
    cancel: vi.fn(),
  }),
};

const mockPdfDoc = {
  numPages: 3,
  getPage: vi.fn().mockResolvedValue(mockPage),
  destroy: vi.fn(),
};

const mockGetDocument = vi.fn().mockReturnValue({
  promise: Promise.resolve(mockPdfDoc),
});

vi.mock("pdfjs-dist", () => ({
  getDocument: (...args: unknown[]) => mockGetDocument(...args),
  GlobalWorkerOptions: { workerSrc: "" },
}));

const { ViewerPdfMode } =
  await import("../src/components/viewer/ViewerPdfMode");

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  mockGetDocument.mockReturnValue({ promise: Promise.resolve(mockPdfDoc) });
  mockPdfDoc.numPages = 3;
  mockPdfDoc.getPage.mockResolvedValue(mockPage);
  mockPage.render.mockReturnValue({
    promise: Promise.resolve(),
    cancel: vi.fn(),
  });
});

describe("ViewerPdfMode", () => {
  it("renders loading state initially", () => {
    const mockFs = createMockFs();
    const entry = makeEntry();
    (mockFs.readFileAsDataUri as ReturnType<typeof vi.fn>).mockReturnValue(
      new Promise(() => {}),
    );
    render(<ViewerPdfMode entry={entry} fs={mockFs} />);
    expect(screen.getByText("Loading PDF…")).toBeTruthy();
  });

  it("renders canvas element on successful load", async () => {
    const mockFs = createMockFs();
    const entry = makeEntry();
    (mockFs.readFileAsDataUri as ReturnType<typeof vi.fn>).mockResolvedValue({
      dataUri: "data:application/pdf;base64,JVBERi0xLjQ=",
      byteSize: 1024,
      mimeType: "application/pdf",
    });
    render(<ViewerPdfMode entry={entry} fs={mockFs} />);
    await waitFor(() => {
      const canvas = document.querySelector(".fo-viewer-pdf canvas");
      expect(canvas).toBeTruthy();
    });
  });

  it("displays file size in footer", async () => {
    const mockFs = createMockFs();
    const entry = makeEntry({ size: 2048 });
    (mockFs.readFileAsDataUri as ReturnType<typeof vi.fn>).mockResolvedValue({
      dataUri: "data:application/pdf;base64,JVBERi0xLjQ=",
      byteSize: 2048,
      mimeType: "application/pdf",
    });
    render(<ViewerPdfMode entry={entry} fs={mockFs} />);
    await waitFor(() => {
      expect(screen.getByText(/2,048 bytes/)).toBeTruthy();
    });
  });

  it("displays modified date in footer", async () => {
    const mockFs = createMockFs();
    const entry = makeEntry({ modifiedAt: "2026-05-27T12:00:00Z" });
    (mockFs.readFileAsDataUri as ReturnType<typeof vi.fn>).mockResolvedValue({
      dataUri: "data:application/pdf;base64,JVBERi0xLjQ=",
      byteSize: 1024,
      mimeType: "application/pdf",
    });
    render(<ViewerPdfMode entry={entry} fs={mockFs} />);
    await waitFor(() => {
      expect(screen.getByText(/Modified:/)).toBeTruthy();
    });
  });

  it("renders error state on IPC failure", async () => {
    const mockFs = createMockFs();
    const entry = makeEntry();
    (mockFs.readFileAsDataUri as ReturnType<typeof vi.fn>).mockRejectedValue({
      code: "not_found",
      message: "File not found",
    });
    render(<ViewerPdfMode entry={entry} fs={mockFs} />);
    await waitFor(() => {
      expect(screen.getByText(/file or folder no longer exists/)).toBeTruthy();
    });
  });

  it("calls readFileAsDataUri with entry URI", async () => {
    const mockFs = createMockFs();
    const entry = makeEntry({ uri: "local:///home/user/test.pdf" });
    (mockFs.readFileAsDataUri as ReturnType<typeof vi.fn>).mockResolvedValue({
      dataUri: "data:application/pdf;base64,JVBERi0xLjQ=",
      byteSize: 512,
      mimeType: "application/pdf",
    });
    render(<ViewerPdfMode entry={entry} fs={mockFs} />);
    await waitFor(() => {
      expect(mockFs.readFileAsDataUri).toHaveBeenCalledWith({
        uri: "local:///home/user/test.pdf",
        maxBytes: expect.any(Number),
      });
    });
  });

  it("cancels in-flight request on unmount", async () => {
    const mockFs = createMockFs();
    const entry = makeEntry();
    let rejectFn: (err: Error) => void;
    (mockFs.readFileAsDataUri as ReturnType<typeof vi.fn>).mockReturnValue(
      new Promise((_, reject) => {
        rejectFn = reject;
      }),
    );
    const { unmount } = render(<ViewerPdfMode entry={entry} fs={mockFs} />);
    unmount();
    rejectFn!(new Error("cancelled"));
    await new Promise((r) => setTimeout(r, 50));
  });

  it("displays page counter showing current page and total", async () => {
    const mockFs = createMockFs();
    const entry = makeEntry();
    (mockFs.readFileAsDataUri as ReturnType<typeof vi.fn>).mockResolvedValue({
      dataUri: "data:application/pdf;base64,JVBERi0xLjQ=",
      byteSize: 1024,
      mimeType: "application/pdf",
    });
    render(<ViewerPdfMode entry={entry} fs={mockFs} />);
    await waitFor(() => {
      const counter = document.querySelector(".fo-viewer-pdf-page");
      expect(counter).toBeTruthy();
      expect(counter?.textContent).toBe("1 / 3");
    });
  });

  it("shows previous and next page buttons", async () => {
    const mockFs = createMockFs();
    const entry = makeEntry();
    (mockFs.readFileAsDataUri as ReturnType<typeof vi.fn>).mockResolvedValue({
      dataUri: "data:application/pdf;base64,JVBERi0xLjQ=",
      byteSize: 1024,
      mimeType: "application/pdf",
    });
    render(<ViewerPdfMode entry={entry} fs={mockFs} />);
    await waitFor(() => {
      const prevBtn = document.querySelector(".fo-viewer-pdf-prev");
      const nextBtn = document.querySelector(".fo-viewer-pdf-next");
      expect(prevBtn).toBeTruthy();
      expect(nextBtn).toBeTruthy();
    });
  });

  it("disables prev button on first page", async () => {
    const mockFs = createMockFs();
    const entry = makeEntry();
    (mockFs.readFileAsDataUri as ReturnType<typeof vi.fn>).mockResolvedValue({
      dataUri: "data:application/pdf;base64,JVBERi0xLjQ=",
      byteSize: 1024,
      mimeType: "application/pdf",
    });
    render(<ViewerPdfMode entry={entry} fs={mockFs} />);
    await waitFor(() => {
      const prevBtn = document.querySelector(
        ".fo-viewer-pdf-prev",
      ) as HTMLButtonElement;
      expect(prevBtn).toBeTruthy();
      expect(prevBtn.disabled).toBe(true);
    });
  });

  it("navigates to next page on next button click", async () => {
    const mockFs = createMockFs();
    const entry = makeEntry();
    (mockFs.readFileAsDataUri as ReturnType<typeof vi.fn>).mockResolvedValue({
      dataUri: "data:application/pdf;base64,JVBERi0xLjQ=",
      byteSize: 1024,
      mimeType: "application/pdf",
    });
    render(<ViewerPdfMode entry={entry} fs={mockFs} />);
    await waitFor(() => {
      expect(document.querySelector(".fo-viewer-pdf-page")).toBeTruthy();
    });

    const nextBtn = document.querySelector(
      ".fo-viewer-pdf-next",
    ) as HTMLButtonElement;
    expect(nextBtn).toBeTruthy();
    fireEvent.click(nextBtn);

    await waitFor(() => {
      const counter = document.querySelector(".fo-viewer-pdf-page");
      expect(counter?.textContent).toBe("2 / 3");
    });
  });

  it("disables next button on last page after navigating", async () => {
    const mockFs = createMockFs();
    const entry = makeEntry();
    (mockFs.readFileAsDataUri as ReturnType<typeof vi.fn>).mockResolvedValue({
      dataUri: "data:application/pdf;base64,JVBERi0xLjQ=",
      byteSize: 1024,
      mimeType: "application/pdf",
    });
    render(<ViewerPdfMode entry={entry} fs={mockFs} />);
    await waitFor(() => {
      expect(document.querySelector(".fo-viewer-pdf-page")).toBeTruthy();
    });

    const nextBtn = document.querySelector(
      ".fo-viewer-pdf-next",
    ) as HTMLButtonElement;
    fireEvent.click(nextBtn);
    await waitFor(() => {
      expect(document.querySelector(".fo-viewer-pdf-page")?.textContent).toBe(
        "2 / 3",
      );
    });
    fireEvent.click(nextBtn!);
    await waitFor(() => {
      expect(document.querySelector(".fo-viewer-pdf-page")?.textContent).toBe(
        "3 / 3",
      );
    });

    const nextBtnAfter = document.querySelector(
      ".fo-viewer-pdf-next",
    ) as HTMLButtonElement;
    expect(nextBtnAfter.disabled).toBe(true);
  });

  it("shows pdf.js error fallback when getDocument fails", async () => {
    const mockFs = createMockFs();
    const entry = makeEntry();
    mockGetDocument.mockReturnValue({
      promise: Promise.reject(new Error("Invalid PDF structure")),
    });
    (mockFs.readFileAsDataUri as ReturnType<typeof vi.fn>).mockResolvedValue({
      dataUri: "data:application/pdf;base64,AAAA",
      byteSize: 4,
      mimeType: "application/pdf",
    });
    render(<ViewerPdfMode entry={entry} fs={mockFs} />);
    await waitFor(() => {
      const fallback = document.querySelector(".fo-viewer-pdf-error");
      expect(fallback).toBeTruthy();
      expect(fallback?.textContent).toContain("Unable to render PDF");
    });
  });

  it("still shows footer in pdf.js error fallback", async () => {
    const mockFs = createMockFs();
    const entry = makeEntry({ modifiedAt: "2026-05-27T12:00:00Z" });
    mockGetDocument.mockReturnValue({
      promise: Promise.reject(new Error("Invalid PDF")),
    });
    (mockFs.readFileAsDataUri as ReturnType<typeof vi.fn>).mockResolvedValue({
      dataUri: "data:application/pdf;base64,AAAA",
      byteSize: 4096,
      mimeType: "application/pdf",
    });
    render(<ViewerPdfMode entry={entry} fs={mockFs} />);
    await waitFor(() => {
      expect(document.querySelector(".fo-viewer-pdf-error")).toBeTruthy();
    });
    await waitFor(() => {
      expect(screen.getByText(/4,096 bytes/)).toBeTruthy();
      expect(screen.getByText(/Modified:/)).toBeTruthy();
    });
  });
});
