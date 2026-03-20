// pages/api/slack/index.js — Frontend proxy for Slack actions
// Routes POST /api/slack → /api/slack/webhook with INTERNAL_API_SECRET injected

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ success: false, error: "Method Not Allowed" });
  }

  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) {
    return res.status(500).json({ success: false, error: "INTERNAL_API_SECRET not configured" });
  }

  // Determine the absolute URL for the webhook endpoint
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const webhookUrl = `${proto}://${host}/api/slack/webhook`;

  try {
    const upstream = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-secret": secret,
      },
      body: JSON.stringify(req.body),
    });

    const data = await upstream.json();
    return res.status(upstream.status).json(data);
  } catch (err) {
    console.error("[slack/index proxy]", err);
    return res.status(502).json({ success: false, error: err.message || "Webhook proxy failed" });
  }
}
