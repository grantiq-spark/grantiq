/**
 * GET /api/admin/health
 * Returns env configuration booleans only — never exposes secrets.
 */
import { dbList } from "../../../lib/db/index.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();
  try {
    const opportunities = await dbList("opportunities").catch(() => []);
    const jobs = await dbList("jobs").catch(() => []);
    const lastMonitorJob = jobs
      .filter(j => j.type === "monitor" && j.status === "done")
      .sort((a, b) => (b.completed_at || b.created_at || "").localeCompare(a.completed_at || a.created_at || ""))[0];
    return res.status(200).json({
      ok: true,
      anthropicConfigured: !!(process.env.ANTHROPIC_API_KEY),
      slackConfigured: !!(process.env.SLACK_BOT_TOKEN && process.env.SLACK_SIGNING_SECRET),
      dbConfigured: !!(process.env.DATABASE_URL),
      monitorEnabled: process.env.MONITOR_ENABLED === "true",
      lastMonitorRunAt: lastMonitorJob?.completed_at || null,
      latestOpportunityCount: opportunities.length,
    });
  } catch (err) { return res.status(500).json({ error: err.message }); }
}
