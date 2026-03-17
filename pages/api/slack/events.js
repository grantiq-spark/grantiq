/**
 * POST /api/slack/events
 * Handles: url_verification, app_mention, file_shared
 * - bodyParser: false (raw body required for signature verification)
 * - Acks in <3s, long work runs async
 * - slackFiles imported dynamically to avoid Next.js static bundle issues
 */

import { verifySlackSignature } from "../../../lib/slack/verify.js";
import { postMessage, addReaction } from "../../../lib/slack/client.js";
import { ingestionProgressBlocks, boardPacketBlocks } from "../../../lib/slack/messages.js";
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
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const rawBuf = await readRawBody(req);
  const rawStr = rawBuf.toString("utf8");

  if (!verifySlackSignature(req, rawStr)) {
    return res.status(401).json({ error: "Invalid signature" });
  }

  let payload;
  try { payload = JSON.parse(rawStr); }
  catch { return res.status(400).json({ error: "Invalid JSON" }); }

  if (payload.type === "url_verification") {
    return res.status(200).json({ challenge: payload.challenge });
  }

  res.status(200).json({ ok: true });

  const event = payload.event;
  if (!event) return;

  Promise.resolve().then(async () => {
    if (event.type === "file_shared") await handleFileShared(event);
    if (event.type === "app_mention") await handleAppMention(event);
  }).catch(err => console.error("[events] unhandled:", err));
}

async function handleFileShared(event) {
  const { file_id, channel_id } = event;
  if (!file_id || !channel_id) return;
  await addReaction(channel_id, event.event_ts, "eyes").catch(() => {});
  await postMessage({ channel: channel_id, text: "Analyzing file...", blocks: ingestionProgressBlocks("file", "processing", "Extracting company memory") });
  try {
    const { ingestSlackFile } = await import("../../../lib/ingest/slackFiles.js");
    const result = await ingestSlackFile(file_id);
    const caps = (result.extracted?.capabilities?.length) || 0;
    const projs = (result.extracted?.past_projects?.length) || 0;
    const snippets = (result.extracted?.evidence_snippets?.length) || 0;
    await postMessage({ channel: channel_id, text: "Done: "+result.name, blocks: ingestionProgressBlocks(result.name,"done",result.text_length+"chars caps:"+caps+" projs:"+projs+" evidence:"+'snippets) });
    await addReaction(channel_id, event.event_ts,"white_check_mark").catch(()=>{});
  } catch(err) {
    console.error("[file_shared]",err);
    await postMessage({ channel: channel_id, text: "Failed: "+err.message, blocks: ingestionProgressBlocks("file","error",err.message) });
    await addReaction(channel_id,event.event_ts,"x").catch(()=>{});
  }
}

async function handleAppMention(event) {
  const { channel, ts, text } = event;
  const cmd = (text||"").replace(/<@[^>]+>/g,"").trim();
  const lower = cmd.toLowerCase();
  if (!cmd || lower.includes("help")) {
    await postMessage({ channel, thread_ts: ts, text: "*GRANTIQ commands*\n- Upload file => auto memory\n- monitor now => search\n- memory status => show\n- review <id> => board\n- proposal <id> => draft\n- status => info" });
    return;
  }
  if (lower.includes("memory")) {
    const mem=await buildMemoryContext();
    await postMessage({ channel, thread_ts: ts, text: "Memory: "+mem.company_name+"\ncaps:"+mem.capabilities.length+" projs:"+mem.past_projects.length+" evidence:"+mem.evidence_snippets.length+((process.env.DATABASE_URL)?"":"\n[WARNING] in-memory DB") });
    return;
  }
  if (lower.includes("monitor")||lower.includes("search")) {
    await postMessage({ channel, thread_ts: ts, text: "Searching..." });
    try {
      const q=lower.replace(/monitor|search|now/g,"").trim()||null;
      const opps=await fetchOpportunities(q);
      if (!opps.length){ await postMessage({ channel, thread_ts: ts, text:"No results." }); return; }
      let posted=0;
      for(/const opp of opps.slice(0,5)) {
        const v=await verifyOpportunity(opp);
        const rec=await dbInsert("opportunities",{...opp,fit_score:v.fit_score,fit_grade:v.fit_grade,verdict:v.verdict,status:"found"});
        if(v.fit_score>=55){ await postMessage({ channel, thread_ts:ts, text:"Found ("+v.fit_score+"pts): "+opp.title, blocks:boardPacketBlocks(rec) }); posted++; }
      }
      await postMessage({ channel, thread_ts:ts, text:"Done: "+opps.length+" searched, "+posted+" posted" });
    } catch(err){ await postMessage({ channel, thread_ts:ts, text:"Error: "+err.message }); }
    return;
  }
  const rm=lower.match(/review\s+([^\s]+)/i);
  if(rm){
    const opp=await dbGet("opportunities",rm[1]).catch(()=>null);
    if(!opp){ await postMessage({ channel, thread_ts:ts, text:"Not found: "+rm[1] }); return; }
    await postMessage({ channel, thread_ts:ts, text:"Board review: "+opp.title });
    await runBoardReview({ opportunity:opp, slackChannel:channel, threadTs:ts });
    return;
  }
  const pm=lower.match(/proposal\s+([^\s]+)/i);
  if(pm){ await generateProposal({ opportunityId:pm[1], slackChannel:channel, threadTs:ts }); return; }
  if(lower.includes("status")){
    const [opps,reviews,drafts]=await Promise.all([dbList("opportunities").catch(()=>[]),dbList("board_reviews").catch(()=>[]),dbList("proposal_drafts").catch(()=>[])]);
    await postMessage({ channel, thread_ts:ts, text:"Status: opps:"+opps.length+" reviews:"+reviews.length+" drafts:"+drafts.length+((process.env.DATABASE_URL"ÿ"":"\n[WARNING] in-memory DB") });
    return;
  }
  await postMessage({ channel, thread_ts:ts, text:"Unknown command. Try @GRANTIQ help" });
}
