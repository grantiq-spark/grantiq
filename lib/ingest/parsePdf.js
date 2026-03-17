/**
 * Parse PDF or plain text from an ArrayBuffer.
 * Uses text extraction fallback (no external pdf-parse dependency).
 */

export async function parsePdfBuffer(arrayBuffer) {
  const buffer = Buffer.from(arrayBuffer);
  return extractTextFallback(buffer);
}

export async function parseTextBuffer(arrayBuffer) {
  return { text: Buffer.from(arrayBuffer).toString("utf8"), pages: 1, info: {} };
}

function extractTextFallback(buffer) {
  const raw = buffer.toString("latin1");
  const strings = [];
  let current = "";
  for (const ch of raw) {
    const code = ch.charCodeAt(0);
    if ((code >= 32 && code < 127) || code === 10 || code === 13) {
      current += ch;
    } else {
      if (current.length > 4) strings.push(current.trim());
      current = "";
    }
  }
  if (current.length > 4) strings.push(current.trim());
  const text = strings
    .filter(s => s.length > 3 && /[a-zA-Z\uAC00-\uD7A3]/.test(s))
    .join("\n");
  return { text: text || buffer.toString("utf8").slice(0, 50000), pages: 0, info: { fallback: true } };
}
