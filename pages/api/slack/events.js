/**
 * POST /api/slack/events
 * Handles: url_verification, app_mention, file_shared
 */
import { verifySlackSignature } from "../../../lib/slack/verify.js";
import { postMessage, addReaction } from "../../../lib/slack/client.js";
import { ingestionProgressBlocks, boardPacketBlocks } from "../../../lib/slack/messages.js";
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
    let data = Buffer.alloc(0);
    req.on("data", chunk => { data = Buffer.concat([data, chunk]); });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const rawBody = await readRawBody(req);
  const rawStr = rawBody.toString("utf8");

  // Verify Slack signature
  if (!verifySlackSignature(req, rawStr)) {
    return res.status(401).json({ error: "Invalid signature" });
  }

  let payload;
  try { payload = JSON.parse(rawStr); }
  catch { return res.status(400).json({ error: "Invalid JSON" }); }

  // URL verification challenge
  if (payload.type === "url_verification") {
    return res.status(200).json({ challenge: payload.challenge });
  }

  // Ack immediately
  res.status(200).json({ ok: true });

  const event = payload.event;
  if (!event) return;

  // Async processing — errors logged but not surfaced
  Promise.resolve().then(async () => {
    if (event.type === "file_shared") await handleFileShared(event);
    else if (event.type === "app_mention") await handleAppMention(event);
  }).catch(err => console.error("[slack/events] Unhandled:", err));
}

async function handleFileShared(event) {
  const { file_id, channel_id } = event;
  if (!file_id || !channel_id) return;

  await addReaction(channel_id, event.event_ts, "eyes").catch(() => {});
  await postMessage({
    channel: channel_id,
    text: "⏳ 파일 분석 중...",
    blocks: ingestionProgressBlocks("파일", "processing", "회사 메모리 추출 시작"),
  });

  try {
    const result = await ingestSlackFile(file_id);
    const caps = result.extracted.capabilities?.length || 0;
    const projs = result.extracted.past_projects?.length || 0;
    const snippets = result.extracted.evidence_snippets?.length || 0;

    await postMessage({
      channel: channel_id,
      text: `✅ 파일 분석 완료: ${result.name}`,
      blocks: ingestionProgressBlocks(
        result.name, "done",
        `${result.text_length.toLocaleString()}자 · 역량 ${caps}개 · 실적 ${projs}개 · 근거 ${snippets}개 추출`
      ),
    });
    await addReaction(channel_id, event.event_ts, "white_check_mark").catch(() => {});
  } catch (err) {
    console.error("[file_shared]", err);
    await postMessage({
      channel: channel_id,
      text: `❌ 파일 분석 실패: ${err.message}`,
      blocks: ingestionProgressBlocks("파일", "error", err.message),
    });
    await addReaction(channel_id, event.event_ts, "x").catch(() => {});
  }
}

async function handleAppMention(event) {
  const { channel, ts, text } = event;
  const lower = (text || "").replace(/<@[^>]+>/g, "").trim().toLowerCase();

  // "memory status"
  if (lower.includes("memory") || lower.includes("메모리")) {
    const mem = await buildMemoryContext();
    await postMessage({
      channel, thread_ts: ts,
      text: [
        `🧠 *회사 메모리 현황* — ${mem.company_name}`,
        `• 역량: ${mem.capabilities.length}개`,
        `• 실적: ${mem.past_projects.length}개`,
        `• 근거: ${mem.evidence_snippets.length}개`,
        `• 인증: ${mem.certifications.join(", ") || "없음"}`,
        `• 키워드: ${mem.keywords.slice(0, 6).join(", ")}`,
      ].join("\n"),
    });
    return;
  }

  // "monitor now" / "공고 탐색"
  if (lower.includes("monitor") || lower.includes("공고") || lower.includes("탐색")) {
    await postMessage({ channel, thread_ts: ts, text: "🔍 공고 탐색 시작..." });
    try {
      const query = lower.replace(/monitor|공고|탐색|now/g, "").trim() || null;
      const opps = await fetchOpportunities(query);
      if (!opps.length) {
        await postMessage({ channel, thread_ts: ts, text: "검색 결과가 없습니다." });
        return;
      }
      for (const opp of opps.slice(0, 3)) {
        const v = await verifyOpportunity(opp);
        const rec = await dbInsert("opportunities", { ...opp, fit_score: v.fit_score, fit_grade: v.fit_grade, verdict: v.verdict, status: "found" });
        if (v.fit_score >= 55) {
          await postMessage({
            channel, thread_ts: ts,
            text: `📋 공고 발견 (적합도 ${v.fit_score}점): ${opp.title}`,
            blocks: boardPacketBlocks(rec),
          });
        }
      }
    } catch (err) {
      await postMessage({ channel, thread_ts: ts, text: `❌ 탐색 실패: ${err.message}` });
    }
    return;
  }

  // "review <id>"
  const reviewMatch = lower.match(/review\s+([a-z0-9_]+)/i);
  if (reviewMatch) {
    const oppId = reviewMatch[1];
    const opp = await dbGet("opportunities", oppId).catch(() => null);
    if (!opp) { await postMessage({ channel, thread_ts: ts, text: `❌ 공고 ${oppId}를 찾을 수 없습니다.` }); return; }
    await postMessage({ channel, thread_ts: ts, text: `🏛️ 이사회 심의 시작: ${opp.title}` });
    await runBoardReview({ opportunity: opp, slackChannel: channel, threadTs: ts });
    return;
  }

  // "proposal <id>"
  const proposalMatch = lower.match(/proposal\s+([a-z0-9_]+)/i);
  if (proposalMatch) {
    const oppId = proposalMatch[1];
    await generateProposal({ opportunityId: oppId, slackChannel: channel, threadTs: ts });
    return;
  }

  // Default help
  await postMessage({
    channel, thread_ts: ts,
    text: [
      "안녕하세요! GRANTIQ입니다 🤖",
      "",
      "*사용법:*",
      "• 파일 업로드 → 자동 회사 메모리 추출",
      "• `@GRANTIQ 공고 탐색` → R&D 공고 검색",
      "• `@GRANTIQ monitor now` → 모니터 즉시 실행",
      "• `@GRANTIQ memory status` → 메모리 현황",
      "• `@GRANTIQ review <공고ID>` → 이사회 심의",
      "• `@GRANTIQ proposal <공고ID>` → 사업계획서 생성",
    ].join("\n"),
  });
}
