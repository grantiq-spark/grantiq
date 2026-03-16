import { buildMemoryContext } from "../store/companyMemory.js";

export async function runCTO(opportunity) {
  const memory = await buildMemoryContext();

  const prompt = `당신은 ${memory.company_name}의 CTO입니다. R&D 과제 공고를 기술적 관점에서 심의하세요.

회사 핵심 기술: ${memory.capabilities.join(", ")}
관련 실적: ${memory.past_projects.slice(0, 4).join(" / ")}
인증/IP: ${memory.certifications.join(", ")}

근거 자료:
${memory.evidence_snippets.slice(0, 8).join("\n")}

공고:
- 제목: ${opportunity.title}
- 기관: ${opportunity.organization}
- 요약: ${opportunity.summary}
- 예산: ${opportunity.budget}

기술 실현가능성, 우리 역량과의 정합성, 기술 리스크를 평가하세요.
JSON으로만 응답:
{
  "stance": "GO 또는 HOLD 또는 REJECT",
  "summary": "200자 이내 의견",
  "evidence_cited": ["인용한 근거 2-3개"],
  "risks": ["기술 리스크 1-2개"],
  "recommendation": "다음 액션 제안"
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
      model: "claude-sonnet-4-5",
      max_tokens: 600,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const data = await res.json();
  const text = data.content?.[0]?.text || "{}";
  try {
    const m = text.replace(/```json|```/g, "").trim().match(/\{[\s\S]*\}/);
    return m ? JSON.parse(m[0]) : { stance: "HOLD", summary: "분석 실패" };
  } catch { return { stance: "HOLD", summary: "파싱 실패" }; }
}
