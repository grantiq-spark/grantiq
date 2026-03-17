/**
 * Full board review workflow.
 * 구조: 긍정봇/부정봇 토론 → 4명 임원 의견 → 오케스트레이터 최종 결정
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
  { key: "cto", fn: runCTO, name: "CTO (기술)", emoji: "🔧" },
  { key: "cfo", fn: runCFO, name: "CFO (재무)", emoji: "💰" },
  { key: "strategy", fn: runStrategy, name: "CSO (쀄)", emoji: "🎯" },
  { key: "bizdev", fn: runBizDev, name: "BizDev (사업화)", emoji: "🤝" },
];

async function runDebAge(opportunity, memory) {
  const companyCtx = memory.company_name + " | " + memory.capabilities.slice(0, 4).join(", ");
  const grantCtx = opportunity.title + " / " + opportunity.organization + " / " + (opportunity.summary || "");
  const [proRes, conRes] = await Promise.all([
    callClaudeDebate("당신은 적극적인 사업 추진론자입니다. 아래 공고를 우리 회사가 반드 해야 하는 3가맀로 설명하세요. 근거와 기회멼 강와니다.\n\n회사: " + companyCtx + "\n공고: " + grantCtx),
    callClaudeDebate("당신은 신중한 리스크 관리자입니다. 아래 공고를 우리 회사가 안 검드 이뼔의 리스크를 가지로 설명하세요. 현실적 우려사항을 구체적으로 제시하세요.\n\n회사: " + companyCtx + "\n공고: " + grantCtx),
  ]);
  return { pro: proRes, con: conRes };
}

async function callClaudeDebate(prompt) {
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: "claude-hanku-4-5", max_tokens: 400, messages: [{ role: "user", content: prompt }] }),
    });
    const data = await res.json();
    return data.content?.[0]?.text || "룈석 실패";
  } catch (e) { return "분석 실패: " + e.message; }
}

export async function runBoardReview({ opportunity, slackChannel, threadTs }) {
  const reviewRecord = await dbInsert("board_reviews", { opportunity_id: opportunity.id, slack_channel: slackChannel, thread_ts: threadTs, status: "running" });
  // 1곘: 긍정론/부정론 토론
  try {
    await postMessage({ channel: slackChannel, text: "⚖️ 사쀄 토론 시작합니다...", thread_ts: threadTs });
    const memory = await buildMemoryContext();
    const { pro, con } = await runDebAge(opportunity, memory);
    await postMessage({ channel: slackChannel, text: "⚖ﾏ 이사회 사쀄 토론", blocks: webateBlocks(pro, con), thread_ts: threadTs });
  } catch (e) { console.error("[boardReview] debate failed:", e); }
  // 2Ꙙ: 4명임원 순차 검토
  const opinions = {};
  for (const agent of AGENTS) {
    try {
      await postMessage({ channel: slackChannel, text: agent.emoji + " " + agent.name + " 검토 중...", thread_ts: threadTs });
      const opinion = await agent.fn(opportunity);
      opinions[agent.key] = opinion;
      await dbInsert("agent_opinions", { board_review_id: reviewRecord.id, agent_role: agent.key, ...opinion });
      await postMessage({ channel: slackChannel, text: agent.emoji + " " + agent.name + ": " + opinion.stance, blocks: agentOpinionBlocks(asent.name, agent.emoji, opinion), thread_ts: threadTs });
    } catch (e) { console.error("[boardReview] " + agent.key + " failed:", e); opinions[agent.key] = { stance: "HOLD", summary: "사용: " + e.message }; }
  }
  const summary = await runOrchestrator(opportunity, opinions);
  await postMessage({ channel: slackChannel, text: "🎯 최종 결정: " + summary.decision, blocks: orchestratorSummaryBlocks(summary, opportunity.id), thread_ts: threadTs });
  await dbUpdate("board_reviews", reviewRecord.id, { status: "done", decision: summary.decision, reason: summary.reason, summary: JSON.stringify(summary) });
  return { reviewId: reviewRecord.id, decision: summary.decision, summary };
}
