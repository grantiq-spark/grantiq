/**
 * Board Meeting API
 * POST /api/board-meeting
 * Body: { opportunity }
 *
 * ì´ì¬í ìë®¬ë ì´ì: ì°¬ë° í ë¡  â 4ëª ìì ê²í  â CEO ìµì¢ ìì¬ê²°ì 
 * Slack ì°ë ìì´ HTTP ìëµì¼ë¡ ì ì²´ ê²°ê³¼ ë°í
 */
import Anthropic from "@anthropic-ai/sdk";
import { buildMemoryContext } from "../../lib/store/companyMemory.js";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
export const config = { maxDuration: 300 };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const AGENTS = [
  {
    key: "cto",
    name: "CTO (ê¸°ì )",
    emoji: "\uD83E\uDDE0",
    focus:
      "ê¸°ì  ì¤íê°ë¥ì±, R&D ì­ë ë§¤ì¹­, ê¸°ì  ë¦¬ì¤í¬, í¹í/IP ì ëµ",
  },
  {
    key: "cfo",
    name: "CFO (ì¬ë¬´)",
    emoji: "\uD83D\uDCB0",
    focus:
      "ìì° ì ì ì±, ìë¶ë´ ì¬ë ¥, ROI, íê¸íë¦ ìí¥, ì¬ë¬´ ë¦¬ì¤í¬",
  },
  {
    key: "strategy",
    name: "CSO (ì ëµ)",
    emoji: "\uD83C\uDFAF",
    focus:
      "ìì¥ ì ëµ ë¶í©ì±, ê²½ì ì°ì, ì¤ì¥ê¸° ë¡ëë§µ ì í©ì±",
  },
  {
    key: "bizdev",
    name: "BizDev (ì¬ìí)",
    emoji: "\uD83E\uDD1D",
    focus:
      "ì¬ìí ê°ë¥ì±, íí¸ëì­ ê¸°í, ë§¤ì¶ ì°ê³, ìì¥ ì ê·¼ì±",
  },
];

