// pages/api/slack.js
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const { action, data } = req.body;
  const WEBHOOK = process.env.SLACK_WEBHOOK_URL;
  const TOKEN = process.env.SLACK_BOT_TOKEN;
  const CHANNEL = process.env.SLACK_CHANNEL_ID || "#grantiq";
  try {
    if (action === "shareGrant") {
      const score = data.matchScore || 0;
      const body = { text: `${score >= 70 ? "🎯" : "📋"} *${data.title}` };
      const r = await fetch(WEBHOOK, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!r.ok) throw new Error(`Slack error: ${r.status}`);
      return res.status(200).json({ success: true });
    }
    if (action === "shareProposal") {
      const body = { channel: CHANNEL, text: `✍️ 사업계획서 초안 생성 - ${data.title}` };
      const r = await fetch("https://slack.com/api/chat.postMessage", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` }, body: JSON.stringify(body) });
      const result = await r.json();
      if (!result.ok) throw new Error(result.error);
      return res.status(200).json({ success: true });
    }
    res.status(400).json({ error: "Unknown action" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
