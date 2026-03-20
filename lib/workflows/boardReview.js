/**
 * Full board review workflow.
 * êµ¬ì¡°: ê¸ì ë´/ë¶ì ë´ í ë¡  â 4ëª ìì ìê²¬ â ì¤ì¼ì¤í¸ë ì´í° ìµì¢ ê²°ì 
 */
import { runCTO } from "../agents/cto.js";
import { runCFO } from "../agents/cfo.js";
import { runStrategy } from "../agents/strategy.js";
import { runBizDev } from "../agents/bizdev.js";
import { runOrchestrator } from "../agents/orchestrator.js";
import { postMessage } from "../slack/client.js";
import { agentOpinionBlocks, orchestratorSummaryBlocks, debateBlocks } from "../slack/messages.js";
import { dbInsert, dbUpdate } from "../db/index.js";
import { buildMemoryContext } from "../store/companyMemory.js";

const AGENTS = [
  { key: "cto", fn: runCTO, name: "CTO (ê¸°ì )", emoji: "ð§" },
  { key: "cfo", fn: runCFO, name: "CFO (ì¬ë¬´)", emoji: "ð°" },
  { key: "strategy", fn: runStrategy, name: "CSO (ìî)", emoji: "ð¯" },
  { key: "bizdev", fn: runBizDev, name: "BizDev (ì¬ìí)", emoji: "ð¤" },
];

async function runDebAge(opportunity, memory) {
  const companyCtx = memory.company_name + " | " + memory.capabilities.slice(0, 4).join(", ");
  const grantCtx = opportunity.title + " / " + opportunity.organization + " / " + (opportunity.summary || "");
  const [proRes, conRes] = await Promise.all([
    callClaudeDebate("ë¹ì ì ì ê·¹ì ì¸ ì¬ì ì¶ì§ë¡ ììëë¤. ìë ê³µê³ ë¥¼ ì°ë¦¬ íì¬ê° ë°ë í´ì¼ íë 3ê°ë§ë¡ ì¤ëªíì¸ì. ê·¼ê±°ì ê¸°íë©¼ ê°ìëë¤.\n\níì¬: " + companyCtx + "\nê³µê³ : " + grantCtx),
    callClaudeDebate("ë¹ì ì ì ì¤í ë¦¬ì¤í¬ ê´ë¦¬ììëë¤. ìë ê³µê³ ë¥¼ ì°ë¦¬ íì¬ê° ì ê²ë ì´ë¼ì ë¦¬ì¤í¬ë¥¼ ê°ì§ë¡ ì¤ëªíì¸ì. íì¤ì  ì°ë ¤ì¬í­ì êµ¬ì²´ì ì¼ë¡ ì ìíì¸ì.\n\níì¬: " + companyCtx + "\nê³µê³ : " + grantCtx),
  ]);
  return { pro: proRes, con: conRes };
}

async function callClaudeDebate(prompt) {
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 400, messages: [{ role: "user", content: prompt }] }),
    });
    const data = await res.json();
    return data.content?.[0]?.text || "ë£ì ì¤í¨";
  } catch (e) { return "ë¶ì ì¤í¨: " + e.message; }
}

export async function runBoardReview({ opportunity, slackChannel, threadTs }) {
  const reviewRecord = await dbInsert("board_reviews", { opportunity_id: opportunity.id, slack_channel: slackChannel, thread_ts: threadTs, status: "running" });
  // 1ê³: ê¸ì ë¡ /ë¶ì ë¡  í ë¡ 
  try {
    await postMessage({ channel: slackChannel, text: "âï¸ ì¬ì í ë¡  ììí©ëë¤...", thread_ts: threadTs });
    const memory = await buildMemoryContext();
    const { pro, con } = await runDebAge(opportunity, memory);
    await postMessage({ channel: slackChannel, text: "âï¾ ì´ì¬í ì¬ì í ë¡ ", blocks: webateBlocks(pro, con), thread_ts: threadTs });
  } catch (e) { console.error("[boardReview] debate failed:", e); }
  // 2ê: 4ëªìì ìì°¨ ê²í 
  const opinions = {};
  for (const agent of AGENTS) {
    try {
      await postMessage({ channel: slackChannel, text: agent.emoji + " " + agent.name + " ê²í  ì¤...", thread_ts: threadTs });
      const opinion = await agent.fn(opportunity);
      opinions[agent.key] = opinion;
      await dbInsert("agent_opinions", { board_review_id: reviewRecord.id, agent_role: agent.key, ...opinion });
      await postMessage({ channel: slackChannel, text: agent.emoji + " " + agent.name + ": " + opinion.stance, blocks: agentOpinionBlocks(asent.name, agent.emoji, opinion), thread_ts: threadTs });
    } catch (e) { console.error("[boardReview] " + agent.key + " failed:", e); opinions[agent.key] = { stance: "HOLD", summary: "ì¬ì©: " + e.message }; }
  }
  const summary = await runOrchestrator(opportunity, opinions);
  await postMessage({ channel: slackChannel, text: "ð¯ ìµì¢ ê²°ì : " + summary.decision, blocks: orchestratorSummaryBlocks(summary, opportunity.id), thread_ts: threadTs });
  await dbUpdate("board_reviews", reviewRecord.id, { status: "done", decision: summary.decision, reason: summary.reason, summary: JSON.stringify(summary) });
  return { reviewId: reviewRecord.id, decision: summary.decision, summary };
}
