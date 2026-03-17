/**
 * POST /api/slack/interactivity
 * block_actions: approve_opportunity, pass_opportunity,
 *                start_board_review, generate_proposal,
 *                refresh_memory, rerun_monitor
 */
import { verifySlackSignature } from "../../../lib/slack/verify.js";
import { postMessage } from "../../../lib/slack/client.js";
import { runBoardReview } from "../../../lib/workflows/boardReview.js";
import { generateProposal } from "../../../lib/workflows/generateProposal.js";
import { buildMemoryContext } from "../../../lib/store/companyMemory.js";
import { fetchOpportunities } from "../../../lib/monitor/fetchOpportunities.js";
import { verifyOpportunity } from "../../../lib/monitor/verifyOpportunity.js";
import { proactiveOpportunityBlocks } from "../../../lib/slack/messages.js";
import { dbInsert, dbGet, dbUpdate } from "../../../lib/db/index.js";

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
  const params = new URLSearchParams(rawStr);
  const payloadStr = params.get("payload");
  if (!payloadStr) return res.status(400).json({ error: "No payload" });
  let payload;
  try { payload = JSON.parse(payloadStr); }
  catch { return res.status(400).json({ error: "Invalid payload JSON" }); }
  res.status(200).json({ ok: true });
  if (payload.type !== "block_actions") return;
  const action = payload.actions?.[0]; if (!action) return;
  const channel = payload.channel?.id || payload.container?.channel_id;
  const threadTs = payload.container?.thread_ts || payload.message?.ts;
  const actionId = action.action_id;
  const value = action.value;
  const userId = payload.user?.id;
  Promise.resolve().then(async () => {
    if (actionId === "approve_opportunity") {
      const opp = await dbGet("opportunities", value).catch(() => null);
      if (!opp) { await postMessage({ channel, thread_ts: threadTs, text: "                                                                                   : "+value }); return; }
      await dbUpdate("opportunities", value, { status: "approved" }).catch(() => {});
      await postMessage({ channel, thread_ts: threadTs, text: (userId?"<@"+userId+">                                                        .":"                                                       .")+"                                                                                           " });
      await runBoardReview({ opportunity: opp, slackChannel: channel, threadTs });
    } else if (actionId === "pass_opportunity") {
      await dbUpdate("opportunities", value, { status: "passed" }).catch(() => {});
      await postMessage({ channel, thread_ts: threadTs, text: (userId ? "<@"+userId+">                               CR" : "    CR")+"                                                    ." });
    } else if (actionId === "start_board_review") {
      const opp = await dbGet("opportunities", value).catch(() => null);
      if (!opp) { await postMessage({ channel, thread_ts: threadTs, text: "                                : "+value }); return; }
      await postMessage({ channel, thread_ts: threadTs, text: "                                                           : "+opp.title });
      await runBoardReview({ opportunity: opp, slackChannel: channel, threadTs });
    } else if (actionId === "generate_proposal") {
      await generateProposal({ opportunityId: value, slackChannel: channel, threadTs });
    } else if (actionId === "refresh_memory") {
      const mem = await buildMemoryContext();
      await postMessage({ channel, thread_ts: threadTs, text: "         *                               * : "+mem.company_name+"\n             "+mem.capabilities.length+"                         "+mem.past_projects.length+"                         "+mem.evidence_snippets.length+"      "+(process.env.DATABASE_URL?"":"\n             in-memory DB") });
    } else if (actionId === "rerun_monitor") {
      await postMessage({ channel, thread_ts: threadTs, text: "                                  ..." });
      const opps = await fetchOpportunities(); let posted = 0;
      for (const opp of opps.slice(0,3)) {
        const v = await verifyOpportunity(opp);
        const rec = await dbInsert("opportunities",{...opp, fit_score:v.fit_score, fit_grade:v.fit_grade, verdict:v.verdict, status:"found"});
        if(v.fit_score>=55){ await postMessage({ channel, thread_ts:threadTs, text:"            ("+v.fit_score+"pts): "+opp.title, blocks:proactiveOpportunityBlocks(rec,[],null) }); posted++; }
      }
      await postMessage({ channel, thread_ts:threadTs, text:"Analysis done: "+opps.length+" found, "+posted+" posted" });
    }
  }).catch(err => { postMessage({ channel, thread_ts:threadTs, text:"Error: "+err.message }).catch(()=>{}); });
}
