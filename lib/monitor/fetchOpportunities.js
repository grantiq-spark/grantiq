/**
 * Fetch R&D opportunities using Claude web search.
 * Treats web_search as a server tool — no fabricated tool_result blocks.
 */

import { buildMemoryContext } from "../store/companyMemory.js";

export async function fetchOpportunities(customQuery) {
  const memory = await buildMemoryContext();

  const query = customQuery ||
    `${memory.company_name} 관련 정부 R&D 과제 공고 2025 2026 멤브레인 바이오 소부장 체외진단 필터`;

  const systemPrompt = `당신은 한국 R&D 과제 공고 전문 탐색 에이전트입니다.`;

  const userPrompt = `다음 쿼리로 최신 R&D 과제 공고를 검색하세요: "${query}" JSON:[{"title":"","organization":"","deadline":"","budget":"","url":"","summary":"","relevance_reason":""}]`;

  let history = [{ role: "user", content: userPrompt }];
  let lastResponse = null;

  for (let i = 0; i < 6; i++) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST", headers: { "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: "claude-sonnet-4-5", max_tokens: 2000, system: systemPrompt, tools: [{ type: "web_search_20250305", name: "web_search" }], messages: history })
    });
    const data = await res.json(); lastResponse = data;
    if (data.stop_reason !== "pause_turn") break;
    history = [...history, { role: "assistant", content: data.content }];
  }
  const text = lastResponse?.content?.find(b => b.type === "text")?.text || "[]";
  try { const c = text.replace(/```json|```/g,"").trim(); const m = c.match(/\[[\s\S]*\]/); return m?JSON.parse(m[0]):[]; } catch{return[];}
}
