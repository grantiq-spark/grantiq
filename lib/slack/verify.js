/**
 * Verify Slack request signature using HMAC-SHA256.
 */
import crypto from "crypto";
export function verifySlackSignature(req, rawBody) {
  const secret = process.env.SLACK_SIGNING_SECRET;
  if (!secret) { console.warn("[slack] SLACK_SIGNING_SECRET not set — skipping verification"); return true; }
  const timestamp = req.headers["x-slack-request-timestamp"];
  const signature = req.headers["x-slack-signature"];
  if (!timestamp || !signature) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
  const sigBase = `v0:${timestamp}:${rawBody}`;
  const computed = "v0=" + crypto.createHmac("sha256", secret).update(sigBase).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(signature));
}
