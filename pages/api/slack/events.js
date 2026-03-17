/**
 * POST /api/slack/events
 * Handles: url_verification, app_mention, file_shared
 * - bodyParser: false (raw body required for signature verification)
 * - Acks in <3s, long work runs async
 */

import { verifySlackSignature } from "../../../lib/slack/verify.js";
import { postMessage, addReaction } from "../../../lib/slack/client.js";
import {
  ingestionProgressBlocks,
  boardPacketBlocks,
} from "../../../lib/slack/messages.js";
import { ingestSlackFile } from "../../../lib/ingest/slackFiles.js";
import { fetchOpportunities } from "../../../lib/monitor/fetchOpportunities.js";
import { verifyOpportunity } from "../../../lib/monitor/verifyOpportunity.js";
import { runBoardReview } from "../../../lib/workflows/boardReview.js";
import { generateProposal } from "../../../lib/workflows/generateProposal.js";
import { buildMemoryContext } from "../../../lib/store/companyMemory.js";
import { dbInsert, dbGet, dbList } from "../../../lib/db/index.js";

export const config = { api: { bodyParser: false } };

async function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", c => chunks.push(c));
    req.on("end",  () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const rawBuf = await readRawBody(req);
  const rawStr = rawBuf.toString("utf8");

  // Strict signature verification — 401 if secret missing or invalid
  if (!verifySlackSignature(req, rawStr)) {
    return res.status(401).json({ error: "Invalid signature" });
  }

  let payload;
  try { payload = JSON.parse(rawStr); }
  catch { return res.status(400).json({ error: "Invalid JSON" }); }

  // ── url_verification (Slack challenge) ──────────────────────────────────
  if (payload.type === "url_verification") {
    return res.status(200).json({ challenge: payload.challenge });
  }

  // ── ACK immediately (<3 s requirement) ──────────────────────────────────
  res.status(200).json({ ok: true });

  // ── Async event processing ───────────────────────────────────────────────
  const event = payload.event;
  if (!event) return;

  Promise.resolve().then(async () => {
    if (event.type === "file_shared")  await handleFileShared(event);
    if (event.type === "app_mention")  await handleAppMention(event);
  }).catch(err => console.error("[events] unhandled:", err));
}

// ────────────────────────────────────────────────────────────────────────────
// file_shared
// ────────────────────────────────────────────────────────────────────────────
async function handleFileShared(event) {
  const { file_id, channel_id } = event;
  if (!file_id || !channel_id) return;

  await addReaction(channel_id, event.event_ts, "eyes").catch(() => {});

  const progressMsg = await postMessage({
    channel: channel_id,
    text: "파일 분석 중...",
    blocks: ingestionProgressBlocks("파일", "processing", "회사 메모리 추출 중"),
  });

  try {
    const result   = await ingestSlackFile(file_id);
    const caps     = (result.extracted && result.extracted.capabilities && result.extracted.capabilities.length)     || 0;
    const projs    = (result.extracted && result.extracted.past_projects && result.extracted.past_projects.length)    || 0;
    const snippets = (result.extracted && result.extracted.evidence_snippets && result.extracted.evidence_snippets.length) || 0;
    const detail   = [
      result.text_length.toLocaleString() + "자",
      "역량 " + caps + "건",
      "실적 " + projs + "건",
      "근거 " + snippets + "건",
    ].join(" / ");

    await postMessage({
      channel: channel_id,
      text: "파일 분석 완료: " + result.name,
      blocks: ingestionProgressBlocks(result.name, "done", detail),
    });
    await addReaction(channel_id, event.event_ts, "white_check_mark").catch(() => {});
  } catch (err) {
    console.error("[file_shared]", err);
    await postMessage({
      channel: channel_id,
      text: "파일 분석 실패: " + err.message,
      blocks: ingestionProgressBlocks("파일", "error", err.message),
    });
    await addReaction(channel_id, event.event_ts, "x").catch(() => {});
  }
}

