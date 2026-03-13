"use client";

import type { VehicleCostDocumentKind } from "./types";

export type DocumentDetectionSource = "heuristic" | "pdf-text" | "ocr" | "fallback";

export type DocumentKindDetectionResult = {
  kind: VehicleCostDocumentKind;
  confidence: number;
  source: DocumentDetectionSource;
};

type DetectionDeps = {
  extractPdfText?: (file: File) => Promise<string>;
  runOcrOnFile?: (file: File) => Promise<string>;
};

type KindScore = Record<VehicleCostDocumentKind, number>;

const DEFAULT_RESULT: DocumentKindDetectionResult = {
  kind: "other",
  confidence: 0.2,
  source: "fallback",
};

const KIND_LABELS: Record<VehicleCostDocumentKind, string> = {
  invoice: "Invoice",
  receipt: "Receipt",
  bill_of_sale: "Bill of sale",
  title_doc: "Title doc",
  other: "Other",
};

const HEURISTIC_PATTERNS: Array<{
  kind: VehicleCostDocumentKind;
  patterns: RegExp[];
  score: number;
}> = [
  {
    kind: "invoice",
    score: 0.86,
    patterns: [/\binvoice\b/i, /\binv[\s._-]?\d+/i, /\bbill\b/i],
  },
  {
    kind: "receipt",
    score: 0.86,
    patterns: [/\breceipt\b/i, /\bproof[\s._-]?of[\s._-]?purchase\b/i],
  },
  {
    kind: "bill_of_sale",
    score: 0.9,
    patterns: [/\bbill[\s._-]?of[\s._-]?sale\b/i, /\bbos\b/i],
  },
  {
    kind: "title_doc",
    score: 0.9,
    patterns: [/\btitle\b/i, /\bregistration\b/i, /\bodometer\b/i],
  },
];

const TEXT_PATTERNS: Array<{
  kind: VehicleCostDocumentKind;
  patterns: RegExp[];
  weight: number;
}> = [
  {
    kind: "invoice",
    weight: 3,
    patterns: [/\binvoice\b/gi, /\binvoice\s*#/gi, /\bbill to\b/gi, /\bamount due\b/gi],
  },
  {
    kind: "receipt",
    weight: 3,
    patterns: [/\breceipt\b/gi, /\bthank you\b/gi, /\bchange due\b/gi],
  },
  {
    kind: "bill_of_sale",
    weight: 4,
    patterns: [/\bbill of sale\b/gi, /\bseller\b/gi, /\bbuyer\b/gi],
  },
  {
    kind: "title_doc",
    weight: 4,
    patterns: [/\bcertificate of title\b/gi, /\btitle number\b/gi, /\bodometer statement\b/gi],
  },
];

function getEmptyScores(): KindScore {
  return {
    invoice: 0,
    receipt: 0,
    bill_of_sale: 0,
    title_doc: 0,
    other: 0,
  };
}

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function getTopKinds(scores: KindScore): [VehicleCostDocumentKind, number, number] {
  const ordered = Object.entries(scores)
    .sort((a, b) => b[1] - a[1]) as Array<[VehicleCostDocumentKind, number]>;
  const [topKind, topScore] = ordered[0] ?? ["other", 0];
  const secondScore = ordered[1]?.[1] ?? 0;
  return [topKind, topScore, secondScore];
}

export function inferKindFromFilename(filename: string, mimeType = ""): DocumentKindDetectionResult {
  const normalized = `${filename} ${mimeType}`.trim();
  for (const rule of HEURISTIC_PATTERNS) {
    if (rule.patterns.some((pattern) => pattern.test(normalized))) {
      return {
        kind: rule.kind,
        confidence: rule.score,
        source: "heuristic",
      };
    }
  }

  if (mimeType.startsWith("image/")) {
    return { kind: "other", confidence: 0.32, source: "heuristic" };
  }
  if (mimeType === "application/pdf" || filename.toLowerCase().endsWith(".pdf")) {
    return { kind: "other", confidence: 0.3, source: "heuristic" };
  }
  return DEFAULT_RESULT;
}

export function classifyDocumentText(text: string, source: Exclude<DocumentDetectionSource, "heuristic" | "fallback">): DocumentKindDetectionResult {
  const normalized = normalizeText(text);
  if (!normalized) {
    return { ...DEFAULT_RESULT, source: "fallback" };
  }

  const scores = getEmptyScores();
  for (const rule of TEXT_PATTERNS) {
    for (const pattern of rule.patterns) {
      const matches = normalized.match(pattern);
      if (matches?.length) {
        scores[rule.kind] += matches.length * rule.weight;
      }
    }
  }

  if (/\bsubtotal\b/.test(normalized) && /\btax\b/.test(normalized) && /\btotal\b/.test(normalized)) {
    scores.invoice += 3;
    scores.receipt += 2;
  }
  if (/\bmerchant\b/.test(normalized) || /\bcard\b/.test(normalized)) {
    scores.receipt += 2;
  }

  const [topKind, topScore, secondScore] = getTopKinds(scores);
  if (topScore <= 0 || topScore - secondScore < 2) {
    return { kind: "other", confidence: 0.38, source };
  }

  const confidence = Math.min(0.96, 0.56 + topScore / 16);
  return { kind: topKind, confidence, source };
}

async function fileToUint8Array(file: File): Promise<Uint8Array> {
  const buffer = await file.arrayBuffer();
  return new Uint8Array(buffer);
}

async function defaultExtractPdfText(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const workerUrl = new URL("pdfjs-dist/legacy/build/pdf.worker.mjs", import.meta.url).toString();
  if (pdfjs.GlobalWorkerOptions.workerSrc !== workerUrl) {
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  }

  const pdf = await pdfjs.getDocument({ data: await fileToUint8Array(file) }).promise;
  const pages = Math.min(pdf.numPages, 2);
  const chunks: string[] = [];

  for (let pageNumber = 1; pageNumber <= pages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const textContent = await page.getTextContent();
    chunks.push(
      textContent.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ")
    );
  }
  return chunks.join(" ");
}

async function renderPdfPageToCanvas(file: File, pageNumber = 1): Promise<HTMLCanvasElement> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const workerUrl = new URL("pdfjs-dist/legacy/build/pdf.worker.mjs", import.meta.url).toString();
  if (pdfjs.GlobalWorkerOptions.workerSrc !== workerUrl) {
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  }

  const pdf = await pdfjs.getDocument({ data: await fileToUint8Array(file) }).promise;
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale: 1.5 });
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not prepare canvas for PDF OCR");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  await page.render({ canvas, canvasContext: context, viewport }).promise;
  return canvas;
}

