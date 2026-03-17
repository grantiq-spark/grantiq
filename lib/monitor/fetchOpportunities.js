/**
 * Fetch R&D opportunities using Claude web search.
 * Treats web_search as a server tool — no fabricated tool_result blocks.
 */

import { buildMemoryContext } from "../store/companyMemory.js";

export async function fetchOpportunities(customQuery) {
  const memory = await buildMemoryContext();

  const query = customQuery ||
    `${memory.company_name} 관련 정부 R&D 과제 공고 2025 2026 멤브레인 바이오 소부장 체외진단 필터`;

  const systemPrompt = `당신은 한국 R&D 과제 공고 전문 탐색 에이전트입니다.
회사 정보:
- 회사: ${memory.company_name}
- 핵심 기술: ${memory.capabilities.slice(0, 5).join(", ")}
- 키워드: ${memory.keywords.slice(0, 8).join(", ")}

공고를 검색하고 JSON 배열로만 응답하세요. 다른 텍스트 없이 JSON만.`;

  const userPrompt = `다음 쿼리로 최신 R&D 과제 공고를 검색하세요: "${query}"

결과를 아래 형식의 JSON 배열로 반환:
[
  {
    "title": "공고명",
    "organization": "주관기관",
    "deadline": "마감일 (YYYY-MM-DD 또는 텍스트)",
    "budget": "예산 (예: 10억원)",
    "url": "공고 URL",
    "source_site": "출처 사이트명",
    "notice_number": "공고번호 또는 null",
    "summary": "공고 내용 2-3문장 요약",
    "relevance_reason": "이 회사와 관련된 이유 한 문장"
  }
]

실제로 찾은 공고만 포함하세요. 없으면 빈 배열 [].`;

  // Call Claude with web_search server tool
  let history = [{ role: "user", content: userPrompt }];
  let lastResponse = null;

  for (let i = 0; i < 6; i++) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 2000,
        system: systemPrompt,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        messages: history,
      }),
    });

    const data = await res.json();
    lastResponse = data;

    console.log("[monitor] stop_reason:", data.stop_reason,
      "content types:", data.content?.map(b => b.type));

    if (data.stop_reason !== "pause_turn") break;

    history = [
      ...history,
      { role: "assistant", content: data.content },
    ];
  }

  const textBlock = lastResponse?.content?.find(b => b.type === "text");
  const text = textBlock?.text || "[]";

  try {
    const cleaned = text.replace(/```json|```/g, "").trim();
    const m = cleaned.match(/\[[\s\S]*\]/);
    return m ? JSON.parse(m[0]) : [];
  } catch (e) {
    console.error("[monitor] Failed to parse opportunities JSON:", e);
    return [];
  }
}
