import { buildMemoryContext } from "../store/companyMemory.js";

async function callClaude(payload, retries = 4) {
  for (let attempt = 0; attempt < retries; attempt++) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (res.status === 429) {
      const wait = Math.pow(2, attempt) * 5000;
      console.warn(`[fetchOpportunities] 429 rate limit, waiting ${wait / 1000}s (attempt ${attempt + 1}/${retries})`);
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }

    const data = await res.json();
    return data;
  }
  console.error("[fetchOpportunities] all retries exhausted due to rate limit");
  return null;
}

export async function fetchOpportunities() {
  const memory = await buildMemoryContext();

  const kwList = memory.keywords.slice(0, 5).join(", ");
  const capList = memory.capabilities.slice(0, 3).join(", ");

  const systemPrompt = `한국 R&D 과제 공고 탐색 전문 에이전트입니다.
회사: ${memory.company_name} | 기술: ${capList} | 키워드: ${kwList}

아래 사이트에서 2026년 현재 접수 중인 공고를 검색하세요:
iris.go.kr, ntis.go.kr, mss.go.kr, keit.re.kr, bioin.or.kr

JSON 배열로만 반환. 없으면 []:
[{"title":"공고명","organization":"기관","deadline":"마감일","budget":"예산","url":"URL","source_site":"출처","notice_number":"공고번호 또는 null","summary":"요약","relevance_reason":"관련이유"}]`;

  const userPrompt = `멤브레인 분리막 바이오공정 여과 소부장 체외진단 2026 공고 검색.
마감되지 않은 공고만. JSON 배열만 반환.`;

  let history = [{ role: "user", content: userPrompt }];
  let lastResponse = null;

  for (let i = 0; i < 8; i++) {
    const data = await callClaude({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2000,
      system: systemPrompt,
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      messages: history,
    });

    if (!data) return [];

    lastResponse = data;
    console.log(
      "[fetchOpportunities] turn", i,
      "stop_reason:", data.stop_reason,
      "types:", data.content?.map((b) => b.type)
    );

    if (data.error) {
      console.error("[fetchOpportunities] API error:", data.error);
      return [];
    }

    if (data.stop_reason === "end_turn") break;

    if (data.stop_reason === "tool_use" || data.stop_reason === "pause_turn") {
      history = [...history, { role: "assistant", content: data.content }];
      continue;
    }

    break;
  }

  const textBlock = lastResponse?.content?.find((b) => b.type === "text");
  const text = textBlock?.text || "[]";
  console.log("[fetchOpportunities] raw text:", text.slice(0, 300));

  try {
    const cleaned = text.replace(/```json|```/g, "").trim();

    const m = cleaned.match(/\[[\s\S]*\]/);
    if (m) {
      try {
        return JSON.parse(m[0]);
      } catch {}
    }

    const results = [];
    let depth = 0, start = -1;
    for (let i = 0; i < cleaned.length; i++) {
      if (cleaned[i] === "{") {
        if (depth === 0) start = i;
        depth++;
      } else if (cleaned[i] === "}") {
        depth--;
        if (depth === 0 && start !== -1) {
          try {
            results.push(JSON.parse(cleaned.slice(start, i + 1)));
          } catch {}
          start = -1;
        }
      }
    }
    console.log("[fetchOpportunities] fallback parsed:", results.length, "items");
    return results;

  } catch (e) {
    console.error("[fetchOpportunities] parse error:", e, "text:", text.slice(0, 200));
    return [];
  }
}
