import { buildMemoryContext } from "../store/companyMemory.js";

export async function runWriter(opportunity, boardSummary) {
  const memory = await buildMemoryContext();
  const boardNote = boardSummary ? "이사회 검토:\n" + JSON.stringify(boardSummary).slice(0,300) : "";

  const prompt = "당신은 한국 정부 R&D 과제 사업계획서 전문 작성 에이전트입니다.\n\n"
    + "회사: " + memory.company_name + "\n"
    + "기술: " + memory.capabilities.slice(0,5).join(", ") + "\n"
    + "키워드: " + memory.keywords.slice(0,6).join(", ") + "\n"
    + "인증: " + memory.certifications.join(", ") + "\n\n"
    + "공고명: " + opportunity.title + "\n"
    + "주관기관: " + (opportunity.organization||"") + "\n"
    + "예산: " + (opportunity.budget||"") + "\n"
    + "요약: " + (opportunity.summary||"") + "\n"
    + boardNote + "\n\n"
    + "위 정보로 사업계획서 초안을 아래 JSON 형식으로만 작성하세요:\n"
    + JSON.stringify({
        project_title: "과제명",
        overview: "과제 개요 2-3문장",
        background: "기술 배경 및 현황",
        final_goal: "최종 목표 (3년)",
        annual_goals: [
          {year:1, goal:"1차년도 목표", deliverables:["산출물1","산출물2"]},
          {year:2, goal:"2차년도 목표", deliverables:["산출물1","산출물2"]},
          {year:3, goal:"3차년도 목표", deliverables:["산출물1","산출물2"]}
        ],
        annual_goals_summary: "연차별 요약",
        budget_outline: "예산 계획",
        commercialization: "사업화 전략",
        expected_effects: "기대효과",
        gantt_outline: "마일스톤",
        missing_inputs: []
      }, null, 2);

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5-20251022",
      max_tokens: 4000,
      messages: [{role:"user", content: prompt}]
    })
  });

  const data = await res.json();
  console.log("[writer] stop_reason:", data.stop_reason, "error:", data.error?.message);
  if (data.error) { console.error("[writer]", data.error); return null; }

  const text = data.content?.[0]?.text || "{}";
  try {
    const cleaned = text.replace(/```json|```/g,"").trim();
    const m = cleaned.match(/\{[\s\S]*\}/);
    return m ? JSON.parse(m[0]) : null;
  } catch(e) {
    console.error("[writer] parse error:", e.message);
    return null;
  }
}
