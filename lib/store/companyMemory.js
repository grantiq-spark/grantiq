/**
 * Company memory store.
 * Wraps the DB layer with domain-specific logic.
 */

import { dbInsert, dbUpdate, dbGet, dbFind, dbList } from "../db/index.js";

const DEFAULT_COMPANY_ID = process.env.COMPANY_ID || "default";

export async function getCompanyMemory() {
  const companies = await dbList("companies");
  if (companies.length === 0) return null;
  return companies.find(c => c.id === DEFAULT_COMPANY_ID) || companies[0];
}

export async function upsertCompanyProfile(profile) {
  const existing = await dbGet("companies", DEFAULT_COMPANY_ID);
  if (existing) {
    return dbUpdate("companies", DEFAULT_COMPANY_ID, {
      ...profile,
      updated_at: new Date().toISOString(),
    });
  }
  return dbInsert("companies", { id: DEFAULT_COMPANY_ID, ...profile });
}

export async function addDocument(doc) {
  return dbInsert("source_documents", {
    company_id: DEFAULT_COMPANY_ID,
    ...doc,
  });
}

export async function addCapabilities(caps = []) {
  return Promise.all(
    caps.map(cap =>
      dbInsert("capabilities", {
        company_id: DEFAULT_COMPANY_ID,
        text: cap,
      })
    )
  );
}

export async function addPastProjects(projects = []) {
  return Promise.all(
    projects.map(proj =>
      dbInsert("past_projects", {
        company_id: DEFAULT_COMPANY_ID,
        ...proj,
      })
    )
  );
}

export async function addEvidenceSnippets(snippets = []) {
  return Promise.all(
    snippets.map(snip =>
      dbInsert("evidence_snippets", {
        company_id: DEFAULT_COMPANY_ID,
        ...snip,
      })
    )
  );
}

export async function getCapabilities() {
  return dbFind("capabilities", { company_id: DEFAULT_COMPANY_ID });
}

export async function getPastProjects() {
  return dbFind("past_projects", { company_id: DEFAULT_COMPANY_ID });
}

export async function getEvidenceSnippets() {
  return dbFind("evidence_snippets", { company_id: DEFAULT_COMPANY_ID });
}

export async function getDocuments() {
  return dbFind("source_documents", { company_id: DEFAULT_COMPANY_ID });
}

export async function buildMemoryContext() {
  const [company, caps, projects, snippets, docs] = await Promise.all([
    getCompanyMemory(),
    getCapabilities(),
    getPastProjects(),
    getEvidenceSnippets(),
    getDocuments(),
  ]);

  return {
    company_name: company?.name || process.env.NEXT_PUBLIC_COMPANY_NAME || "움틀",
    description: company?.description || "PES/NC 멤브레인 전문 바이오 소부장 기업",
    capabilities: caps.map(c => c.text),
    certifications: company?.certifications || [],
    past_projects: projects.map(p => `${p.year || ""} ${p.title} (${p.agency || ""}, ${p.budget || ""})`),
    customers_partners: company?.customers_partners || [],
    evidence_snippets: snippets.slice(0, 20).map(s => `[${s.source}] ${s.text}`),
    keywords: company?.keywords || [],
    document_count: docs.length,
  };
}
