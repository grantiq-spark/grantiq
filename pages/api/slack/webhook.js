// pages/api/slack/webhook.js
// Slack Incoming Webhook + chat.postMessage (shareGrant / shareProposal / shareLabNote)
// Replaces pages/api/slack.js (moved here to avoid conflict with pages/api/slack/ directory)

import crypto from "crypto";

// ── Helpers ──────────────────────────────────────────────────────────────────

function assertEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error("Missing required env: " + name);
  return v;
}

function escapeMrkdwn(text) {
  return String(text ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function truncate(text, max) {
  const s = String(text ?? "");
  return s.length <= max ? s : s.slice(0, max - 1) + "…";
}

function safeStr(value, fallback) {
  return typeof value === "string" && value.trim() ? value.trim() : String(fallback ?? "");
}

function normalizeUrl(url) {
  if (typeof url === "string" && /^https?:\/\//.test(url)) return url;
  return "https://www.ntis.go.kr";
}

function clamp(n, lo, hi) {
  const num = Number(n);
  return isNaN(num) ? lo : Math.min(hi, Math.max(lo, num));
}

function kstDate() {
  return new Date().toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" });
}

async function postWebhook(url, body) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const text = await r.text().catch(() => r.status.toString());
    throw new Error("Slack webhook " + r.status + ": " + text);
  }
}

async function postSlackApi(method, token, body) {
  const r = await fetch("https://slack.com/api/" + method, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + token,
    },
    body: JSON.stringify(body),
  });
  let result;
  try { result = await r.json(); } catch { throw new Error("Slack API non-JSON response (" + r.status + ")"); }
  if (!r.ok) throw new Error("Slack API HTTP " + r.status);
  if (!result.ok) throw new Error("Slack API error: " + (result.error ?? "unknown"));
  return result;
}

function verifySecret(req) {
  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) throw new Error("INTERNAL_API_SECRET is not configured");
  const header = req.headers["x-internal-secret"] ?? "";
  const a = Buffer.from(header.padEnd(64));
  const b = Buffer.from(secret.padEnd(64));
  try {
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b) && header === secret;
  } catch { return false; }
}

