/**
 * GET /api/monitor/opportunities
 * AI가 먼저 말 걸기 — 공고 발견 시 Slack에 선제 알림 + 승률 추정
 * Auth: x-cron-secret header or ?secret= query param
 *
 * NOTE: Vercel Hobby = 1/day cron max. For frequent runs use external scheduler
 * (GitHub Actions, cron-job.org) calling this endpoint with CRON_SECRET.
 */
import { fetchOpportunities } from "../../../lib/monitor/fetchOpportunities.js";
import { verifyOpportunity, deduplicateOpportunities } from "../../../lib/monitor/verifyOpportunity.js";
import { runBoardReview } from "../../../lib/workflows/boardReview.js";
import { dbInsert, dbList } from "../../../lib/db/index.js";
import { postMessage } from "../../../lib/slack/client.js";
import { proactiveOpportunityBlocks } from "../../../lib/slack/messages.js";
import { buildMemoryContext } from "../../../lib/store/companyMemory.js";

async function estimateWinRate(opportunity) {
  try {
    const reviews = await dbList("board_reviews");
    if (!reviews.length) return null;
    const goCount = reviews.filter(r => r.decision === "GO").length;
    const base = Math.round((goCount / reviews.length) * 100);
    const fitBonus = ((opportunity.fit_score || 50) - 50) * 0.3;
    return Math.min(95, Math.max(10, Math.round(base + fitBonus)));
  } catch { return null; }
}

function extractMatchPoints(opportunity, memory) {
  if (!memory.capabilities || !memory.capabilities.length) return [];
  const summaryLower = (opportunity.summary || opportunity.title || "").toLowerCase();
  return memory.capabilities
    .filter(cap => {
      const capWords = cap.toLowerCase().split(/\s+/).filter(w => w.length > 2);
      return capWords.some(w => summaryLower.includes(w));
    })
    .slice(0, 3);
}

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  const secret = req.headers["x-cron-secret"] || req.query.secret;
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (process.env.MONITOR_ENABLED === "false") {
    return res.status(200).json({ ok: true, message: "Monitor disabled", fetched: 0, saved: 0, reviewed: 0, top: [] });
  }
  const jobRecord = await dbInsert("jobs", { type: "monitor", status: "running", started_at: new Date().toISOString() });
  try {
    const query = req.query.q || null;
    const [rawOpps, existing, memory] = await Promise.all([fetchOpportunities(query), dbList("opportunities"), buildMemoryContext()]);
    if (!rawOpps.length) {
      await dbInsert("jobs", { ...jobRecord, status: "done", result: "0 opportunities", completed_at: new Date().toISOString() });
      return res.status(200).json({ ok: true, fetched: 0, saved: 0, reviewed: 0, top: [] });
    }
    const newOpps = deduplicateOpportunities(existing, rawOpps);
    const notifyChannel = process.env.SLACK_NOTIFY_CHANNEL;
    const autoBoardThreshold = parseInt(process.env.AUTO_BOARD_THRESHOLD || "80", 10);
    const saved = []; let reviewed = 0;
    for (const opp of newOpps.slice(0, 5)) {
      const v = await verifyOpportunity(opp);
      const rec = await dbInsert("opportunities", { ...opp, fit_score: v.fit_score, fit_grade: v.fit_grade, verdict: v.verdict, strengths: JSON.stringify(v.strengths || []), weaknesses: JSON.stringify(v.weaknesses || []), is_valid: v.is_valid, status: "found", monitor_job_id: jobRecord.id });
      saved.push(rec);
      if (notifyChannel && v.fit_score >= 55) {
        const matchPoints = extractMatchPoints(rec, memory);
        const winRate = await estimateWinRate(rec);
        const msgResult = await postMessage({ channel: notifyChannel, text: "["+v.fit_score+"pt] "+opp.title+" — 검토해볼까요?", blocks: proactiveOpportunityBlocks(rec, matchPoints, winRate) }).catch(e => { console.error("[slack]",e.message); return null; });
        if (v.fit_score >= autoBoardThreshold) {
          await runBoardReview({ opportunity: rec, slackChannel: notifyChannel, threadTs: msgResult?.ts || null }).catch(e => console.error("[board]",e.message));
          reviewed++;
        }
      }
    }
    await dbInsert("jobs", { ...jobRecord, status: "done", result: saved.length+" saved", completed_at: new Date().toISOString() });
    return res.status(200).json({ ok: true, fetched: rawOpps.length, saved: saved.length, reviewed, top: saved.slice(0,5).map(o => ({ id:o.id, title:o.title, fit_score:o.fit_score, deadline:o.deadline, organization:o.organization })) });
  } catch (err) {
    await dbInsert("jobs", { ...jobRecord, status: "error", result: err.message, completed_at: new Date().toISOString() }).catch(() => {});
    return res.status(500).json({ error: err.message });
  }
}
