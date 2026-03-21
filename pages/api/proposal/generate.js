/**
 * Proposal Generate API
 * POST /api/proposal/generate
 * Body: { opportunity, rfpAnalysis?, duration? }
 *
 * ì¬ìê³íì ì´ì ìë ìì± â ìí íì¬ ì­ë ê¸°ë°
 */
import Anthropic from "@anthropic-ai/sdk";
import { buildMemoryContext } from "../../../lib/store/companyMemory.js";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
export const config = { maxDuration: 300 };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  try {
    const { opportunity, rfpAnalysis, duration = 3 } = req.body || {};
    if (!opportunity?.title) {
      return res.status(400).json({ error: "ê³µê³ ëª(opportunity.title) íì" });
    }

    const memory = await buildMemoryContext();

    const rfpContext = rfpAnalysis
      ? "\nRFP ë¶ì ê²°ê³¼:\n" +
        "- ëª©ì : " + (rfpAnalysis.objectives || "") + "\n" +
        "- ë²ì: " + (rfpAnalysis.scope || "") + "\n" +
        "- ìì°: " + (rfpAnalysis.budget_total || rfpAnalysis.budget_per_project || "") + "\n" +
        "- ê¸°ê°: " + (rfpAnalysis.duration || "") + "\n" +
        "- ìê²©: " + (rfpAnalysis.eligibility || "") + "\n" +
        "- íê°ê¸°ì¤: " + (rfpAnalysis.evaluation_criteria || "") + "\n" +
        "- íµì¬ìêµ¬: " + (rfpAnalysis.key_requirements || []).join(", ") + "\n" +
        "- ëììê¸: " + (rfpAnalysis.matching_fund || "")
      : "";

    const prompt =
      "ë¹ì ì íêµ­ ì ë¶ R&D ê³¼ì  ì¬ìê³íì ì ë¬¸ ìì± ìì´ì í¸ìëë¤.\n\n" +
      "íì¬ ì ë³´:\n" +
      "- íì¬ëª: " + memory.company_name + "\n" +
      "- íµì¬ê¸°ì : " + memory.capabilities.slice(0, 6).join(", ") + "\n" +
      "- í¤ìë: " + memory.keywords.slice(0, 8).join(", ") + "\n" +
      "- ì¸ì¦: " + memory.certifications.join(", ") + "\n" +
      "- ê³¼ê±°ê³¼ì : " + memory.past_projects.slice(0, 3).join(", ") + "\n\n" +
      "ê³µê³  ì ë³´:\n" +
      "- ê³µê³ ëª: " + opportunity.title + "\n" +
      "- ì£¼ê´ê¸°ê´: " + (opportunity.organization || "") + "\n" +
      "- ìì°: " + (opportunity.budget || "") + "\n" +
      "- ìì½: " + (opportunity.summary || "") + "\n" +
      rfpContext + "\n\n" +
      "ì°êµ¬ê¸°ê°: " + duration + "ë\n\n" +
      "ì ì ë³´ë¥¼ ê¸°ë°ì¼ë¡ ì¬ìê³íì ì´ìì ìë JSON íìì¼ë¡ ìì±íì¸ì.\n" +
      "íê°ê¸°ì¤ì ë§ì¶° ì ìë¥¼ ê·¹ëíí  ì ìëë¡ ì ëµì ì¼ë¡ ìì±íì¸ì.\n\n" +
      JSON.stringify(
        {
          project_title: "ê³¼ì ëª (ê³µê³  ëª©ì ì ë¶í©íë êµ¬ì²´ì  ê³¼ì ëª)",
          overview: "ê³¼ì  ê°ì 3-4ë¬¸ì¥",
          background: "ê¸°ì  ë°°ê²½ ë° íí© (ìì¥ ê·ëª¨, ê¸°ì  ëí¥)",
          necessity: "ì°êµ¬ íìì± (ê¸°ì ì  íê³, ìì¥ ìì, ì ì± ë¶í©ì±)",
          final_goal: "ìµì¢ ëª©í (ì ëì  ì§í í¬í¨)",
          annual_goals: [
            {
              year: 1,
              goal: "ëª©í",
              deliverables: ["ì°ì¶ë¬¼1"],
              milestones: ["ë§ì¼ì¤í¤1"],
            },
          ],
          technical_approach: "ê¸°ì  ì ê·¼ ë°©ë²",
          differentiation: "ì°¨ë³ì± ë° í²ìë ¥",
          budget_outline: "ìì° ê³í ê°ì",
          team_composition: "ì°êµ¬ì§ êµ¬ì± ë°©ì",
          commercialization: "ì¬ìí ì ëµ (ë§¤ì¶ ëª©í, ìì¥ ì§ì ì ëµ)",
          expected_effects: "ê¸°ëí¨ê³¼ (ê¸°ì ì , ê²½ì ì , ì¬íì )",
          risk_management: "ìíìì ë° íìë°©ì",
        },
        null,
        2
      );

    let response;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        response = await client.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 6000,
          messages: [{ role: "user", content: prompt }],
        });
        break;
      } catch (err) {
        if (err?.status === 429 && attempt < 2) {
          await sleep((attempt + 1) * 15000);
          continue;
        }
        throw err;
      }
    }

    const text = response?.content?.[0]?.text || "{}";
    let proposal = null;
    try {
      const cleaned = text.replace(/```json|```/g, "").trim();
      const m = cleaned.match(/\{[\s\S]*\}/);
      if (m) proposal = JSON.parse(m[0]);
    } catch {
      console.error("[proposal/generate] parse error");
    }

    return res.status(200).json({
      opportunity: {
        title: opportunity.title,
        organization: opportunity.organization,
      },
      proposal,
      raw_text: text.slice(0, 500),
    });
  } catch (err) {
    console.error("[proposal/generate]", err);
    if (err?.status === 429) {
      return res
        .status(429)
        .json({ error: "API ìì²­ íë ì´ê³¼", code: "RATE_LIMIT" });
    }
    return res
      .status(500)
      .json({ error: err.message || "ì¬ìê³íì ìì± ì¤ë¥" });
  }
}