async function callClaude(prompt, maxTokens = 800) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: maxTokens,
        messages: [{ role: "user", content: prompt }],
      });
      return res.content?.[0]?.text || "";
    } catch (err) {
      if (err?.status === 429 && attempt < 2) {
        await sleep((attempt + 1) * 10000);
        continue;
      }
      throw err;
    }
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  try {
    const { opportunity } = req.body || {};
    if (!opportunity?.title) {
      return res
        .status(400)
        .json({ error: "ê³µê³  ì ë³´(opportunity.title) íì" });
    }

    const memory = await buildMemoryContext();
    const companyCtx =
      memory.company_name +
      "\nê¸°ì : " +
      memory.capabilities.slice(0, 5).join(", ") +
      "\ní¤ìë: " +
      memory.keywords.slice(0, 8).join(", ") +
      "\nì¸ì¦: " +
      memory.certifications.join(", ");
    const grantCtx =
      "ê³µê³ ëª: " +
      opportunity.title +
      "\nì£¼ê´: " +
      (opportunity.organization || "") +
      "\nìì°: " +
      (opportunity.budget || "") +
      "\nìì½: " +
      (opportunity.summary || "");

    // Step 1: ì°¬ë° í ë¡ 
    const [proText, conText] = await Promise.all([
      callClaude(
        "ë¹ì ì ì ê·¹ì ì¸ ì¬ì ì¶ì§ë¡ ììëë¤. ìë ê³µê³ ë¥¼ íì¬ê° ë°ëì í´ì¼ íë ì´ì  3ê°ì§ë¥¼ ì¤ëªíì¸ì.\n\níì¬:\n" +
          companyCtx +
          "\n\nê³µê³ :\n" +
          grantCtx +
          "\n\n500ì ì´ë´ ìì ë§."
      ),
      callClaude(
        "ë¹ì ì ì ì¤í ë¦¬ì¤í¬ ê´ë¦¬ììëë¤. ìë ê³µê³ ì ë¦¬ì¤í¬ì ì ì¤í´ì¼ í  ì´ì  3ê°ì§ë¥¼ êµ¬ì²´ì ì¼ë¡.\n\níì¬:\n" +
          companyCtx +
          "\n\nê³µê³ :\n" +
          grantCtx +
          "\n\n500ì ì´ë´ ìì ë§."
      ),
    ]);

    // Step 2: 4ëª ìì ê²í 
    const opinions = {};
    for (const agent of AGENTS) {
      const raw = await callClaude(
        "ë¹ì ì " +
          agent.name +
          "ìëë¤. " +
          agent.focus +
          "ì ì´ì ì ë§ì¶° ê³µê³ ë¥¼ ê²í íì¸ì.\n\níì¬:\n" +
          companyCtx +
          "\n\nê³µê³ :\n" +
          grantCtx +
          "\n\nì°¬ë°:\nì°¬ì±ì¸¡: " +
          proText.slice(0, 250) +
          "\në°ëì¸¡: " +
          conText.slice(0, 250) +
          '\n\nJSONì¼ë¡ë§:\n{"stance":"GO/HOLD/NO-GO","score":0~100,"summary":"íµì¬ìê²¬ 2ì¤","risks":["ë¦¬ì¤í¬"],"opportunities":["ê¸°í"]}'
      );
      try {
        const cleaned = raw.replace(/```json|```/g, "").trim();
        const m = cleaned.match(/\{[\s\S]*\}/);
        opinions[agent.key] = m
          ? { ...JSON.parse(m[0]), name: agent.name, emoji: agent.emoji }
          : {
              stance: "HOLD",
              score: 50,
              summary: raw.slice(0, 200),
              name: agent.name,
              emoji: agent.emoji,
            };
      } catch {
        opinions[agent.key] = {
          stance: "HOLD",
          score: 50,
          summary: raw.slice(0, 200),
          name: agent.name,
          emoji: agent.emoji,
        };
      }
    }

    // Step 3: CEO ìµì¢ ê²°ì 
    const ceoPrompt =
      "ë¹ì ì CEOìëë¤. ì´ì¬í ê²í° ê²°ê³¼ë¥¼ ì¢í©íì¬ ìµì¢ ìì¬ê²°ì .\n\n" +
      "ê³µê³ : " +
      opportunity.title +
      "\n\n" +
      "ì°¬ì±ë¡ : " +
      proText.slice(0, 200) +
      "\në°ëë¡ : " +
      conText.slice(0, 200) +
      "\n\n" +
      AGENTS.map(
        (a) =>
          a.name +
          ": " +
          (opinions[a.key]?.stance || "?") +
          " (" +
          (opinions[a.key]?.score || "?") +
          "ì ) - " +
          (opinions[a.key]?.summary || "").slice(0, 100)
      ).join("\n") +
      '\n\nJSONì¼ë¡ë§:\n{"decision":"GO/HOLD/NO-GO","confidence":0~100,"reason":"íë¨ ê·¼ê±° 3ì¤","conditions":["ì¡°ê±´ë¶ ì¹ì¸ ì¡°ê±´"],"next_steps":["ë¤ì ë¨ê³"]}';

    const finalRaw = await callClaude(ceoPrompt, 1000);
    let finalDecision;
    try {
      const cleaned = finalRaw.replace(/```json|```/g, "").trim();
      const m = cleaned.match(/\{[\s\S]*\}/);
      finalDecision = m
        ? JSON.parse(m[0])
        : { decision: "HOLD", reason: finalRaw.slice(0, 300) };
    } catch {
      finalDecision = { decision: "HOLD", reason: finalRaw.slice(0, 300) };
    }

    return res.status(200).json({
      opportunity: {
        title: opportunity.title,
        organization: opportunity.organization,
      },
      debate: { pro: proText, con: conText },
      opinions,
      final_decision: finalDecision,
    });
  } catch (err) {
    console.error("[board-meeting]", err);
    if (err?.status === 429) {
      return res
        .status(429)
        .json({ error: "API ìì²­ íë ì´ê³¼", code: "RATE_LIMIT" });
    }
    return res
      .status(500)
      .json({ error: err.message || "ì´ì¬í ìë®¬ë ì´ì ì¤ë¥" });
  }
}
