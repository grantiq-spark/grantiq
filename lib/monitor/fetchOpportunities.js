import { buildMemoryContext } from "../store/companyMemory.js";

export async function fetchOpportunities(customQuery) {
  const memory = await buildMemoryContext();
  
  const kwList = memory.keywords.slice(0, 6).join(", ");
  const capList = memory.capabilities.slice(0, 4).join(", ");
  
  const systemPrompt = `당신은 한국 R&D 과제 공고 탐색 전문 에이전트입니다.
회사명: ${memory.company_name}
핵심 기술: ${capList}
키워드: ${kwList}

다음 사이트에서 최신 공고를 찾으세요:
- NTIS (ntis.go.kr)
- 범부처통합연구지원시스템 (iris.go.kr)  
- 중소벤처기업부 (mss.go.kr)
- KEIT (keit.re.kr)
- 생명공학정책연구센터 (bioin.or.kr)
- K-BIO (k-bio.org)
- 연구과제 정보시스템 검색

JSON 배열 형식으로만 응답. 다른 텍스트 없이 순수 JSON.`;

  const userPrompt = `2026년 현재 공고 중인 R&D 과제를 검색하세요.
검색어: "${memory.company_name} 멤브레인 분리막 바이오공정 여과 소부장 체외진단 2026 공고"

결과를 JSON 배열로 반환:
[
  {
    "title": "공고명",
    "organization": "주관기관 (예: 산업부, KEIT, 중기부)",
    "deadline": "마감일",
    "budget": "지원금액",
    "url": "공고 URL",
    "source_site": "출처",
    "notice_number": "공고번호 또는 null",
    "summary": "공고 내용 요약 2문장",
    "relevance_reason": "${memory.company_name}과 관련된 이유"
  }
]

실제 검색으로 찾은 공고만 포함. 없으면 []. 반드시 마감되지 않은 공고만.`;

  let history = [{ role: "user", content: userPrompt }];
  let lastResponse = null;

  for (let i = 0; i < 8; i++) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "interleaved-thinking-2025-05-14",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5-20251022",
        max_tokens: 4000,
        system: systemPrompt,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        messages: history,
      }),
    });

    const data = await res.json();
    lastResponse = data;
    console.log("[fetchOpportunities] turn", i, "stop_reason:", data.stop_reason, "types:", data.content?.map(b => b.type));

    if (data.error) {
      console.error("[fetchOpportunities] API error:", data.error);
      return [];
    }

    if (data.stop_reason === "end_turn") break;

    if (data.stop_reason === "tool_use" || data.stop_reason === "pause_turn") {
      // tool_result 없이 assistant 메시지만 추가하면 서버 툴은 자동 처리됨
      history = [
        ...history,
        { role: "assistant", content: data.content },
      ];
      continue;
    }

    break;
  }

  const textBlock = lastResponse?.content?.find(b => b.type === "text");
  const text = textBlock?.text || "[]";
  console.log("[fetchOpportunities] raw text:", text.slice(0, 300));

  try {
    const cleaned = text.replace(/```json|```/g, "").trim();
    const m = cleaned.match(/\[[\s\S]*\]/);
    return m ? JSON.parse(m[0]) : [];
  } catch (e) {
    console.error("[fetchOpportunities] parse error:", e, "text:", text.slice(0, 200));
    return [];
  }
}
