/**
 * POST /api/slack/interactivity
 * Handles block_actions: start_board_review, generate_proposal, refresh_memory, rerun_monitor
 */
import { verifySlackSignature } from "../../../lib/slack/verify.js";
import { postMessage } from "../../../lib/slack/client.js";
import { runBoardReview } from "../../../lib/workflows/boardReview.js";
import { generateProposal } from "../../../lib/workflows/generateProposal.js";
import { buildMemoryContext } from "../../../lib/store/companyMemory.js";
import { fetchOpportunities } from "../../../lib/monitor/fetchOpportunities.js";
import { verifyOpportunity } from "../../../lib/monitor/verifyOpportunity.js";
import { boardPacketBlocks } from "../../../lib/slack/messages.js";
import { dbInsert, dbGet } from "../../../lib/db/index.js";

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

  if (!verifySlackSignature(req, rawStr)) {
    return res.status(401).json({ error: "Invalid signature" });
  }

  const params = new URLSearchParams(rawStr);
  const payloadStr = params.get("payload");
  if (!payloadStr) return res.status(400).json({ error: "No payload" });

  let payload;
  try { payload = JSON.parse(payloadStr); }
  catch { return res.status(400).json({ error: "Invalid payload JSON" }); }

  // Ack immediately
  res.status(200).json({ ok: true });

  if (payload.type !== "block_actions") return;

  const action = payload.actions?.[0];
  if (!action) return;

  const channel = payload.channel?.id || payload.container?.channel_id;
  const threadTs = payload.container?.thread_ts || payload.message?.ts;

  Promise.resolve().then(async () => {
    const actionId = action.action_id;
    const value = action.value;

    if (actionId === "start_board_review") {
      const opp = await dbGet("opportunities", value).catch(() => null);
      if (!opp) {
        await postMessage({ channel, thread_ts: threadTs, text: `❌ 공고 데이터 없음: ${value}` });
        return;
      }
      await postMessage({ channel, thread_ts: threadTs, text: `🏛️ 이사회 심의 시작 — ${opp.title}` });
      await runBoardReview({ opportunity: opp, slackChannel: channel, threadTs });

    } else if (actionId === "generate_proposal") {
      await generateProposal({ opportunityId: value, slackChannel: channel, threadTs });

    } else if (actionId === "refresh_memory") {
      const mem = await buildMemoryContext();
      await postMessage({
        channel, thread_ts: threadTs,
        text: `🧠 메모리 현황 — ${mem.company_name}\n역량 ${mem.capabilities.length}개 · 실적 ${mem.past_projects.length}개 · 근거 ${mem.evidence_snippets.length}개`,
      });

    } else if (actionId === "rerun_monitor") {
      await postMessage({ channel, thread_ts: threadTs, text: "🔍 모니터 재실행..." });
      const opps = await fetchOpportunities();
      for (const opp of opps.slice(0, 3)) {
        const v = await verifyOpportunity(opp);
        const rec = await dbInsert("opportunities", { ...opp, fit_score: v.fit_score, fit_grade: v.fit_grade, verdict: v.verdict, status: "found" });
        if (v.fit_score >= 55) {
          await postMessage({
            channel, thread_ts: threadTs,
            text: `📋 공고: ${opp.title} (${v.fit_score}점)`,
            blocks: boardPacketBlocks(rec),
          });
        }
      }
      await postMessage({ channel, thread_ts: threadTs, text: `✅ 모니터 완료 — ${opps.length}개 검색` });
    }
  }).catch(err => {
    console.error("[interactivity]", err);
    postMessage({ channel, thread_ts: threadTs, text: `❌ 오류: ${err.message}` }).catch(() => {});
  });
}
