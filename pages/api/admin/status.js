/**
 * Admin status API.
 * GET /api/admin/status
 */

import { dbList } from "../../../lib/db/index.js";
import { buildMemoryContext } from "../../../lib/store/companyMemory.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();

  try {
    const [
      docs, opps, reviews, drafts, jobs, caps, projects, snippets
    ] = await Promise.all([
      dbList("source_documents"),
      dbList("opportunities"),
      dbList("board_reviews"),
      dbList("proposal_drafts"),
      dbList("jobs"),
      dbList("capabilities"),
      dbList("past_projects"),
      dbList("evidence_snippets"),
    ]);

    const memory = await buildMemoryContext();

    return res.status(200).json({
      ok: true,
      anthropicConfigured: !!process.env.ANTHROPIC_API_KEY,
      slackConfigured: !!(process.env.SLACK_BOT_TOKEN && process.env.SLACK_SIGNING_SECRET),
      dbConfigured: !!process.env.DATABASE_URL,
      monitorEnabled: process.env.MONITOR_ENABLED !== "false",
      db_mode: process.env.DATABASE_URL ? "persistent" : "in-memory",
      db_warning: !process.env.DATABASE_URL
        ? "in-memory DB — 서버 재시작 시 데이터 초기화됩니다. DATABASE_URL 설정 시 영속 저장 활성화됩니다."
        : null,
      memory: {
        company_name: memory.company_name,
        document_count: docs.length,
        capability_count: caps.length,
        project_count: projects.length,
        evidence_count: snippets.length,
        keywords: memory.keywords?.slice(0, 8),
      },
      opportunities: {
        total: opps.length,
        high_fit: opps.filter(o => (o.fit_score || 0) >= 70).length,
        recent: opps
          .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""))
          .slice(0, 5)
          .map(o => ({
            id: o.id, title: o.title, fit_score: o.fit_score,
            deadline: o.deadline, status: o.status,
          })),
      },
      board_reviews: {
        total: reviews.length,
        go: reviews.filter(r => r.decision === "GO").length,
        hold: reviews.filter(r => r.decision === "HOLD").length,
        reject: reviews.filter(r => r.decision === "REJECT").length,
        recent: reviews
          .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""))
          .slice(0, 3)
          .map(r => ({ id: r.id, decision: r.decision, created_at: r.created_at })),
      },
      proposal_drafts: {
        total: drafts.length,
        recent: drafts
          .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""))
          .slice(0, 3)
          .map(d => ({ id: d.id, created_at: d.created_at })),
      },
      jobs: {
        total: jobs.length,
        recent: jobs
          .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""))
          .slice(0, 5),
      },
      lastMonitorRunAt: jobs
        .filter(j => j.type === "monitor")
        .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""))[0]?.completed_at || null,
      latestOpportunityCount: opps.length,
      documents: docs
        .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""))
        .slice(0, 10)
        .map(d => ({ id: d.id, name: d.name, status: d.status, created_at: d.created_at })),
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
