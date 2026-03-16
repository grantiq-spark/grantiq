// pages/api/slack.js
// Slack Incoming Webhook + API 연동

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const { action, data } = req.body;

  const WEBHOOK = process.env.SLACK_WEBHOOK_URL;
  const TOKEN = process.env.SLACK_BOT_TOKEN;
  const CHANNEL = process.env.SLACK_CHANNEL_ID || "#grantiq";

  try {
    // ── 1. 공고 공유 (Webhook) ──────────────────────────────────────────
    if (action === "shareGrant") {
      const score = data.matchScore || 0;
      const emoji = score >= 70 ? "🎯" : score >= 45 ? "⚡" : "📋";
      const color = score >= 70 ? "#10b981" : score >= 45 ? "#f59e0b" : "#6b7280";

      const body = {
        text: `${emoji} *새 공고 매칭 알림* — ${data.title}`,
        attachments: [
          {
            color,
            blocks: [
              {
                type: "section",
                text: {
                  type: "mrkdwn",
                  text: `*${data.title}*\n${data.agency || ""} ${data.budget ? `· ${data.budget}` : ""} ${data.deadline ? `· 마감 ${data.deadline}` : ""}`,
                },
                accessory: {
                  type: "button",
                  text: { type: "plain_text", text: "원문 보기" },
                  url: data.url || "https://www.ntis.go.kr",
                  action_id: "view_grant",
                },
              },
              {
                type: "section",
                fields: [
                  { type: "mrkdwn", text: `*매칭 점수*\n${score}/100점` },
                  { type: "mrkdwn", text: `*판정*\n${score >= 70 ? "강력 매칭 ✅" : score >= 45 ? "부분 매칭 ⚡" : "낮은 연관성"}` },
                ],
              },
              data.summary && {
                type: "section",
                text: { type: "mrkdwn", text: `> ${data.summary}` },
              },
              data.verdict && {
                type: "section",
                text: { type: "mrkdwn", text: `💬 *AI 분석*: ${data.verdict}` },
              },
              {
                type: "actions",
                elements: [
                  {
                    type: "button",
                    text: { type: "plain_text", text: "✍️ 사업계획서 작성" },
                    style: "primary",
                    value: JSON.stringify({ title: data.title, agency: data.agency }),
                    action_id: "create_proposal",
                  },
                ],
              },
            ].filter(Boolean),
          },
        ],
      };

      const r = await fetch(WEBHOOK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error(`Slack webhook error: ${r.status}`);
      return res.status(200).json({ success: true });
    }

    // ── 2. 사업계획서 초안 공유 ────────────────────────────────────────
    if (action === "shareProposal") {
      const body = {
        channel: CHANNEL,
        text: `✍️ 사업계획서 초안 생성 완료 — ${data.title}`,
        blocks: [
          {
            type: "header",
            text: { type: "plain_text", text: `✍️ 사업계획서 초안 — ${data.title}` },
          },
          {
            type: "section",
            fields: [
              { type: "mrkdwn", text: `*주관기관*\n${data.agency}` },
              { type: "mrkdwn", text: `*총 예산*\n${data.budget}` },
            ],
          },
          {
            type: "section",
            text: { type: "mrkdwn", text: `*최종 목표*\n${data.finalGoal}` },
          },
          {
            type: "section",
            text: { type: "mrkdwn", text: `*과제 요약*\n${data.summary}` },
          },
          { type: "divider" },
          {
            type: "context",
            elements: [{ type: "mrkdwn", text: `GRANTIQ AI 생성 초안 · ${new Date().toLocaleDateString("ko-KR")}` }],
          },
        ],
      };

      const r = await fetch("https://slack.com/api/chat.postMessage", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${TOKEN}`,
        },
        body: JSON.stringify(body),
      });
      const result = await r.json();
      if (!result.ok) throw new Error(result.error);
      return res.status(200).json({ success: true, ts: result.ts });
    }

    // ── 3. 연구노트 공유 ───────────────────────────────────────────────
    if (action === "shareLabNote") {
      const body = {
        channel: data.channel || CHANNEL,
        text: `📋 연구노트 등록 — ${data.title}`,
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `📋 *${data.title}*\n*${data.docId}* · ${data.researcher} · ISO ${data.grade}등급`,
            },
          },
          ...( data.sections?.slice(0, 4).map(s => ({
            type: "section",
            text: { type: "mrkdwn", text: `*${s.label}*\n${s.content}` },
          })) || []),
          { type: "divider" },
          {
            type: "context",
            elements: [{ type: "mrkdwn", text: `GRANTIQ 연구노트 · ISO 13485 기준 · ${data.date}` }],
          },
        ],
      };

      const r = await fetch("https://slack.com/api/chat.postMessage", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${TOKEN}`,
        },
        body: JSON.stringify(body),
      });
      const result = await r.json();
      if (!result.ok) throw new Error(result.error);
      return res.status(200).json({ success: true });
    }

    res.status(400).json({ error: "Unknown action" });
  } catch (err) {
    console.error("Slack API error:", err);
    res.status(500).json({ error: err.message });
  }
}
