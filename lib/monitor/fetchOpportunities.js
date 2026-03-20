import { buildMemoryContext } from "../store/companyMemory.js";

export async function fetchOpportunities() {
  const memory = await buildMemoryContext();

  const prompt = `한국 정부 R&D 과제 공고를 검색해주세요.
회사: ${memory.company_name} (멤브레인, 분리막, 바이오공정 필터 전문)
키워드: 멤브레인, 분리막, 바이오공정, 체외진단, 소부장, 여과

2026년 현재 접수 중인 공고를 찾아서 JSON 배열로만 반환하세요:
[{"title":"공고명","organization":"기관","deadline":"마감일","budget":"예산","url":"URL","summary":"요약","relevance_reason":"관련이유"}]
없으면 [].`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1500,
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const data = await res.json();
  console.log("[fetchOpportunities] stop_reason:", data.stop_reason, "error:", data.error?.message);
  
  if (data.error) { console.error("[fetch]", data.error); return []; }

  // tool_use 후 한 번 더 호출
  if (data.stop_reason === "tool_use" || data.stop_reason === "pause_turn") {
    const res2 = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1500,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        messages: [
          { role: "user", content: prompt },
          { role: "assistant", content: data.content },
        ],
      }),
    });
    const data2 = await res2.json();
    if (data2.error) { console.error("[fetch2]", data2.error); return []; }
    const text2 = data2.content?.find(b => b.type === "text")?.text || "[]";
    try {
      const m = text2.replace(/```json|```/g,"").trim().match(/\[[\s\S]*\]/);
      return m ? JSON.parse(m[0]) : [];
    } catch { return []; }
  }

  const text = data.content?.find(b => b.type === "text")?.text || "[]";
  try {
    const m = text.replace(/```json|```/g,"").trim().match(/\[[\s\S]*\]/);
    return m ? JSON.parse(m[0]) : [];
  } catch { return []; }
}
