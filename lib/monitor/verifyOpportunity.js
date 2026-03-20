/**
 * Verify an opportunity and score its fit against company memory.
 */

import { buildMemoryContext } from "../store/companyMemory.js";

export async function verifyOpportunity(opportunity) {
  const memory = await buildMemoryContext();

  const prompt = `íì¬ì ê³µê³ ì ì í©ëë¥¼ íê°íì¸ì. JSONì¼ë¡ë§ ìëµ.

íì¬:
- ì´ë¦: ${memory.company_name}
- íµì¬ ê¸°ì : ${memory.capabilities.slice(0, 8).join(", ")}
- ì£¼ì ì¤ì : ${memory.past_projects.slice(0, 3).join(" / ")}
- ì¸ì¦: ${memory.certifications.slice(0, 5).join(", ")}

ê³µê³ :
- ì ëª©: ${opportunity.title}
- ê¸°ê´: ${opportunity.organization}
- ìì°: ${opportunity.budget}
- ë§ê°: ${opportunity.deadline}
- ìì½: ${opportunity.summary}

ìëµ íì:
{
  "fit_score": 0-100,
  "fit_grade": "S/A/B/C",
  "verdict": "í ë¬¸ì¥ íê°",
  "strengths": ["ê°ì 1", "ê°ì 2"],
  "weaknesses": ["ì½ì 1", "ì½ì 2"],
  "missing_evidence": ["ë¶ì¡±í ê·¼ê±°1"],
  "is_valid": true or false,
  "validation_notes": "ì í¨ì± ë©ëª¨"
}`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5-20251022",
      max_tokens: 800,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const data = await res.json();
  const text = data.content?.[0]?.text || "{}";

  try {
    const cleaned = text.replace(/```json|```/g, "").trim();
    const m = cleaned.match(/\{[\s\S]*\}/);
    return m ? JSON.parse(m[0]) : { fit_score: 0, is_valid: false };
  } catch (e) {
    console.error("[verify] Parse error:", e);
    return { fit_score: 0, is_valid: false, validation_notes: "íì± ì¤í¨" };
  }
}

export function deduplicateOpportunities(existing, incoming) {
  const existingTitles = new Set(existing.map(o => normalizeTitle(o.title)));
  return incoming.filter(o => !existingTitles.has(normalizeTitle(o.title)));
}

function normalizeTitle(title) {
  return (title || "").replace(/\s+/g, " ").toLowerCase().trim();
}
