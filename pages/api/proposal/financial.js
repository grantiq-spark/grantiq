/**
 * Financial Analysis API
 * POST /api/proposal/financial
 * Body: { opportunity, proposal?, duration? }
 *
 * CFO ê´ì  ì¬ê²½ë¶ì â ìì° ë°°ë¶, ROI, íê¸íë¦, ë¦¬ì¤í¬
 */
import Anthropic from "@anthropic-ai/sdk";
import { buildMemoryContext } from "../../../lib/store/companyMemory.js";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
export const config = { maxDuration: 300 };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  try {
    const { opportunity, proposal, duration = 3 } = req.body || {};
    if (!opportunity?.title) {
      return res.status(400).json({ error: "ê³µê³  ì ë³´ íì" });
    }

    const memory = await buildMemoryContext();

    const proposalCtx = proposal
      ? "\nì¬ìê³íì ì´ì:\n" +
        "- ê³¼ì ëª: " + (proposal.project_title || "") + "\n" +
        "- ê°ì: " + (proposal.overview || "").slice(0, 200) + "\n" +
        "- ìì°ê³í: " + (proposal.budget_outline || "") + "\n" +
        "- ì¬ìíì ëµ: " + (proposal.commercialization || "").slice(0, 200) + "\n" +
        "- ì°êµ¬ì§: " + (proposal.team_composition || "").slice(0, 150)
      : "";

    const prompt =
      "ë¹ì ì CFO(ì¬ë¬´ì´ì¬)ìëë¤. ìë R&D ê³¼ì  ì ìì ëí ìì¸ ì¬ê²½ë¶ìì ìííì¸ì.\n\n" +
      "íì¬: " + memory.company_name + "\n" +
      "ê¸°ì ì­ë: " + memory.capabilities.slice(0, 4).join(", ") + "\n\n" +
      "ê³µê³  ì ë³´:\n" +
      "- ê³µê³ ëª: " + opportunity.title + "\n" +
      "- ì£¼ê´ê¸°ê´: " + (opportunity.organization || "") + "\n" +
      "- ìì°: " + (opportunity.budget || "") + "\n" +
      proposalCtx + "\n\n" +
      "ì°êµ¬ê¸°ê°: " + duration + "ë\n\n" +
      "ìë JSON íìì¼ë¡ ìì¸ ì¬ê²½ë¶ì ê²°ê³¼ë¥¼ ë°ííì¸ì:\n" +
      JSON.stringify(
        {
          total_government_funding: "ì ë¶ ì§ìê¸ ì´ì¡",
          total_self_funding: "ìë¶ë´ê¸ ì´ì¡",
          matching_ratio: "ëììê¸ ë¹ì¨",
          annual_budget: [
            {
              year: 1,
              government: "ì ë¶ì§ì",
              self_fund: "ìë¶ë´",
              total: "í©ê³",
              breakdown: {
                ì¸ê±´ë¹: "",
                ì¬ë£ë¹: "",
                ìíì°êµ¬ë¹: "",
                ê°ì ë¹: "",
              },
            },
          ],
          cash_flow_analysis: {
            monthly_burn_rate: "ì ìì ê¸ì¡",
            funding_timeline: "ìê¸ ì§í ìê¸°",
            cash_reserve_needed: "íì íê¸ ë³´ì ë",
            risk_period: "ìê¸ ìí êµ¬ê°",
          },
          roi_analysis: {
            break_even_point: "ììµë¶ê¸°ì ",
            expected_revenue_3y: "3ë í ìì ë§¤ì¶",
            expected_revenue_5y: "5ë í ìì ë§¤ì¶",
            roi_percentage: "ROI %",
          },
          risk_assessment: {
            financial_risks: ["ì¬ë¬´ ë¦¬ì¤í¬"],
            mitigation: ["ëì ë°©ì"],
          },
          recommendation: "GO/HOLD/NO-GO",
          reason: "íë¨ ê·¼ê±° 3ì¤",
          key_conditions: ["ì¬ë¬´ì  ì¡°ê±´ë¶ ì¹ì¸ ì¡°ê±´"],
        },
        null,
        2
      );

    let response;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        response = await client.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 4000,
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
    let financial = null;
    try {
      const cleaned = text.replace(/```json|```/g, "").trim();
      const m = cleaned.match(/\{[\s\S]*\}/);
      if (m) financial = JSON.parse(m[0]);
    } catch {
      console.error("[proposal/financial] parse error");
    }

    return res.status(200).json({
      opportunity: { title: opportunity.title },
      financial,
      raw_text: text.slice(0, 500),
    });
  } catch (err) {
    console.error("[proposal/financial]", err);
    if (err?.status === 429) {
      return res
        .status(429)
        .json({ error: "API ìì²­ íë ì´ê³¼", code: "RATE_LIMIT" });
    }
    return res.status(500).json({ error: err.message || "ì¬ê²½ë¶ì ì¤ë¥" });
  }
}
