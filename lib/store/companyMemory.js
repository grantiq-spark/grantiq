import { dbInsert, dbUpdate, dbGet, dbFind, dbList } from "../db/index.js";

const DEFAULT_COMPANY_ID = process.env.COMPANY_ID || "default";

const UMTR_DEFAULT = {
  company_name: process.env.NEXT_PUBLIC_COMPANY_NAME || "㈜움틀",
  description: "국내 최초 바이오산업용 분리막 전문 제조기업. PES MF/UF 멤브레인, NC 멤브레인, TFF 카세트 등 바이오공정 여과 제품 전문.",
  capabilities: [
    "PES MF/UF 멤브레인 제조 (NIPS 공정)",
    "NC 멤브레인 제조",
    "TFF(Tangential Flow Filtration) 카세트 개발",
    "바이오의약품 멤브레인 필터 국산화",
    "분리막 소재 설계 및 고분자 합성",
    "바이오공정 여과 시스템 설계",
    "체외진단 멤브레인 소재 개발",
    "sPES 블록공중합체 합성 (Bio-PESU)",
    "ISO 13485 품질경영시스템",
  ],
  keywords: [
    "멤브레인", "분리막", "PES", "UF", "MF", "TFF", "바이오공정",
    "바이오의약품", "필터", "체외진단", "소부장", "국산화",
    "고분자", "여과", "바이오소재", "의료기기",
  ],
  certifications: ["ISO 13485", "Innobiz"],
  past_projects: [
    "바이오공정용 PES 멤브레인 국산화",
    "소부장 체외진단용 NC 멤브레인 개발",
    "생물공정용 TFF 카세트 국산화",
  ],
  customers_partners: ["Celltrion", "Genbody"],
};

export async function getCompanyMemory() {
  const companies = await dbList("companies");
  if (companies.length === 0) return null;
  return companies.find(c => c.id === DEFAULT_COMPANY_ID) || companies[0];
}
export async function upsertCompanyProfile(profile) {
  const existing = await dbGet("companies", DEFAULT_COMPANY_ID);
  if (existing) return dbUpdate("companies", DEFAULT_COMPANY_ID, { ...profile, updated_at: new Date().toISOString() });
  return dbInsert("companies", { id: DEFAULT_COMPANY_ID, ...profile });
}
export async function addDocument(doc) { return dbInsert("source_documents", { company_id: DEFAULT_COMPANY_ID, ...doc }); }
export async function addCapabilities(caps = []) { return Promise.all(caps.map(cap => dbInsert("capabilities", { company_id: DEFAULT_COMPANY_ID, text: cap }))); }
export async function addPastProjects(projects = []) { return Promise.all(projects.map(proj => dbInsert("past_projects", { company_id: DEFAULT_COMPANY_ID, ...proj }))); }
export async function addEvidenceSnippets(snippets = []) { return Promise.all(snippets.map(snip => dbInsert("evidence_snippets", { company_id: DEFAULT_COMPANY_ID, ...snip }))); }
export async function getCapabilities() { return dbFind("capabilities", { company_id: DEFAULT_COMPANY_ID }); }
export async function getPastProjects() { return dbFind("past_projects", { company_id: DEFAULT_COMPANY_ID }); }
export async function getEvidenceSnippets() { return dbFind("evidence_snippets", { company_id: DEFAULT_COMPANY_ID }); }
export async function getDocuments() { return dbFind("source_documents", { company_id: DEFAULT_COMPANY_ID }); }

export async function buildMemoryContext() {
  const [company, caps, projects, snippets, docs] = await Promise.all([
    getCompanyMemory(), getCapabilities(), getPastProjects(), getEvidenceSnippets(), getDocuments(),
  ]);
  const dbCaps = caps.map(c => c.text);
  const dbProjs = projects.map(p => p.title || p.text || "");
  const dbKeywords = company?.keywords || [];
  return {
    company_name: company?.name || UMTR_DEFAULT.company_name,
    description: company?.description || UMTR_DEFAULT.description,
    capabilities: dbCaps.length > 0 ? dbCaps : UMTR_DEFAULT.capabilities,
    certifications: company?.certifications || UMTR_DEFAULT.certifications,
    past_projects: dbProjs.length > 0 ? dbProjs : UMTR_DEFAULT.past_projects,
    customers_partners: company?.customers_partners || UMTR_DEFAULT.customers_partners,
    evidence_snippets: snippets.slice(0, 20).map(s => "[" + s.source + "] " + s.text),
    keywords: dbKeywords.length > 0 ? dbKeywords : UMTR_DEFAULT.keywords,
    document_count: docs.length,
  };
}
