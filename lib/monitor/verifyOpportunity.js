/**
 * Verify an opportunity and score its fit against company memory.
 */

import { buildMemoryContext } from "../store/companyMemory.js";

export async function verifyOpportunity(opportunity) {
  const memory = await buildMemoryContext();

  const prompt = `회사와 공고의 적합도를 평가하세요. JSON으로만 응답.

회사:
- 이름: ${memory.company_name}
- 핵심 기술: ${memory.capabilities.slice(0, 8).join(", ")}
- 주요 실적: ${memory.past_projects.slice(0, 3).join(" / ")}
- 인증: ${memory.certifications.slice(0, 5).join(", ")}

공고:
- 제목: ${opportunity.title}
- 기관: ${opportunity.organization}
- 예산: ${opportunity.budget}
- 마감: ${opportunity.deadline}
- 요약: ${opportunity.summary}

응답 형식:
{
  "fit_score": 0-100,
  "fit_grade": "S/A/B/C",
  "verdict": "한 문장 평가",
  "strengths": ["강점1", "강점2"],
  "weaknesses": ["약점1", "약점2"],
  "missing_evidence": ["부족한 근거1"],
  "is_valid": true or false,
  "validation_notes": "유효성 메모"
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
    return { fit_score: 0, is_valid: false, validation_notes: "파싱 실패" };
  }
}

export function deduplicateOpportunities(existing, incoming) {
  const existingTitles = new Set(existing.map(o => normalizeTitle(o.title)));
  return incoming.filter(o => !existingTitles.has(normalizeTitle(o.title)));
}

function normalizeTitle(title) {
  return (title || "").replace(/\s+/g, " ").toLowerCase().trim();
}
