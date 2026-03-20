/**
 * IRIS 공고 검색 API
 * POST /api/iris/search
 * Body: { query?: string, keywords?: string[] }
 * 
 * Claude web_search를 활용하여 iris.go.kr, ntis.go.kr 등에서
 * 움틀 관련 R&D 공고를 검색합니다.
 */
import Anthropic from "@anthropic-ai/sdk";
import { buildMemoryContext } from "../../../lib/store/companyMemory.js";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export const config = { maxDuration: 300 };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  try {
    const { query, keywords, source } = req.body || {};
    const memory = await buildMemoryContext();
    const kwList = keywords?.join(", ") || memory.keywords.slice(0, 6).join(", ");

    // 검색 대상 사이트 설정
    const sites = source === "iris" 
      ? "iris.go.kr" 
      : source === "ntis" 
      ? "ntis.go.kr" 
      : "iris.go.kr, ntis.go.kr, keit.re.kr, mss.go.kr, bioin.or.kr";

    const systemPrompt = `한국 R&D 과제 공고 탐색 전문 에이전트입니다.
회사: ${memory.company_name}
기술: ${memory.capabilities.slice(0, 4).join(", ")}
키워드: ${kwList}

아래 사이트에서 2026년 현재 접수 중인 공고를 검색하세요:
${sites}

결과를 JSON 배열로만 반환하세요. 없으면 []:
[{
  "title": "공고명",
  "organization": "기관명",
  "deadline": "마감일",
  "budget": "예산",
  "url": "URL",
  "source_site": "출처 사이트",
  "notice_number": "공고번호",
  "summary": "요약 2줄",
  "relevance_score": 0-100,
  "relevance_reason": "관련 이유"
}]`;

    const userQuery = query || `${kwList} 2026 R&D 공고 검색. 마감되지 않은 공고만. JSON 배열만 반환.`;

    let history = [{ role: "user", content: userQuery }];
    let lastResponse = null;

    for (let i = 0; i < 8; i++) {
      let response;
      // Retry on rate limit
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          response = await client.messages.create({
            model: "claude-sonnet-4-6",
            max_tokens: 3000,
            system: systemPrompt,
            tools: [{ type: "web_search_20250305", name: "web_search" }],
            messages: history,
          });
          break;
        } catch (err) {
          if (err?.status === 429 && attempt < 2) {
            await sleep((attempt + 1) * 15000);
            continue;
          }
          throw err;
        }
      }

      lastResponse = response;
      if (response.stop_reason === "end_turn") break;

      if (response.stop_reason === "pause_turn" || response.stop_reason === "tool_use") {
        history = [...history, { role: "assistant", content: response.content }];
        continue;
      }
      break;
    }

    // 텍스트 블록에서 JSON 추출
    const textBlock = lastResponse?.content?.find((b) => b.type === "text");
    const text = textBlock?.text || "[]";

    let results = [];
    try {
      const cleaned = text.replace(/\`\`\`json|\`\`\`/g, "").trim();
      const m = cleaned.match(/\[[\s\S]*\]/);
      if (m) {
        results = JSON.parse(m[0]);
      }
    } catch {
      // Fallback: 개별 JSON 객체 추출
      let depth = 0, start = -1;
      const cleaned = text.replace(/\`\`\`json|\`\`\`/g, "").trim();
      for (let i = 0; i < cleaned.length; i++) {
        if (cleaned[i] === "{") { if (depth === 0) start = i; depth++; }
        else if (cleaned[i] === "}") {
          depth--;
          if (depth === 0 && start !== -1) {
            try { results.push(JSON.parse(cleaned.slice(start, i + 1))); } catch {}
            start = -1;
          }
        }
      }
    }

    // 관련도 점수 기준 정렬
    results.sort((a, b) => (b.relevance_score || 0) - (a.relevance_score || 0));

    return res.status(200).json({
      count: results.length,
      query: userQuery,
      source: sites,
      results,
    });
  } catch (err) {
    console.error("[iris/search]", err);
    if (err?.status === 429) {
      return res.status(429).json({ error: "API 요청 한도 초과", code: "RATE_LIMIT" });
    }
    return res.status(500).json({ error: err.message || "IRIS 검색 오류" });
  }
}
