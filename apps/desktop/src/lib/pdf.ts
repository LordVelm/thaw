import * as pdfjsLib from "pdfjs-dist";
import Tesseract from "tesseract.js";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

export interface PdfResult {
  text: string;
  method: "text" | "ocr";
}

export async function extractTextFromPdf(
  file: File,
  onProgress?: (msg: string) => void
): Promise<PdfResult> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  // Try text extraction first
  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const text = textContent.items
      .filter((item) => "str" in item)
      .map((item) => (item as { str: string }).str)
      .join(" ");
    pages.push(text);
  }

  const fullText = pages.join("\n\n");

  // If we got enough text, return it
  if (fullText.trim().length >= 50) {
    return { text: fullText, method: "text" };
  }

  // Fall back to OCR
  onProgress?.("Scanned PDF detected — running OCR...");

  const ocrPages: string[] = [];
  const totalPages = pdf.numPages;

  for (let i = 1; i <= totalPages; i++) {
    onProgress?.(`OCR: processing page ${i} of ${totalPages}...`);

    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 2.0 }); // higher scale = better OCR

    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d")!;

    await page.render({ canvasContext: ctx, viewport }).promise;

    const imageData = canvas.toDataURL("image/png");

    const result = await Tesseract.recognize(imageData, "eng");
    ocrPages.push(result.data.text);

    canvas.remove();
  }

  return { text: ocrPages.join("\n\n"), method: "ocr" };
}
