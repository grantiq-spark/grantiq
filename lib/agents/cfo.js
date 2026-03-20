import { buildMemoryContext } from "../store/companyMemory.js";

export async function runCFO(opportunity) {
  const memory = await buildMemoryContext();

  const prompt = `ë¹ì ì ${memory.company_name}ì CFOìëë¤. R&D ê³¼ì  ê³µê³ ë¥¼ ì¬ë¬´/ìì° ê´ì ìì ì¬ìíì¸ì.

íì¬ ì¤ì : ${memory.past_projects.slice(0, 3).join(" / ")}

ê³µê³ :
- ì ëª©: ${opportunity.title}
- ê¸°ê´: ${opportunity.organization}
- ìì°: ${opportunity.budget}
- ìì½: ${opportunity.summary}

ìì° ì ì ì±, ROI, ìí ë¹ì© ë¶ë´, íê¸íë¦ ìí¥ì íê°íì¸ì.
JSONì¼ë¡ë§ ìëµ:
{
  "stance": "GO ëë HOLD ëë REJECT",
  "summary": "200ì ì´ë´ ìê²¬",
  "evidence_cited": ["ì¸ì©í ê·¼ê±° 1-2ê°"],
  "risks": ["ì¬ë¬´ ë¦¬ì¤í¬ 1-2ê°"],
  "recommendation": "ë¤ì ì¡ì ì ì"
}`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 600,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const data = await res.json();
  const text = data.content?.[0]?.text || "{}";
  try {
    const m = text.replace(/```json|```/g, "").trim().match(/\{[\s\S]*\}/);
    return m ? JSON.parse(m[0]) : { stance: "HOLD", summary: "ë¶ì ì¤í¨" };
  } catch { return { stance: "HOLD", summary: "íì± ì¤í¨" }; }
}
