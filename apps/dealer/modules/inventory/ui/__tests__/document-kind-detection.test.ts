import {
  classifyDocumentText,
  detectDocumentKindFromFile,
  inferKindFromFilename,
} from "../document-kind-detection";

describe("document-kind-detection", () => {
  it("detects invoice from filename", () => {
    expect(inferKindFromFilename("repair-invoice.pdf", "application/pdf")).toMatchObject({
      kind: "invoice",
      source: "heuristic",
    });
  });

  it("detects receipt from filename", () => {
    expect(inferKindFromFilename("tow-receipt.jpg", "image/jpeg")).toMatchObject({
      kind: "receipt",
      source: "heuristic",
    });
  });

  it("falls back to other for ambiguous filenames", () => {
    expect(inferKindFromFilename("scan_001.pdf", "application/pdf")).toMatchObject({
      kind: "other",
    });
  });

  it("classifies invoice text", () => {
    expect(
      classifyDocumentText("Invoice # 1029 bill to customer subtotal tax total amount due", "pdf-text")
    ).toMatchObject({
      kind: "invoice",
      source: "pdf-text",
    });
  });

  it("classifies receipt text", () => {
    expect(
      classifyDocumentText("Store receipt thank you subtotal tax total change due", "ocr")
    ).toMatchObject({
      kind: "receipt",
      source: "ocr",
    });
  });

  it("uses OCR result when pdf text is weak", async () => {
    const file = new File(["pdf"], "scan.pdf", { type: "application/pdf" });
    const result = await detectDocumentKindFromFile(file, {
      extractPdfText: async () => "",
      runOcrOnFile: async () => "invoice subtotal tax total amount due",
    });
    expect(result).toMatchObject({ kind: "invoice", source: "ocr" });
  });

  it("returns other for conflicting weak signals", () => {
    expect(
      classifyDocumentText("invoice receipt", "ocr")
    ).toMatchObject({
      kind: "other",
    });
  });
});
