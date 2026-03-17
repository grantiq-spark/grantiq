/**
 * Slack Block Kit message builders for GRANTIQ.
 */

export function boardPacketBlocks(opportunity) {
  const {
    title, organization, deadline, budget, url, fit_score, summary,
  } = opportunity;
  const scoreEmoji = fit_score >= 80 ? "🟢" : fit_score >= 60 ? "🟡" : "🔴";
  return [
    { type: "header", text: { type: "plain_text", text: "📋 GRANTIQ", emoji: true } },
    { type: "divider" },
    { type: "section", text: { type: "mrkdwn", text: `*${title}*\n${summary || ""}` } },
    { type: "section", fields: [
      { type: "mrkdwn", text: `*기관*\n${organization || "-"}` },
      { type: "mrkdwn", text: `*마감*\n${deadline || "-"}` },
      { type: "mrkdwn", text: `*예산*\n${budget || "-"}` },
      { type: "mrkdwn", text: `*적합도*\n${scoreEmoji} ${fit_score || "?"}` },
    ] },
    url && url !== "#" ? { type: "section", text: { type: "mrkdwn", text: `🔗 <${url}|공고>` } } : null,
    { type: "divider" },
    { type: "actions", elements: [{ type: "button", text: { type: "plain_text", text: "이사회 심의", emoji: true }, style: "primary", action_id: "start_board_review", value: opportunity.id }] },
  ].filter(Boolean);
}
export function agentOpinionBlocks(an, ae, op) {
  const se = op.stance === "GO" ? "✅" : op.stance === "HOLD" ? "⚠️" : "❌";
  return [{ type: "section", text: { type: "mrkdwn", text: `${ae} *${an}* ${se} *${op.stance}*\n${op.summary}` } }].filter(Boolean);
}
export function orchestratorSummaryBlocks(s, oId) {
  const de = s.decision === "GO" ? "🟢 GO" : s.decision === "HOLD" ? "🟡 HOLD" : "🔴 REJECT";
  return [
    { type: "divider" },
    { type: "header", text: { type: "plain_text", text: "이사회 최종 결정", emoji: true } },
    { type: "section", text: { type: "mrkdwn", text: `*결정: ${de}*\n${s.reason}` } },
    s.decision === "GO" ? { type: "actions", elements: [{ type: "button", text: { type: "plain_text", text: "사업계획서 초안", emoji: true }, style: "primary", action_id: "generate_proposal", value: oId }] } : null,
  ].filter(Boolean);
}
export function proposalBlocks(p, t) {
  return [{ type: "divider" }, { type: "header", text: { type: "plain_text", text: "AI 사업계획서 초안", emoji: true } }, { type: "section", text: { type: "mrkdwn", text: `*{t}\n**${p.project_title}**\n${p.overview}` } }].filter(Boolean);
}
export function ingestionProgressBlocks(f, st, dt) {
  const e = st === "done" ? "�B�H : st === "error" ? "❌" : "⏳";
  return [{ type: "section", text: { type: "mrkdwn", text: `${e} *${st}*\n \`${f}\`\n${dt || ""}` } }];
}
