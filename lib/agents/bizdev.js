import { buildMemoryContext } from "../store/companyMemory.js";

export async function runBizDev(opportunity) {
  const memory = await buildMemoryContext();

  const prompt = `당신은 ${memory.company_name}의 사업개발 임원(BizDev)입니다. 사업화/수주 가능성 관점에서 심의하세요.

파트너/고객: ${memory.customers_partners.join(", ")}
과거 수주: ${memory.past_projects.slice(0, 4).join(" / ")}
핵심 기술: ${memory.capabilities.slice(0, 6).join(", ")}

공고:
- 제목: ${opportunity.title}
- 기관: ${opportunity.organization}
- 예산: ${opportunity.budget}
- 마감: ${opportunity.deadline}
- 요약: ${opportunity.summary}

수주 가능성, 파트너십 활용, 영업 전략, 제안서 준비 난이도를 평가하세요.
JSON으로만 응답:
{
  "stance": "GO 또는 HOLD 또는 REJECT",
  "summary": "200자 이내 의견",
  "evidence_cited": ["인용한 근거 1-2개"],
  "risks": ["사업화 리스크 1-2개"],
  "recommendation": "다음 액션 제안"
}`;

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
