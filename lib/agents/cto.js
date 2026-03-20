import { buildMemoryContext } from "../store/companyMemory.js";

export async function runCTO(opportunity) {
  const memory = await buildMemoryContext();

  const prompt = `ë¹ì ì ${memory.company_name}ì CTOìëë¤. R&D ê³¼ì  ê³µê³ ë¥¼ ê¸°ì ì  ê´ì ìì ì¬ìíì¸ì.

íì¬ íµì¬ ê¸°ì : ${memory.capabilities.join(", ")}
ê´ë ¨ ì¤ì : ${memory.past_projects.slice(0, 4).join(" / ")}
ì¸ì¦/IP: ${memory.certifications.join(", ")}

ê·¼ê±° ìë£:
${memory.evidence_snippets.slice(0, 8).join("\n")}

ê³µê³ :
- ì ëª©: ${opportunity.title}
- ê¸°ê´: ${opportunity.organization}
- ìì½: ${opportunity.summary}
- ìì°: ${opportunity.budget}

ê¸°ì  ì¤íê°ë¥ì±, ì°ë¦¬ ì­ëê³¼ì ì í©ì±, ê¸°ì  ë¦¬ì¤í¬ë¥¼ íê°íì¸ì.
JSONì¼ë¡ë§ ìëµ:
{
  "stance": "GO ëë HOLD ëë REJECT",
  "summary": "200ì ì´ë´ ìê²¬",
  "evidence_cited": ["ì¸ì©í ê·¼ê±° 2-3ê°"],
  "risks": ["ê¸°ì  ë¦¬ì¤í¬ 1-2ê°"],
  "recommendation": "ë¤ì ì¡ì ì ì"
}`;

  return callClaude(prompt);
}

async function callClaude(prompt) {
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
