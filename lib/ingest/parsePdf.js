/**
 * Parse PDF or plain text from an ArrayBuffer.
 */
export async function parsePdfBuffer(arrayBuffer) {
  const buffer = Buffer.from(arrayBuffer);
  try { const pdfParse = (await import("pdf-parse")).default; const result = await pdfParse(buffer); return { text: result.text, pages: result.numpages, info: result.info || {} }; } catch (e) { return { text: buffer.toString("utf8").slice(0, 50000), pages: 0, info: {fallback:true} }; }
}
export async function parseTextBuffer(arrayBuffer) { return { text: Buffer.from(arrayBuffer).toString("utf8"), pages: 1, info: {} }; }
