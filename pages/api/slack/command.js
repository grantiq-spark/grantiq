/**
 * POST /api/slack/command
 * Handles Slack slash commands: /grantiq
 */
import { verifySlackSignature } from "../../../lib/slack/verify.js";
import { postMessage } from "../../../lib/slack/client.js";
import { fetchOpportunities } from "../../../lib/monitor/fetchOpportunities.js";
import { verifyOpportunity } from "../../../lib/monitor/verifyOpportunity.js";
import { runBoardReview } from "../../../lib/workflows/boardReview.js";
import { buildMemoryContext } from "../../../lib/store/companyMemory.js";
import { dbInsert, dbList } from "../../../lib/db/index.js";
import { boardPacketBlocks } from "../../../lib/slack/messages.js";

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
  const rawBody = await readRawBody(req);
  const isValid = await verifySlackSignature(req, rawBody);
  if (!isValid) return res.status(401).json({ error: "Invalid signature" });

  const params = new URLSearchParams(rawBody.toString());
  const text = (params.get("text") || "").toLowerCase().trim();
  const channel_id = params.get("channel_id");
  const user_id = params.get("user_id");

  // Ack immediately
  res.status(200).json({ response_type: "in_channel", text: "Processing..." });

  try {
    if (text === "status" || text === "") {
      const opps = (await dbList("opportunities")) || [];
      const reviews = (await dbList("board_reviews")) || [];
      const dbNote = process.env.DATABASE_URL ? "" : " [in-memory DB]";
      await postMessage({ channel: channel_id, text: `GRANTIQ Status:\n- Opportunities: ${opps.length}\n- Reviews: ${reviews.length}\n- Server: OK${dbNote}` });
    } else if (text.includes("scan") || text.includes("opportunit")) {
      await postMessage({ channel: channel_id, text: "Scanning for opportunities..." });
      const memory = await buildMemoryContext();
      const opps = await fetchOpportunities(memory);
      if (!opps.length) { await postMessage({ channel: channel_id, text: "No opportunities found." }); return; }
      let posted = 0;
      for (const opp of opps.slice(0, 5)) {
        const v = await verifyOpportunity(opp);
        const rec = await dbInsert("opportunities", { ...opp, fit_score: v.fit_score, fit_grade: v.fit_grade, verdict: v.verdict, status: "found" });
        if (v.fit_score >= 55) {
          await postMessage({ channel: channel_id, text: `Found (${v.fit_score}pts): ${opp.title}`, blocks: boardPacketBlocks(rec) });
          posted++;
        }
      }
      await postMessage({ channel: channel_id, text: `Scan complete: ${opps.length} found, ${posted} high-fit` });
    } else if (text.includes("review")) {
      await postMessage({ channel: channel_id, text: "Running board review..." });
      const opps = await dbList("opportunities");
      if (!opps?.length) { await postMessage({ channel: channel_id, text: "No opportunities. Run /grantiq scan first." }); return; }
      const result = await runBoardReview(opps[0]);
      await postMessage({ channel: channel_id, text: "Board review: " + result.summary });
    } else {
      await postMessage({ channel: channel_id, text: "Commands: /grantiq scan | /grantiq review | /grantiq status" });
    }
  } catch (err) {
    await postMessage({ channel: channel_id, text: "Error: " + err.message }).catch(() => {});
  }
}
