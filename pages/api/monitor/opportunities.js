/**
 * GET /api/monitor/opportunities
 */
import { fetchOpportunities } from "../../../lib/monitor/fetchOpportunities.js";
import { verifyOpportunity, deduplicateOpportunities } from "../../../lib/monitor/verifyOpportunity.js";
import { runBoardReview } from "../../../lib/workflows/boardReview.js";
import { dbInsert, dbList } from "../../../lib/db/index.js";
import { postMessage } from "../../../lib/slack/client.js";
import { boardPacketBlocks } from "../../../lib/slack/messages.js";
export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const secret = req.headers["x-cron-secret"] || req.query.secret;
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) return res.status(401).json({ error: "Unauthorized" });
  if (process.env.MONITOR_ENABLED === "false") return res.status(200).json({ ok:true, message:"Monitor disabled", fetched:0,saved:0,reviewed:0,top:[] });
  const jobRecord = await dbInsert("jobs",{ type:"monitor",status:"running",started_at:new Date().toISOString() });
  try {
    const query = req.query.q || null;
    const rawOpps = await fetchOpportunities(query);
    if (!rawOpps.length) {
      await dbInsert("jobs",{...jobRecord,status:"done",result:"0 opportunities",completed_at:new Date().toISOString()});
      return res.status(200).json({ ok:true,fetched:0,saved:0,reviewed:0,top:[] });
    }
    const existing = await dbList("opportunities");
    const newOpps = deduplicateOpportunities(existing, rawOpps);
    const notifyChannel = process.env.SLACK_NOTIFY_CHANNEL;
    const autoThreshold = parseInt(process.env.AUTO_BOARD_THRESHOLD||"80",10);
    const saved = []; let reviewed = 0;
    for (const opp of newOpps.slice(0,5)) {
      const v=await verifyOpportunity(opp);
      const rec=await dbInsert("opportunities",{...opp,fit_score:v.fit_score,fit_grade:v.fit_grade,verdict:v.verdict,strengths:JSON.stringify(v.strengths||[]),weaknesses:JSON.stringify(v.weaknesses||[]),is_valid:v.is_valid,status:"found",monitor_job_id:jobRecord.id});
      saved.push(rec);
      if(notifyChannel&&v.fit_score>=55){
        await postMessage({channel:notifyChannel,text:`📋 공고 (${v.fit_score}점): ${opp.title}`,blocks:boardPacketBlocks(rec)}).catch(e=>console.error("slack:",e.message));
        if(v.fit_score>=autoThreshold){ await runBoardReview({opportunity:rec,slackChannel:notifyChannel,threadTs:null}).catch(e=>console.error("board:",e.message)); reviewed++; }
      }
    }
    await dbInsert("jobs",{...jobRecord,status:"done",result:`${saved.length} saved`,completed_at:new Date().toISOString()});
    return res.status(200).json({ ok:true,fetched:rawOpps.length,saved:saved.length,reviewed,top:saved.slice(0,5).map(o=>({id:o.id,title:o.title,fit_score:o.fit_score,deadline:o.deadline,organization:o.organization})) });
  } catch(err){ console.error("monitor:",err); await dbInsert("jobs",{...jobRecord,status:"error",result:err.message,completed_at:new Date().toISOString()}).catch(()=>{}); return res.status(500).json({ error:err.message }); }
}
