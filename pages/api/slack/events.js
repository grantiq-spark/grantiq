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
  if (!verifySlackSignature(req, rawStr)) return res.status(401).json({ error: "Invalid signature" });
  let payload;
  try { payload = JSON.parse(rawStr); }
  catch { return res.status(400).json({ error: "Invalid JSON" }); }
  if (payload.type === "url_verification") return res.status(200).json({ challenge: payload.challenge });
  res.status(200).json({ ok: true });
  const event = payload.event;
  if (!event) return;
  Promise.resolve().then(async () => {
    if (event.type === "file_shared") await handleFileShared(event);
    else if (event.type === "app_mention") await handleAppMention(event);
  }).catch(err => console.error("[slack/events] Unhandled:", err));
}

async function handleFileShared(event) {
  const { file_id, channel_id } = event;
  if (!file_id || !channel_id) return;
  await addReaction(channel_id, event.event_ts, "eyes").catch(() => {});
  await postMessage({ channel: channel_id, text: "⏳ 파일 분석 중...", blocks: ingestionProgressBlocks("⏳", "processing", "사 시작") });
  try {
    const result = await ingestSlackFile(file_id);
    const caps = result.extracted.capabilities?.length || 0;
    const projs = result.extracted.past_projects?.length || 0;
    const snippets = result.extracted.evidence_snippets?.length || 0;
    await postMessage({ channel: channel_id, text: `�B�I 완료: ${result.name}`, blocks: ingestionProgressBlocks(result.name, "done", `${result.text_length}자 · 역량 ${caps}개 · 실� $
Lprojs}개 · 근거 ${snippets}갗`) });
    await addReaction(channel_id, event.event_ts, "white_check_mark").catch(() => {});
  } catch (err) {
    console.error("[file_shared]", err);
    await postMessage({ channel: channel_id, text: `❌ 실패: ${err.message}`, blocks: ingestionProgressBlocks("파일", "error", err.message) });
    await addReaction(channel_id, event.event_ts, "x").catch(() => {});
  }
}

async function handleAppMention(event) {
  const { channel, ts, text } = event;
  const lower = (text || "").replace(/<@[^>]+>/g, "").trim().toLowerCase();
  if (lower.includes("memory") || lower.includes("메모리")) {
    const mem = await buildMemoryContext();
    await postMessage({ channel, thread_ts: ts, text: `🧠 *${mem.company_name}*\n역량 ${mem.capabilities.length}개 · 실� ${mem.past_projects.length}j�� · 근거 ${mem.evidence_snippets.length}j�� · 인증 ${mem.certifications.join(, ")}` });
    return;
  }
  if (lower.includes("monitor") || lower.includes("공고")) {
    await postMessage({ channel, thread_ts: ts, text: "🔍 공고 탐색 중..." });
    try {
      const query = lower.replace(/monitor|공고|탐색|now/g, "").trim() || null;
      const opps = await fetchOpportunities(query);
      if (!opps.length) { await postMessage({ channel, thread_ts: ts, text: "곀색 결과가 없흌" }); return; }
      for (const opp of opps.slice(0,3)) {
        const v = await verifyOpportunity(opp);
        const rec = await dbInsert("opportunities", {...opp, fit_score:v.fit_score, fit_grade:v.fit_grade, verdict:v.verdict, status:"found"});
        if (v.fit_score >= 55) await postMessage({ channel, thread_ts:ts, text:`📋 공고: ${opp.title} (${v.fit_score}점)`, blocks:boardPacketBlocks(rec) });
      }
    } catch (err) { await postMessage({ channel, thread_ts:ts, text: `❌ 실패: ${err.message}` }); }
    return;
  }
  const rm = lower.match(/review\s+([a-z0-9_]+)/i);
  if (rm) {
    const opp = await dbGet("opportunities", rm[1]).catch(() => null);
    if (!opp) { await postMessage({ channel, thread_ts:ts, text: `❌ 공고 ${rm[1]} 없음" }); return; }
    await postMessage({ channel, thread_ts:ts, text: `🏛️ 이사회 심의 시작: ${opp.title}` });
    await runBoardReview({ opportunity: opp, slackChannel: channel, threadTs: ts });
    return;
  }
  const pm = lower.match(/proposal\s+([a-z0-9_]+)/i);
  if (pm) { await generateProposal({ opportunityId: pm[1], slackChannel: channel, threadTs: ts }); return; }
  await postMessage({ channel, thread_ts:ts, text: "🤖 수주 GRANTIQ\n\n*사용법:*\n• 파일 업로드 → 회사 메모리 추출\n• `monitor` → R&D 공고\n• `memory` → 橸︗ status\n• `review <id>` → 이사회 심의\n• `proposal <id>` → 사업계획서 초안" });
}