// ────────────────────────────────────────────────────────────────────────────
// app_mention
// ────────────────────────────────────────────────────────────────────────────
async function handleAppMention(event) {
  const { channel, ts, text } = event;
  // Strip the @mention tag
  const cmd = (text || "").replace(/<@[^>]+>/g, "").trim();
  const lower = cmd.toLowerCase();

  // ── help ─────────────────────────────────────────────────────────────────
  if (!cmd || lower.includes("help") || lower.includes("도움")) {
    await postMessage({
      channel, thread_ts: ts,
      text: [
        "*GRANTIQ 명령어*",
        "• 파일 업로드 → 회사 메모리 자동 갱신",
        "• `monitor now` → 공고 탐색 즉시 실행",
        "• `memory status` → 현재 메모리 현황",
        "• `review <id>` → 이사회 심의 시작",
        "• `proposal <id>` → 사업계획서 초안 생성",
        "• `status` → 전체 현황",
      ].join("\n"),
    });
    return;
  }

  // ── memory status ─────────────────────────────────────────────────────────
  if (lower.includes("memory") || lower.includes("메모리")) {
    const mem   = await buildMemoryContext();
    const certs = (mem.certifications || []).join(", ") || "없음";
    await postMessage({
      channel, thread_ts: ts,
      text: [
        "*회사 메모리 현황* — " + mem.company_name,
        "역량 " + mem.capabilities.length + "건 · "
          + "실적 " + mem.past_projects.length + "건 · "
          + "근거 " + mem.evidence_snippets.length + "건",
        "인증: " + certs,
        "키워드: " + (mem.keywords || []).slice(0, 6).join(", "),
        "",
        (!process.env.DATABASE_URL
          ? "⚠️ in-memory DB 사용 중 — 서버 재시작 시 초기화됩니다."
          : ""),
      ].filter(Boolean).join("\n"),
    });
    return;
  }

  // ── monitor now ───────────────────────────────────────────────────────────
  if (lower.includes("monitor") || lower.includes("공고") || lower.includes("탐색")) {
    await postMessage({ channel, thread_ts: ts, text: "🔍 공고 탐색 중..." });
    try {
      const q    = lower.replace(/monitor|공고|탐색|now/g, "").trim() || null;
      const opps = await fetchOpportunities(q);
      if (!opps.length) {
        await postMessage({ channel, thread_ts: ts, text: "검색 결과가 없습니다." });
        return;
      }
      let posted = 0;
      for (const opp of opps.slice(0, 5)) {
        const v   = await verifyOpportunity(opp);
        const rec = await dbInsert("opportunities", {
          ...opp,
          fit_score: v.fit_score,
          fit_grade: v.fit_grade,
          verdict:   v.verdict,
          status:    "found",
        });
        if (v.fit_score >= 55) {
          await postMessage({
            channel, thread_ts: ts,
            text: "공고 발견 (" + v.fit_score + "점): " + opp.title,
            blocks: boardPacketBlocks(rec),
          });
          posted++;
        }
      }
      await postMessage({
        channel, thread_ts: ts,
        text: "탐색 완료 — " + opps.length + "건 검색, " + posted + "건 공지",
      });
    } catch (err) {
      await postMessage({ channel, thread_ts: ts, text: "❌ 탐색 실패: " + err.message });
    }
    return;
  }

  // ── review <id> ───────────────────────────────────────────────────────────
  const reviewMatch = lower.match(/review\s+([^\s]+)/i);
  if (reviewMatch) {
    const oppId = reviewMatch[1];
    const opp   = await dbGet("opportunities", oppId).catch(() => null);
    if (!opp) {
      await postMessage({ channel, thread_ts: ts, text: "❌ 공고 `" + oppId + "` 없음" });
      return;
    }
    await postMessage({ channel, thread_ts: ts, text: "🏛️ 이사회 심의 시작: " + opp.title });
    await runBoardReview({ opportunity: opp, slackChannel: channel, threadTs: ts });
    return;
  }

  // ── proposal <id> ─────────────────────────────────────────────────────────
  const proposalMatch = lower.match(/proposal\s+([^\s]+)/i);
  if (proposalMatch) {
    await generateProposal({
      opportunityId: proposalMatch[1],
      slackChannel: channel,
      threadTs: ts,
    });
    return;
  }

  // ── status ────────────────────────────────────────────────────────────────
  if (lower.includes("status") || lower.includes("상태")) {
    const [opps, reviews, drafts] = await Promise.all([
      dbList("opportunities").catch(() => []),
      dbList("board_reviews").catch(() => []),
      dbList("proposal_drafts").catch(() => []),
    ]);
    await postMessage({
      channel, thread_ts: ts,
      text: [
        "*GRANTIQ 현황*",
        "공고 " + opps.length + "건 · 이사회 심의 " + reviews.length + "건 · 초안 " + drafts.length + "건",
        (!process.env.DATABASE_URL
          ? "⚠️ in-memory DB — 재시작 시 초기화됩니다. DATABASE_URL 설정을 권장합니다."
          : ""),
      ].filter(Boolean).join("\n"),
    });
    return;
  }

  // ── fallback ──────────────────────────────────────────────────────────────
  await postMessage({
    channel, thread_ts: ts,
    text: "명령어를 인식하지 못했습니다. `@GRANTIQ help` 로 사용법을 확인하세요.",
  });
}
