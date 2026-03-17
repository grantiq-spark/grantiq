/**
 * Slack Block Kit message builders for GRANTIQ.
 */

export function boardPacketBlocks(opportunity) {
  const {
    title, organization, deadline, budget, url,
    fit_score, summary, notice_number, source_site,
  } = opportunity;

  const scoreEmoji = fit_score >= 80 ? "🟢" : fit_score >= 60 ? "🟡" : "🔴";

  return [
    {
      type: "header",
      text: { type: "plain_text", text: "📋 GRANTIQ 이사회 패킷", emoji: true },
    },
    { type: "divider" },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${title}*\n${summary || "요약 없음"}`,
      },
    },
    {
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*기관*\n${organization || "-"}` },
        { type: "mrkdwn", text: `*마감*\n${deadline || "-"}` },
        { type: "mrkdwn", text: `*예산*\n${budget || "-"}` },
        { type: "mrkdwn", text: `*적합도*\n${scoreEmoji} ${fit_score || "?"}점` },
      ],
    },
    url && url !== "#"
      ? {
          type: "section",
          text: { type: "mrkdwn", text: `🔗 <${url}|공고 원문 보기>` },
        }
      : null,
    { type: "divider" },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "가상 이사회 심의를 시작합니다. 각 임원의 검토 의견을 아래 버튼으로 확인하세요.",
      },
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "🤖 이사회 심의 시작", emoji: true },
          style: "primary",
          action_id: "start_board_review",
          value: opportunity.id,
        },
      ],
    },
  ].filter(Boolean);
}

export function agentOpinionBlocks(agentName, agentEmoji, opinion) {
  const { stance, summary, evidence_cited, risks, recommendation } = opinion;
  const stanceEmoji = stance === "GO" ? "✅" : stance === "HOLD" ? "⚠️" : "❌";

  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `${agentEmoji} *${agentName}* ${stanceEmoji} *${stance}*\n${summary}`,
      },
    },
    evidence_cited?.length
      ? {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: `📎 근거: ${evidence_cited.join(" · ")}`,
            },
          ],
        }
      : null,
    risks?.length
      ? {
          type: "context",
          elements: [{ type: "mrkdwn", text: `⚠️ 리스크: ${risks.join(" / ")}` }],
        }
      : null,
  ].filter(Boolean);
}

export function orchestratorSummaryBlocks(summary, opportunityId) {
  const { decision, reason, missing_inputs, next_action, risks } = summary;
  const decisionEmoji =
    decision === "GO" ? "🟢 GO" : decision === "HOLD" ? "🟡 HOLD" : "🔴 REJECT";

  return [
    { type: "divider" },
    {
      type: "header",
      text: { type: "plain_text", text: "🎯 오케스트레이터 최종 결정", emoji: true },
    },
    {
      type: "section",
      text: { type: "mrkdwn", text: `*결정: ${decisionEmoji}*\n${reason}` },
    },
    risks?.length
      ? {
          type: "section",
          text: { type: "mrkdwn", text: `⚠️ *핵심 리스크*\n${risks.map(r => `• ${r}`).join("\n")}` },
        }
      : null,
    missing_inputs?.length
      ? {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `📋 *추가 필요 정보*\n${missing_inputs.map(m => `• ${m}`).join("\n")}`,
          },
        }
      : null,
    next_action
      ? {
          type: "section",
          text: { type: "mrkdwn", text: `➡️ *다음 액션*\n${next_action}` },
        }
      : null,
    decision === "GO"
      ? {
          type: "actions",
          elements: [
            {
              type: "button",
              text: { type: "plain_text", text: "✍️ 사업계획서 초안 생성", emoji: true },
              style: "primary",
              action_id: "generate_proposal",
              value: opportunityId,
            },
          ],
        }
      : null,
  ].filter(Boolean);
}

export function proposalBlocks(proposal, opportunityTitle) {
  return [
    { type: "divider" },
    {
      type: "header",
      text: { type: "plain_text", text: "📄 AI 사업계획서 초안", emoji: true },
    },
    {
      type: "section",
      text: { type: "mrkdwn", text: `*공고:* ${opportunityTitle}` },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          `*01 사업 개요*\n${proposal.overview}\n\n` +
          `*02 개발 배경*\n${proposal.background}\n\n` +
          `*03 최종 목표*\n${proposal.final_goal}`,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          `*04 연도별 목표 요약*\n${proposal.annual_goals_summary}\n\n` +
          `*05 예산 개요*\n${proposal.budget_outline}\n\n` +
          `*06 사업화 전략*\n${proposal.commercialization}`,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*07 기대 효과*\n${proposal.expected_effects}`,
      },
    },
    proposal.missing_inputs?.length
      ? {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `📋 *담당자 확인 필요 항목*\n${proposal.missing_inputs.map(m => `• ${m}`).join("\n")}`,
          },
        }
      : null,
  ].filter(Boolean);
}

export function ingestionProgressBlocks(fileName, status, detail) {
  const emoji = status === "done" ? "✅" : status === "error" ? "❌" : "⏳";
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `${emoji} *파일 분석 ${status === "done" ? "완료" : status === "error" ? "실패" : "중"}*\n\`${fileName}\`\n${detail || ""}`,
      },
    },
  ];
}
