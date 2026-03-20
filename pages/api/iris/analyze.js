/**
 * IRIS RFP 분석 API
 * POST /api/iris/analyze
 * Body: { title, organization, url?, notice_number?, summary? }
 * 
 * 공고 상세 페이지를 검색하여 RFP 핵심 정보를 추출하고,
 * 움틀 회사 적합도를 분석합니다.
 */
import Anthropic from "@anthropic-ai/sdk";
import { buildMemoryContext } from "../../../lib/store/companyMemory.js";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export const config = { maxDuration: 300 };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  try {
    const { title, organization, url, notice_number, summary } = req.body || {};
    if (!title) return res.status(400).json({ error: "공고명(title) 필수" });

    const memory = await buildMemoryContext();

    const searchPrompt = `아래 정부 R&D 공고의 상세 내용을 검색하여 2가지를 수행하세요:

1. RFP(제안요청서) 핵심 정보 추출
2. 움틀 회사 적합도 분석

공고명: ${title}
주관기관: ${organization || ""}
공고번호: ${notice_number || ""}
URL: ${url || ""}
요약: ${summary || ""}

회사 정보:
- 회사명: ${memory.company_name}
- 기술: ${memory.capabilities.slice(0, 5).join(", ")}
- 키워드: ${memory.keywords.slice(0, 8).join(", ")}
- 인증: ${memory.certifications.join(", ")}
- 과거과제: ${memory.past_projects.slice(0, 3).join(", ")}

아래 JSON 형식으로만 반환:
{
  "rfp": {
    "objectives": "공고 목적",
    "scope": "지원 범위",
    "budget_total": "총 예산",
    "budget_per_project": "과제당 예산",
    "duration": "지원 기간",
    "eligibility": "지원 자격",
    "evaluation_criteria": "평가 기준",
    "required_docs": ["필요 서류"],
    "deadline": "마감일",
    "key_requirements": ["핵심 요구사항"],
    "matching_fund": "대응자금 조건",
    "contact": "문의처"
  },
  "fit_analysis": {
    "overall_score": 0-100,
    "strengths": ["강점 3가지"],
    "weaknesses": ["약점 2가지"],
    "matching_capabilities": ["일치하는 기술력"],
    "missing_requirements": ["부족한 요건"],
    "recommendation": "GO/HOLD/NO-GO",
    "reason": "판단 근거 2줄"
  }
}`;

    // Claude web_search + pause_turn loop
    let history = [{ role: "user", content: searchPrompt }];
    let lastResponse = null;

    for (let i = 0; i < 8; i++) {
      let response;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          response = await client.messages.create({
            model: "claude-sonnet-4-6",
            max_tokens: 4000,
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

    const textBlock = lastResponse?.content?.find((b) => b.type === "text");
    const text = textBlock?.text || "{}";

    let result = null;
    try {
      const cleaned = text.replace(/\`\`\`json|\`\`\`/g, "").trim();
      const m = cleaned.match(/\{[\s\S]*\}/);
      if (m) result = JSON.parse(m[0]);
    } catch {
      console.error("[iris/analyze] parse error");
    }

    return res.status(200).json({
      opportunity: { title, organization, url, notice_number },
      rfp: result?.rfp || null,
      fit_analysis: result?.fit_analysis || null,
      raw_text: text.slice(0, 500),
    });
  } catch (err) {
    console.error("[iris/analyze]", err);
    if (err?.status === 429) {
      return res.status(429).json({ error: "API 요청 한도 초과", code: "RATE_LIMIT" });
    }
    return res.status(500).json({ error: err.message || "RFP 분석 오류" });
  }
}
