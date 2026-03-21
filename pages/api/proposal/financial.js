/**
 * Financial Analysis API
 * POST /api/proposal/financial
 * Body: { opportunity, proposal?, duration? }
 *
 * CFO financial analysis - budget allocation, ROI, cash flow, risk
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
      return res.status(400).json({ error: "opportunity.title required" });
    }

    const memory = await buildMemoryContext();

    const proposalCtx = proposal
      ? "\nProposal draft:\n" +
        "- Title: " + (proposal.project_title || "") + "\n" +
        "- Overview: " + (proposal.overview || "").slice(0, 200) + "\n" +
        "- Budget: " + (proposal.budget_outline || "") + "\n" +
        "- Commercialization: " + (proposal.commercialization || "").slice(0, 200) + "\n" +
        "- Team: " + (proposal.team_composition || "").slice(0, 150)
      : "";

    const prompt =
      "You are a CFO (Chief Financial Officer). Perform detailed financial analysis for the R&D grant proposal below. Respond in Korean.\n\n" +
      "Company: " + memory.company_name + "\n" +
      "Capabilities: " + memory.capabilities.slice(0, 4).join(", ") + "\n\n" +
      "Grant info:\n" +
      "- Name: " + opportunity.title + "\n" +
      "- Agency: " + (opportunity.organization || "") + "\n" +
      "- Budget: " + (opportunity.budget || "") + "\n" +
      proposalCtx + "\n\n" +
      "Duration: " + duration + " years\n\n" +
      "Return results as JSON with this structure:\n" +
      JSON.stringify(
        {
          total_government_funding: "total govt funding amount",
          total_self_funding: "total self-funding amount",
          matching_ratio: "matching fund ratio",
          annual_budget: [
            {
              year: 1,
              government: "govt funding",
              self_fund: "self funding",
              total: "total",
              breakdown: {
                personnel: "",
                materials: "",
                outsourcing: "",
                indirect: "",
              },
            },
          ],
          cash_flow_analysis: {
            monthly_burn_rate: "monthly expenditure",
            funding_timeline: "funding disbursement timeline",
            cash_reserve_needed: "required cash reserve",
            risk_period: "cash risk period",
          },
          roi_analysis: {
            break_even_point: "break-even point",
            expected_revenue_3y: "3-year revenue forecast",
            expected_revenue_5y: "5-year revenue forecast",
            roi_percentage: "ROI %",
          },
          risk_assessment: {
            financial_risks: ["financial risk items"],
            mitigation: ["mitigation strategies"],
          },
          recommendation: "GO/HOLD/NO-GO",
          reason: "3-line rationale",
          key_conditions: ["conditional approval terms"],
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
        .json({ error: "API rate limit exceeded", code: "RATE_LIMIT" });
    }
    return res
      .status(500)
      .json({ error: err.message || "Financial analysis error" });
  }
}