// ── Handler ───────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ success: false, error: "Method Not Allowed" });
  }

  // Internal secret auth
  try {
    if (!verifySecret(req)) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }
  } catch (err) {
    return res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }

  if (!req.body || typeof req.body !== "object") {
    return res.status(400).json({ success: false, error: "Invalid or missing request body" });
  }

  const { action, data = {} } = req.body;
  if (!action) return res.status(400).json({ success: false, error: "Missing action" });

  // CHANNEL env: prefer channel ID (C...) over channel name per Slack API recommendation
  const CHANNEL = process.env.SLACK_CHANNEL_ID || "#grantiq";

  try {
    // ── 1. 공고 공유 (Incoming Webhook) ─────────────────────────────────────
    // shareGrant uses a Webhook URL — the destination channel is determined by the Webhook config,
    // not overridden here. Update the Webhook in Slack App settings to change the channel.
    if (action === "shareGrant") {
      if (!data.title) return res.status(400).json({ success: false, error: "data.title required" });
      const WEBHOOK = assertEnv("SLACK_WEBHOOK_URL");

      const score = clamp(data.matchScore, 0, 100);
      const emoji = score >= 70 ? "🎯" : score >= 45 ? "⚡" : "📋";
      const color = score >= 70 ? "#10b981" : score >= 45 ? "#f59e0b" : "#6b7280";
      const title = truncate(escapeMrkdwn(data.title), 150);
      const agency = truncate(escapeMrkdwn(safeStr(data.agency, "")), 80);
      const budget = data.budget ? "· " + truncate(escapeMrkdwn(data.budget), 40) : "";
      const deadline = data.deadline ? "· 마감 " + truncate(escapeMrkdwn(data.deadline), 30) : "";
      const summary = data.summary ? truncate(escapeMrkdwn(data.summary), 280) : null;
      const verdict = data.verdict ? truncate(escapeMrkdwn(data.verdict), 280) : null;
      // Button value must be ≤ 2000 chars
      const btnValue = truncate(JSON.stringify({ title: safeStr(data.title, ""), agency: safeStr(data.agency, "") }), 2000);

      const body = {
        text: emoji + " *새 공고 매칭 알림* — " + title,
        attachments: [{
          color,
          blocks: [
            {
              type: "section",
              text: { type: "mrkdwn", text: truncate("*" + title + "*\n" + agency + " " + budget + " " + deadline, 3000) },
              accessory: {
                type: "button",
                text: { type: "plain_text", text: "원문 보기" },
                url: normalizeUrl(data.url),
                action_id: "view_grant",
              },
            },
            {
              type: "section",
              fields: [
                { type: "mrkdwn", text: "*매칭 점수*\n" + score + "/100점" },
                { type: "mrkdwn", text: "*판정*\n" + (score >= 70 ? "강력 매칭 ✅" : score >= 45 ? "부분 매칭 ⚡" : "낮은 연관성") },
              ],
            },
            summary && { type: "section", text: { type: "mrkdwn", text: "> " + summary } },
            verdict && { type: "section", text: { type: "mrkdwn", text: "💬 *AI 분석*: " + verdict } },
            {
              // TODO: create_proposal button interactivity is handled by /api/slack/interactivity — not here
              type: "actions",
              elements: [{
                type: "button",
                text: { type: "plain_text", text: "✍️ 사업계획서 작성" },
                style: "primary",
                value: btnValue,
                action_id: "create_proposal",
              }],
            },
          ].filter(Boolean),
        }],
      };

      await postWebhook(WEBHOOK, body);
      return res.status(200).json({ success: true });
    }

    // ── 2. 사업계획서 초안 공유 ─────────────────────────────────────────────
    if (action === "shareProposal") {
      const required = ["title", "agency", "budget", "finalGoal", "summary"];
      for (const k of required) {
        if (!data[k]) return res.status(400).json({ success: false, error: "data." + k + " required" });
      }
      const TOKEN = assertEnv("SLACK_BOT_TOKEN");
      const title     = truncate(escapeMrkdwn(data.title), 150);
      const agency    = truncate(escapeMrkdwn(data.agency), 80);
      const budget    = truncate(escapeMrkdwn(data.budget), 80);
      const finalGoal = truncate(escapeMrkdwn(data.finalGoal), 500);
      const summary   = truncate(escapeMrkdwn(data.summary), 500);

      const result = await postSlackApi("chat.postMessage", TOKEN, {
        channel: CHANNEL,
        text: "✍️ 사업계획서 초안 생성 완료 — " + title,
        blocks: [
          { type: "header", text: { type: "plain_text", text: truncate("✍️ 사업계획서 초안 — " + data.title, 150) } },
          { type: "section", fields: [
            { type: "mrkdwn", text: "*주관기관*\n" + agency },
            { type: "mrkdwn", text: "*총 예산*\n" + budget },
          ]},
          { type: "section", text: { type: "mrkdwn", text: "*최종 목표*\n" + finalGoal } },
          { type: "section", text: { type: "mrkdwn", text: "*과제 요약*\n" + summary } },
          { type: "divider" },
          { type: "context", elements: [{ type: "mrkdwn", text: "GRANTIQ AI 생성 초안 · " + kstDate() }] },
        ],
      });
      return res.status(200).json({ success: true, ts: result.ts });
    }

    // ── 3. 연구노트 공유 ────────────────────────────────────────────────────
    if (action === "shareLabNote") {
      const required = ["title", "docId", "researcher"];
      for (const k of required) {
        if (!data[k]) return res.status(400).json({ success: false, error: "data." + k + " required" });
      }
      const TOKEN = assertEnv("SLACK_BOT_TOKEN");
      const channel   = typeof data.channel === "string" && data.channel ? data.channel : CHANNEL;
      const title      = truncate(escapeMrkdwn(data.title), 150);
      const docId      = truncate(escapeMrkdwn(data.docId), 80);
      const researcher = truncate(escapeMrkdwn(data.researcher), 80);
      const grade      = truncate(escapeMrkdwn(safeStr(data.grade, "-")), 10);
      const date       = truncate(escapeMrkdwn(safeStr(data.date, kstDate())), 30);

      const sections = Array.isArray(data.sections)
        ? data.sections.slice(0, 4).map(s => ({
            type: "section",
            text: { type: "mrkdwn", text: "*" + truncate(escapeMrkdwn(safeStr(s.label, "")), 80) + "*\n" + truncate(escapeMrkdwn(safeStr(s.content, "")), 500) },
          }))
        : [];

      await postSlackApi("chat.postMessage", TOKEN, {
        channel,
        text: "📋 연구노트 등록 — " + title,
        blocks: [
          { type: "section", text: { type: "mrkdwn", text: "📋 *" + title + "*\n*" + docId + "* · " + researcher + " · ISO " + grade + "등급" } },
          ...sections,
          { type: "divider" },
          { type: "context", elements: [{ type: "mrkdwn", text: "GRANTIQ 연구노트 · ISO 13485 기준 · " + date }] },
        ],
      });
      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ success: false, error: "Unknown action: " + action });

  } catch (err) {
    console.error("[slack/webhook]", err);
    return res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
}
