/**
 * Download a Slack file, parse its content, extract company memory.
 */
import { downloadFile, getFileInfo } from "../slack/client.js";
import { parsePdfBuffer, parseTextBuffer } from "./parsePdf.js";
import { extractCompanyMemory } from "./extractCompanyMemory.js";
import { addDocument, upsertCompanyProfile, addCapabilities, addPastProjects, addEvidenceSnippets } from "../store/companyMemory.js";

export async function ingestSlackFile(fileId) {
  const fileInfo = await getFileInfo(fileId);
  const { name, mimetype, url_private, size } = fileInfo;
  const arrayBuffer = await downloadFile(url_private);
  let parsed = (mimetype === "application/pdf" || name.endsWith(".pdf"))
    ? await parsePdfBuffer(arrayBuffer) : await parseTextBuffer(arrayBuffer);
  if (!parsed.text || parsed.text.length < 50) throw new Error(`이사 추출 실패`);
  const docRecord = await addDocument({ slack_file_id: fileId, name, mimetype, size, pages: parsed.pages, text_length: parsed.text.length, status: "parsing" });
  const memory = await extractCompanyMemory(parsed.text, name);
  const tasks = [];
  if (memory.company_profile) tasks.push(upsertCompanyProfile({...memory.company_profile, certifications: memory.certifications || [], customers_partners: memory.customers_partners || [], keywords: memory.keywords || []}));
  if (memory.capabilities?.length) tasks.push(addCapabilities(memory.capabilities));
  if (memory.past_projects?.length) tasks.push(addPastProjects(memory.past_projects));
  if (memory.evidence_snippets?.length) tasks.push(addEvidenceSnippets(memory.evidence_snippets));
  await Promise.all(tasks);
  await addDocument({ id: docRecord.id, slack_file_id: fileId, name, status: "done", extracted_at: new Date().toISOString() });
  return { name, text_length: parsed.text.length, pages: parsed.pages, extracted: memory };
}
