/**
 * Full board review workflow.
 * Posts 4 agent opinions + orchestrator summary to a Slack thread.
 */

import { runCTO } from "../agents/cto.js";
import { runCFO } from "../agents/cfo.js";
import { runStrategy } from "../agents/strategy.js";
import { runBizDev } from "../agents/bizdev.js";
import { runOrchestrator } from "../agents/orchestrator.js";
import { postMessage } from "../slack/client.js";
import {
  agentOpinionBlocks,
  orchestratorSummaryBlocks,
} from "../slack/messages.js";
import { dbInsert, dbUpdate } from "../db/index.js";

const AGENTS = [
  { key: "cto",      fn: runCTO,      name: "CTO (기술)",         emoji: "🔬" },
  { key: "cfo",      fn: runCFO,      name: "CFO (재무)",         emoji: "💰" },
  { key: "strategy", fn: runStrategy, name: "CSO (전략)",         emoji: "🎯" },
  { key: "bizdev",   fn: runBizDev,   name: "BizDev (사업화)",    emoji: "🤝" },
];

export async function runBoardReview({ opportunity, slackChannel, threadTs }) {
  // Create board review record
  const reviewRecord = await dbInsert("board_reviews", {
    opportunity_id: opportunity.id,
    slack_channel: slackChannel,
    thread_ts: threadTs,
    status: "running",
  });

  const opinions = {};

  // Run agents sequentially, post each to Slack thread
  for (const agent of AGENTS) {
    try {
      await postMessage({
        channel: slackChannel,
        text: `${agent.emoji} ${agent.name} 검토 중...`,
        thread_ts: threadTs,
      });

      const opinion = await agent.fn(opportunity);
      opinions[agent.key] = opinion;

      await dbInsert("agent_opinions", {
        board_review_id: reviewRecord.id,
        agent_role: agent.key,
        ...opinion,
      });

      await postMessage({
        channel: slackChannel,
        text: `${agent.emoji} ${agent.name}: ${opinion.stance}`,
        blocks: agentOpinionBlocks(agent.name, agent.emoji, opinion),
        thread_ts: threadTs,
      });
    } catch (e) {
      console.error(`[boardReview] ${agent.key} failed:`, e);
      opinions[agent.key] = { stance: "HOLD", summary: `오류: ${e.message}` };
    }
  }

  // Orchestrator summary
  const summary = await runOrchestrator(opportunity, opinions);

  await postMessage({
    channel: slackChannel,
    text: `🎯 최종 결정: ${summary.decision}`,
    blocks: orchestratorSummaryBlocks(summary, opportunity.id),
    thread_ts: threadTs,
  });

  await dbUpdate("board_reviews", reviewRecord.id, {
    status: "done",
    decision: summary.decision,
    reason: summary.reason,
    summary: JSON.stringify(summary),
  });

  return { reviewId: reviewRecord.id, decision: summary.decision, summary };
}
