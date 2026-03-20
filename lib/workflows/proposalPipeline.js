/**
 * 사업계획서 생성 파이프라인
 * 흐름: 공고 선택 → RFP 분석 → 기획안 초안 작성 → 재경분석 → Slack 보고
 */
import { runWriter } from "../agents/writer.js";
import { runCFO } from "../agents/cfo.js";
import { postMessage } from "../slack/client.js";
import { buildMemoryContext } from "../store/companyMemory.js";
import { dbInsert, dbUpdate, dbGet } from "../db/index.js";

/**
 * RFP 문서 분석 (Claude web_search 활용)
 */
async function analyzeRfp(opportunity) {
  const searchPrompt = `아래 정부 R&D 공고의 상세 내용을 검색하여 RFP(제안요청서) 핵심 정보를 추출하세요.

공고명: ${opportunity.title}
주관기관: ${opportunity.organization || ""}
공고번호: ${opportunity.notice_number || ""}
URL: ${opportunity.url || ""}

아래 JSON 형식으로만 반환:
{
  "objectives": "공고 목적 및 목표",
  "scope": "지원 범위 및 분야",
  "budget_total": "총 예산",
  "budget_per_project": "과제당 예산",
  "duration": "지원 기간",
  "eligibility": "지원 자격",
  "evaluation_criteria": "평가 기준",
  "required_docs": ["필요 서류 목록"],
  "deadline": "마감일",
  "key_requirements": ["핵심 요구사항"],
  "matching_fund": "대응자금 조건",
  "contact": "문의처"
}`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 3000,
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      messages: [{ role: "user", content: searchPrompt }],
    }),
  });

  // Handle pause_turn loop
  let data = await res.json();
  let history = [{ role: "user", content: searchPrompt }];

  for (let i = 0; i < 6; i++) {
    if (data.stop_reason !== "pause_turn" && data.stop_reason !== "tool_use") break;
    history = [...history, { role: "assistant", content: data.content }];
    const next = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 3000,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        messages: history,
      }),
    });
    data = await next.json();
  }

  const textBlock = data.content?.find((b) => b.type === "text");
  const text = textBlock?.text || "{}";

  try {
    const cleaned = text.replace(/\`\`\`json|\`\`\`/g, "").trim();
    const m = cleaned.match(/\{[\s\S]*\}/);
    return m ? JSON.parse(m[0]) : null;
  } catch {
    console.error("[analyzeRfp] parse error");
    return null;
  }
}

/**
 * 재경분석 실행
 */
async function runFinancialAnalysis(opportunity, proposal) {
  const prompt = `당신은 CFO(재무이사)입니다. 아래 R&D 과제 제안에 대한 재경분석을 수행하세요.

공고명: ${opportunity.title}
예산: ${opportunity.budget || "미상"}
과제명: ${proposal?.project_title || ""}
예산계획: ${proposal?.budget_outline || ""}
사업화 전략: ${proposal?.commercialization || ""}

JSON 형식으로 반환:
{
  "total_cost_estimate": "총 예상 비용",
  "government_funding": "정부 지원금",
  "self_funding": "자부담금",
  "annual_budget": [
    {"year": 1, "amount": "금액", "breakdown": "내역"},
    {"year": 2, "amount": "금액", "breakdown": "내역"},
    {"year": 3, "amount": "금액", "breakdown": "내역"}
  ],
  "roi_analysis": "ROI 분석",
  "cash_flow_impact": "현금흐름 영향",
  "risk_assessment": "재무 리스크",
  "recommendation": "GO/HOLD/NO-GO",
  "reason": "판단 근거"
}`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const data = await res.json();
  const text = data.content?.[0]?.text || "{}";

  try {
    const cleaned = text.replace(/\`\`\`json|\`\`\`/g, "").trim();
    const m = cleaned.match(/\{[\s\S]*\}/);
    return m ? JSON.parse(m[0]) : null;
  } catch {
    console.error("[financialAnalysis] parse error");
    return null;
  }
}

/**
 * 전체 파이프라인 실행
 * scan → RFP 분석 → 기획안 작성 → 재경분석 → Slack 보고
 */
export async function runProposalPipeline({ opportunity, slackChannel, threadTs }) {
  const pipelineRecord = await dbInsert("proposal_pipelines", {
    opportunity_id: opportunity.id || opportunity.title,
    slack_channel: slackChannel,
    thread_ts: threadTs,
    status: "running",
    started_at: new Date().toISOString(),
  });

  try {
    // Step 1: RFP 분석
    await postMessage({
      channel: slackChannel,
      text: "🔍 1단계: RFP 분석 중...",
      thread_ts: threadTs,
    });

    const rfpAnalysis = await analyzeRfp(opportunity);
    if (rfpAnalysis) {
      await dbInsert("rfp_analyses", {
        pipeline_id: pipelineRecord.id,
        ...rfpAnalysis,
      });
      await postMessage({
        channel: slackChannel,
        text: "✅ RFP 분석 완료\n"
          + "• 목적: " + (rfpAnalysis.objectives || "").slice(0, 100) + "\n"
          + "• 예산: " + (rfpAnalysis.budget_total || rfpAnalysis.budget_per_project || "미상") + "\n"
          + "• 마감: " + (rfpAnalysis.deadline || "미상"),
        thread_ts: threadTs,
      });
    }

    // Step 2: 기획안 초안 작성
    await postMessage({
      channel: slackChannel,
      text: "✍️ 2단계: 사업계획서 초안 작성 중...",
      thread_ts: threadTs,
    });

    const proposal = await runWriter(opportunity, rfpAnalysis);
    if (proposal) {
      await dbInsert("proposals", {
        pipeline_id: pipelineRecord.id,
        opportunity_title: opportunity.title,
        ...proposal,
      });
      await postMessage({
        channel: slackChannel,
        text: "✅ 기획안 초안 완료\n"
          + "• 과제명: " + (proposal.project_title || "") + "\n"
          + "• 최종목표: " + (proposal.final_goal || "").slice(0, 100),
        thread_ts: threadTs,
      });
    }

    // Step 3: 재경분석
    await postMessage({
      channel: slackChannel,
      text: "💰 3단계: 재경분석 중...",
      thread_ts: threadTs,
    });

    const financial = await runFinancialAnalysis(opportunity, proposal);
    if (financial) {
      await dbInsert("financial_analyses", {
        pipeline_id: pipelineRecord.id,
        ...financial,
      });
      await postMessage({
        channel: slackChannel,
        text: "✅ 재경분석 완료\n"
          + "• 총 비용: " + (financial.total_cost_estimate || "") + "\n"
          + "• ROI: " + (financial.roi_analysis || "").slice(0, 100) + "\n"
          + "• 판정: " + (financial.recommendation || ""),
        thread_ts: threadTs,
      });
    }

    // Step 4: 최종 보고
    const summary = {
      opportunity: opportunity.title,
      rfp: rfpAnalysis ? "분석완료" : "분석실패",
      proposal: proposal?.project_title || "작성실패",
      financial: financial?.recommendation || "분석실패",
      financial_reason: financial?.reason || "",
    };

    await postMessage({
      channel: slackChannel,
      text: "📋 파이프라인 완료 보고\n"
        + "════════════════════\n"
        + "공고: " + summary.opportunity + "\n"
        + "RFP 분석: " + summary.rfp + "\n"
        + "기획안: " + summary.proposal + "\n"
        + "재무판정: " + summary.financial + "\n"
        + "판단근거: " + summary.financial_reason,
      thread_ts: threadTs,
    });

    await dbUpdate("proposal_pipelines", pipelineRecord.id, {
      status: "done",
      completed_at: new Date().toISOString(),
      result: JSON.stringify(summary),
    });

    return { pipelineId: pipelineRecord.id, summary, proposal, financial, rfpAnalysis };
  } catch (err) {
    console.error("[proposalPipeline]", err);
    await dbUpdate("proposal_pipelines", pipelineRecord.id, {
      status: "error",
      error: err.message,
    });
    await postMessage({
      channel: slackChannel,
      text: "❌ 파이프라인 오류: " + err.message,
      thread_ts: threadTs,
    }).catch(() => {});
    throw err;
  }
}
