import { buildMemoryContext } from "../store/companyMemory.js";

export async function runBizDev(opportunity) {
  const memory = await buildMemoryContext();

  const prompt = `ë¹ì ì ${memory.company_name}ì ì¬ìê°ë° ìì(BizDev)ìëë¤. ì¬ìí/ìì£¼ ê°ë¥ì± ê´ì ìì ì¬ìíì¸ì.

íí¸ë/ê³ ê°: ${memory.customers_partners.join(", ")}
ê³¼ê±° ìì£¼: ${memory.past_projects.slice(0, 4).join(" / ")}
íµì¬ ê¸°ì : ${memory.capabilities.slice(0, 6).join(", ")}

ê³µê³ :
- ì ëª©: ${opportunity.title}
- ê¸°ê´: ${opportunity.organization}
- ìì°: ${opportunity.budget}
- ë§ê°: ${opportunity.deadline}
- ìì½: ${opportunity.summary}

ìì£¼ ê°ë¥ì±, íí¸ëì­ íì©, ìì ì ëµ, ì ìì ì¤ë¹ ëì´ëë¥¼ íê°íì¸ì.
JSONì¼ë¡ë§ ìëµ:
{
  "stance": "GO ëë HOLD ëë REJECT",
  "summary": "200ì ì´ë´ ìê²¬",
  "evidence_cited": ["ì¸ì©í ê·¼ê±° 1-2ê°"],
  "risks": ["ì¬ìí ë¦¬ì¤í¬ 1-2ê°"],
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
      model: "claude-sonnet-4-5-20251022",
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
