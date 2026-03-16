/**
 * Full board review workflow.
 */
import { runCTO } from "../agents/cto.js";
import { runCFO } from "../agents/cfo.js";
import { runStrategy } from "../agents/strategy.js";
import { runBizDev } from "../agents/bizdev.js";
import { runOrchestrator } from "../agents/orchestrator.js";
import { postMessage } from "../slack/client.js";
import { agentOpinionBlocks, orchestratorSummaryBlocks } from "../slack/messages.js";
import { dbInsert, dbUpdate } from "../db/index.js";
const AGENTS = [
  { key:"cto", fn:runCTO, name:"CTO (기술)", emoji:"🔬" },
  { key:"cfo", fn:runCFO, name:"CFO (재무)", emoji:"💰" },
  { key:"strategy", fn:runStrategy, name:"CSO (전략)", emoji:🎯" },
  { key:"bizdev", fn:runBizDev, name:"BizDev (사업화)", emoji:🤝" },
];
export async function runBoardReview({ opportunity, slackChannel, threadTs }) {
  const rec = await dbInsert("board_reviews",{ opportunity_id:opportunity.id, slack_channel:slackChannel, thread_ts:threadTs, status:"running" });
  const opinions={};
  for (const agent of AGENTS) {
    try {
      await postMessage({ channel:slackChannel, text:`${agent.emoji} ${agent.name} 검토중...`, thread_ts:threadTs });
      const op=await agent.fn(opportunity);
      opinions[agent.key]=op;
      await dbInsert("agent_opinions",{ board_review_id:rec.id, agent_role:agent.key, ...op });
      await postMessage({ channel:slackChannel, text:`${agent.emoji} ${agent.name}: ${op.stance}`, blocks:agentOpinionBlocks(agent.name,agent.emoji,op), thread_ts:threadTs });
    } catch(e) { opinions[agent.key]={ stance:"HOLD", summary:`오류: ${e.message}` }; }
  }
  const sum=await runOrchestrator(opportunity,opinions);
  await postMessage({ channel:slackChannel, text:`🎄; 최종 결정: ${sum.decision}`, blocks:orchestratorSummaryBlocks(sum,opportunity.id), thread_ts:threadTs });
  await dbUpdate("board_reviews",rec.id,{ status:"done", decision:sum.decision, reason:sum.reason, summary:JSON.stringify(sum) });
  return { reviewId:rec.id, decision:sum.decision, summary:sum };
}
