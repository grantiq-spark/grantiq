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

export const config = { api: { bodyParser: false }, maxDuration: 60 };

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

  const body = JSON.parse(rawBody.toString());

  // Slack URL verification challenge
  if (body.type === "url_verification") {
    return res.status(200).json({ challenge: body.challenge });
  }

  // Ack immediately
  res.status(200).end();

  const event = body.event || {};
  const { type, channel: channel_id, text, ts, thread_ts, user, file } = event;

  // --- file_shared: ingest company document ---
  if (type === "file_shared") {
    const file_id = file?.id || event.file_id;
    if (!file_id) return;
    try {
      await postMessage({ channel: channel_id, text: "Ingesting file...", blocks: ingestionProgressBlocks("file","loading","Reading...") });
      const { ingestSlackFile } = await import("../../../lib/ingest/slackFiles.js");
      const result = await ingestSlackFile(file_id);
      const caps = (result.extracted && result.extracted.capabilities && result.extracted.capabilities.length) || 0;
      const projs = (result.extracted && result.extracted.past_projects && result.extracted.past_projects.length) || 0;
      const snippets = (result.extracted && result.extracted.evidence_snippets && result.extracted.evidence_snippets.length) || 0;
      await postMessage({ channel: channel_id, text: "Done: " + result.name + ", caps:" + caps + ", projs:" + projs + ", evidence:" + snippets, blocks: ingestionProgressBlocks(result.name, "done", result.text_length + " chars") });
      await addReaction(channel_id, event.event_ts, "white_check_mark").catch(() => {});
    } catch (err) {
      console.error("[file_shared]", err);
      await postMessage({ channel: channel_id, text: "Failed: " + err.message, blocks: ingestionProgressBlocks("file", "error", err.message) });
      await addReaction(channel_id, event.event_ts, "x").catch(() => {});
    }
    return;
  }

  // --- app_mention: command routing ---
  if (type === "app_mention" && text) {
    const lower = text.toLowerCase();
    const ts_reply = thread_ts || ts;

    // "scan" or "opportunities": fetch + verify + post
    if (lower.includes("scan") || lower.includes("opportunit")) {
      try {
        await postMessage({ channel: channel_id, thread_ts: ts_reply, text: "Scanning opportunities..." });
        const memory = await buildMemoryContext();
        const opps = await fetchOpportunities(memory);
        if (!opps.length) {
          await postMessage({ channel: channel_id, thread_ts: ts_reply, text: "No results." });
          return;
        }
        let posted = 0;
        for (const opp of opps.slice(0, 5)) {
          const v = await verifyOpportunity(opp);
          const rec = await dbInsert("opportunities", { ...opp, fit_score: v.fit_score, fit_grade: v.fit_grade, verdict: v.verdict, status: "found" });
          if (v.fit_score >= 55) {
            await postMessage({ channel: channel_id, thread_ts: ts_reply, text: "Found (" + v.fit_score + "pts): " + opp.title, blocks: boardPacketBlocks(rec) });
            posted++;
          }
        }
        await postMessage({ channel: channel_id, thread_ts: ts_reply, text: "Scan done: " + opps.length + " found, " + posted + " posted" });
      } catch (err) {
        await postMessage({ channel: channel_id, thread_ts: ts_reply, text: "Error: " + err.message }).catch(() => {});
      }
      return;
    }

    // "review": board review on latest opportunity
    if (lower.includes("review")) {
      try {
        await postMessage({ channel: channel_id, thread_ts: ts_reply, text: "Running board review..." });
        const opps = await dbList("opportunities");
        const latest = opps && opps[0];
        if (!latest) {
          await postMessage({ channel: channel_id, thread_ts: ts_reply, text: "No opportunities found. Run scan first." });
          return;
        }
        const result = await runBoardReview(latest);
        await postMessage({ channel: channel_id, thread_ts: ts_reply, text: "Board review done: " + result.summary });
      } catch (err) {
        await postMessage({ channel: channel_id, thread_ts: ts_reply, text: "Error: " + err.message }).catch(() => {});
      }
      return;
    }

    // "draft" or "proposal": generate proposal draft
    if (lower.includes("draft") || lower.includes("proposal")) {
      try {
        await postMessage({ channel: channel_id, thread_ts: ts_reply, text: "Generating proposal draft..." });
        const opps = await dbList("opportunities");
        const latest = opps && opps[0];
        if (!latest) {
          await postMessage({ channel: channel_id, thread_ts: ts_reply, text: "No opportunities found. Run scan first." });
          return;
        }
        const draft = await generateProposal(latest);
        await postMessage({ channel: channel_id, thread_ts: ts_reply, text: "Draft ready: " + draft.title + "\n" + draft.summary });
      } catch (err) {
        await postMessage({ channel: channel_id, thread_ts: ts_reply, text: "Error: " + err.message }).catch(() => {});
      }
      return;
    }

    // "status": show current DB state
    if (lower.includes("status")) {
      try {
        const opps = (await dbList("opportunities")) || [];
        const reviews = (await dbList("board_reviews")) || [];
        const drafts = (await dbList("proposals")) || [];
        const dbNote = process.env.DATABASE_URL ? "" : " [WARNING: in-memory DB]";
        await postMessage({ channel: channel_id, thread_ts: ts_reply, text: "Status: opps:" + opps.length + " reviews:" + reviews.length + " drafts:" + drafts.length + dbNote });
      } catch (err) {
        await postMessage({ channel: channel_id, thread_ts: ts_reply, text: "Error: " + err.message }).catch(() => {});
      }
      return;
    }

    // Default: help message
    await postMessage({ channel: channel_id, thread_ts: ts_reply, text: "Commands: scan | review | draft | status" });
  }
}
