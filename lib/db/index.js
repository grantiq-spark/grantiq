/**
 * DB abstraction layer.
 * Default: in-memory store (resets on cold start).
 * Production: set DATABASE_URL to enable Postgres via pg.
 *
 * Schema tables:
 *   companies, source_documents, extracted_facts, capabilities,
 *   past_projects, evidence_snippets, opportunities,
 *   opportunity_verifications, board_reviews, agent_opinions,
 *   proposal_drafts, slack_threads, jobs
 */

// Simple in-memory store — works on Vercel with no extra setup.
// For persistence, swap this for Supabase/Neon/Postgres client.
const _store = {
  companies: {},
  source_documents: {},
  extracted_facts: {},
  capabilities: {},
  past_projects: {},
  evidence_snippets: {},
  opportunities: {},
  opportunity_verifications: {},
  board_reviews: {},
  agent_opinions: {},
  proposal_drafts: {},
  slack_threads: {},
  jobs: {},
};

function _id() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function dbInsert(table, data) {
  const id = data.id || _id();
  const row = { ...data, id, created_at: data.created_at || new Date().toISOString() };
  _store[table][id] = row;
  return row;
}

export async function dbUpdate(table, id, patch) {
  if (!_store[table][id]) throw new Error(`${table}:${id} not found`);
  _store[table][id] = { ..._store[table][id], ...patch, updated_at: new Date().toISOString() };
  return _store[table][id];
}

export async function dbGet(table, id) {
  return _store[table][id] || null;
}

export async function dbFind(table, filter = {}) {
  const rows = Object.values(_store[table]);
  return rows.filter(row =>
    Object.entries(filter).every(([k, v]) => row[k] === v)
  );
}

export async function dbList(table) {
  return Object.values(_store[table]);
}

export async function dbDelete(table, id) {
  delete _store[table][id];
}

// Export raw store for debugging
export function _rawStore() { return _store; }
