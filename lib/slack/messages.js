/**
 * Slack Block Kit message builders for GRANTIQ.
 */

// AI                                        (AI                                       )
export function proactiveOpportunityBlocks(opportunity, matchPoints, winRate) {
  const { id, title, organization, deadline, budget, url, fit_score, summary, verdict } = opportunity;
  const scoreEmoji = fit_score >= 80 ? "        " : fit_score >= 60 ? "        " : "        ";
  const winRateText = winRate != null ? "\n         *                         :* " + winRate + "%" : "";
  const matchText = (matchPoints && matchPoints.length > 0)
    ? "\n\n         *                                                  :*\n" + matchPoints.map(p => "       " + p).join("\n") : "";
  return [
    { type: "header", text: { type: "plain_text", text: "                                                            !", emoji: true } },
    { type: "section", text: { type: "mrkdwn", text: "*" + title + "*\n" + (summary || "") + matchText + winRateText } },
    { type: "section", fields: [{ type: "mrkdwn", text: "*            *\n" + (organization || "-") },{ type: "mrkdwn", text: "*            *\n" + (deadline || "-") },{ type: "mrkdwn", text: "*            *\n" + (budget || "-") },{ type: "mrkdwn", text: "*AI                   *\n" + scoreEmoji + " " + (fit_score || "?") + "      " }] },
    verdict ? { type: "section", text: { type: "mrkdwn", text: "         *AI             :* " + verdict } } : null,
    (url && url !== "#") ? { type: "section", text: { type: "mrkdwn", text: "         <" + url + "|                                      >" } } : null,
    { type: "divider" },
    { type: "section", text: { type: "mrkdwn", text: "                                            ?                                                                                                                  ." } },
    { type: "actions", elements: [{ type: "button", text: { type: "plain_text", text: "                                                     ", emoji: true }, style: "primary", action_id: "approve_opportunity", value: id },{ type: "button", text: { type: "plain_text", text: "                                        ", emoji: true }, action_id: "pass_opportunity", value: id }] },
  ].filter(Boolean);
}

export function boardPacketBlocks(opportunity) {
  const { title, organization, deadline, budget, url, fit_score, summary } = opportunity;
  const scoreEmoji = fit_score >= 80 ? "        " : fit_score >= 60 ? "        " : "        ";
  return [
    { type: "header", text: { type: "plain_text", text: "         GRANTIQ                                ", emoji: true } },
    { type: "divider" },
    { type: "section", text: { type: "mrkdwn", text: "*" + title + "*\n" + (summary || "                         ") } },
    { type: "section", fields: [{ type: "mrkdwn", text: "*            *\n" + (organization || "-") },{ type: "mrkdwn", text: "*            *\n" + (deadline || "-") },{ type: "mrkdwn", text: "*            *\n" + (budget || "-") },{ type: "mrkdwn", text: "*                  *\n" + scoreEmoji + " " + (fit_score || "?") + "      " }] },
    (url && url !== "#") ? { type: "section", text: { type: "mrkdwn", text: "         <" + url + "|                                    0>" } } : null,
    { type: "divider" },
    { type: "actions", elements: [{ type: "button", text: { type: "plain_text", text: "                                                     ", emoji: true }, style: "primary", action_id: "approve_opportunity", value: opportunity.id },{ type: "button", text: { type: "plain_text", text: "                     ", emoji: true }, action_id: "pass_opportunity", value: opportunity.id }] },
  ].filter(Boolean);
}

export function debateBlocks(proOpinion, conOpinion) {
  return [
    { type: "header", text: { type: "plain_text", text: "                                                         ", emoji: true } },
    { type: "section", text: { type: "mrkdwn", text: "         **                                                   ?**\n" + proOpinion } },
    { type: "divider" },
    { type: "section", text: { type: "mrkdwn", text: "         **                                                  ?**\n" + conOpinion } },
    { type: "divider" },
  ];
}

export function agentOpinionBlocks(agentName, agentEmoji, opinion) {
  const { stance, summary, evidence_cited, risks } = opinion;
  const stanceEmoji = stance === "GO" ? "      " : stance === "HOLD" ? "            " : "      ";
  return [
    { type: "section", text: { type: "mrkdwn", text: agentEmoji + " *" + agentName + "* " + stanceEmoji + " *" + stance + "*\n" + summary } },
    evidence_cited?.length ? { type: "context", elements: [{ type: "mrkdwn", text: "                     : " + evidence_cited.join("      ") }] } : null,
    risks?.length ? { type: "context", elements: [{ type: "mrkdwn", text: "                               : " + risks.join(" / ") }] } : null,
  ].filter(Boolean);
}

export function orchestratorSummaryBlocks(summary, opportunityId) {
  const { decision, reason, missing_inputs, next_action, risks } = summary;
  const decisionEmoji = decision === "GO" ? "         GO" : decision === "HOLD" ? "         HOLD" : "         REJECT";
  return [
    { type: "divider" },
    { type: "header", text: { type: "plain_text", text: "                                                                             ", emoji: true } },
    { type: "section", text: { type: "mrkdwn", text: "*            : " + decisionEmoji + "*\n" + reason } },
    risks?.length ? { type: "section", text: { type: "mrkdwn", text: "             **                               **\n" + risks.map(r => "       " + r).join("\n") } } : null,
    missing_inputs?.length ? { type: "section", text: { type: "mrkdwn", text: "         **                                       **\n" + missing_inputs.map(m => "       " + m).join("\n") } } : null,
    next_action ? { type: "section", text: { type: "mrkdwn", text: "             **                         **\n" + next_action } } : null,
    decision === "GO" ? { type: "actions", elements: [{ type: "button", text: { type: "plain_text", text: "                                                                     ", emoji: true }, style: "primary", action_id: "generate_proposal", value: opportunityId }] } : null,
  ].filter(Boolean);
}

export function proposalBlocks(proposal, opportunityTitle) {
  return [
    { type: "divider" },
    { type: "header", text: { type: "plain_text", text: "         AI                                            ", emoji: true } },
    { type: "section", text: { type: "mrkdwn", text: "*            : " + opportunityTitle } },
    { type: "section", text: { type: "mrkdwn", text: "*01                         *\n" + proposal.overview + "\n\n*02                          *\n" + proposal.background + "\n\n*03                          *\n" + proposal.final_goal } },
    { type: "section", text: { type: "mrkdwn", text: "*04                                *\n" + proposal.annual_goals_summary + "\n\n*05                          *\n" + proposal.budget_outline + "\n\n*06                                *\n" + proposal.commercialization } },
    { type: "section", text: { type: "mrkdwn", text: "*07                          *\n" + proposal.expected_effects } },
    proposal.missing_inputs?.length ? { type: "section", text: { type: "mrkdwn", text: "         **                                 *(\n" + proposal.missing_inputs.map(m => "       " + m).join("\n") } } : null,
  ].filter(Boolean);
}

export function ingestionProgressBlocks(fileName, status, detail) {
  const emoji = status === "done" ? "      " : status === "error" ? "      " : "      ";
  const label = status === "done" ? "            " : status === "error" ? "            " : "      ";
  return [{ type: "section", text: { type: "mrkdwn", text: emoji + " *                          " + label + "*\n`" + fileName + "`\n" + (detail || "") } }];
}
