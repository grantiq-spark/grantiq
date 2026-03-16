/**
 * Generate a proposal draft and post it to Slack.
 */
import { runWriter } from "../agents/writer.js";
import { postMessage } from "../slack/client.js";
import { proposalBlocks } from "../slack/messages.js";
import { dbInsert, dbGet, dbFind } from "../db/index.js";
export async function generateProposal({ opportunityId, slackChannel, threadTs }) {
  const opp=await dbGet("opportunities",opportunityId);
  if (!opp) throw new Error(`Opportunity ${opportunityId} not found`);
  const revs=await dbFind("board_reviews",{ opportunity_id:opportunityId });
  const rev=revs.sort((a,b)=>(b.created_at||"").localeCompare(a.created_at||""))[0];
  const bs=rev?.summary?JSON.parse(rev.summary):null;
  await postMessage({ channel:slackChannel, text:"✍️ 사업계획서 초안 중...", thread_ts:threadTs });
  const prop=await runWriter(opp,bs);
  if (!prop) { await postMessage({ channel:slackChannel, text:"⍌ 사업계획서 실패했", thread_ts:threadTs }); return null; }
  const draft=await dbInsert("proposal_drafts",{ opportunity_id:opportunityId, board_review_id:rev?.id, slack_channel:slackChannel, thread_ts:threadTs, content:JSON.stringify(prop) });
  await postMessage({ channel:slackChannel, text:`📄 AI 사업계획서 초안 완성: ${prop.project_title}`, blocks:proposalBlocks(prop,opp.title), thread_ts:threadTs });
  return { draftId:draft.id, proposal:prop };
}