async function defaultRunOcrOnFile(file: File): Promise<string> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng");
  try {
    const target = file.type === "application/pdf"
      ? await renderPdfPageToCanvas(file)
      : file;
    const result = await worker.recognize(target);
    return result.data.text ?? "";
  } finally {
    await worker.terminate();
  }
}

export async function detectDocumentKindFromFile(
  file: File,
  deps: DetectionDeps = {}
): Promise<DocumentKindDetectionResult> {
  const heuristic = inferKindFromFilename(file.name, file.type);
  const extractPdfText = deps.extractPdfText ?? defaultExtractPdfText;
  const runOcrOnFile = deps.runOcrOnFile ?? defaultRunOcrOnFile;

  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  const isImage = file.type.startsWith("image/");

  if (isPdf) {
    try {
      const pdfText = await extractPdfText(file);
      const pdfResult = classifyDocumentText(pdfText, "pdf-text");
      if (pdfResult.kind !== "other" && pdfResult.confidence >= heuristic.confidence) {
        return pdfResult;
      }
      if (pdfResult.kind === "other" || pdfResult.confidence < 0.7) {
        const ocrText = await runOcrOnFile(file);
        const ocrResult = classifyDocumentText(ocrText, "ocr");
        if (ocrResult.kind !== "other" && ocrResult.confidence >= pdfResult.confidence) {
          return ocrResult;
        }
      }
      return pdfResult.kind !== "other" || heuristic.kind === "other" ? pdfResult : heuristic;
    } catch {
      try {
        const ocrText = await runOcrOnFile(file);
        const ocrResult = classifyDocumentText(ocrText, "ocr");
        return ocrResult.kind !== "other" ? ocrResult : heuristic;
      } catch {
        return heuristic;
      }
    }
  }

  if (isImage) {
    try {
      const ocrText = await runOcrOnFile(file);
      const ocrResult = classifyDocumentText(ocrText, "ocr");
      return ocrResult.kind !== "other" ? ocrResult : heuristic;
    } catch {
      return heuristic;
    }
  }

  return heuristic;
}

export function getDocumentKindLabel(kind: VehicleCostDocumentKind): string {
  return KIND_LABELS[kind];
}
