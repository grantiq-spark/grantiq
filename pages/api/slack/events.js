/**
 * POST /api/slack/events — TEST (slackFiles removed to isolate error)
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

export default async function handler(req, res) {
  res.status(200).json({ ok: true, test: "slackFiles removed" });
}
