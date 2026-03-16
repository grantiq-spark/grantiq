/**
 * DB abstraction layer.
 * Default: in-memory store (resets on cold start).
 */
const _store = { companies:{}, source_documents:{}, extracted_facts:{}, capabilities:{}, past_projects:{}, evidence_snippets:{}, opportunities:{}, opportunity_verifications:{}, board_reviews:{}, agent_opinions:{}, proposal_drafts:{}, slack_threads:{}, jobs:{} };
function _id() { return `${Date.now()}_${Math.random().toString(36).slice(2,8)}`; }
export async function dbInsert(t, d) { const id = d.id || _id(); const row = {...d,id,created_at:d.created_at||new Date().toISOString()}; _store[t][id]=row; return row; }
export async function dbUpdate(t, id, p) { if(!_store[t][id])throw new Error(`${t}:${id} not found`); _store[t][id]={..._store[t][id],...p,updated_at:new Date().toISOString()}; return _store[t][id]; }
export async function dbGet(t, id) { return _store[t][id]||null; }
export async function dbFind(t, f={}) { return Object.values(_store[t]).filter(r=>Object.entries(f).every([k,]=>r[k]===v)); }
export async function dbList(t) { return Object.values(_store[t]); }
export async function dbDelete(t, id) { delete _store[t][id]; }
export function _rawStore() { return _store; }
