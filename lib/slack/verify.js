/**
 * Verify Slack request signature using HMAC-SHA256.
 * STRICT: no secret = false (never skip verification)
 */
import crypto from "crypto";

export function verifySlackSignature(req, rawBody) {
  const secret = process.env.SLACK_SIGNING_SECRET;
  if (!secret) {
    console.error("[slack/verify] SLACK_SIGNING_SECRET not configured — rejecting");
    return false;
  }

  const timestamp = req.headers["x-slack-request-timestamp"];
  const signature = req.headers["x-slack-signature"];

  if (!timestamp || !signature) return false;

  // Reject requests older than 5 minutes (replay attack prevention)
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;

  const sigBase = `v0:${timestamp}:${rawBody}`;
  const computed = "v0=" + crypto
    .createHmac("sha256", secret)
    .update(sigBase)
    .digest("hex");

  try {
    return crypto.timingSafeEqual(
      Buffer.from(computed),
      Buffer.from(signature)
    );
  } catch {
    return false;
  }
}

export async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    let chunks = [];
    req.on("data", chunk => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}
