/**
 * Use Claude to extract structured company memory from document text.
 */

export async function extractCompanyMemory(documentText, documentName) {
  const truncated = documentText.slice(0, 12000);
  const prompt = `ë..-JSON:{"company_profile":{"name":"","description":"","founded":null,"employees":null,"location":""},"capabilities":[],"certifications":[],"past_projects":[],"customers_partners":[],"evidence_snippets":[],"keywords":[]}`;
  const res = await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"x-api-key":process.env.ANTHROPIC_API_KEY,"anthropic-version":"2023-06-01","content-type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-5",max_tokens:2000,messages:[{role:"user",content:prompt}]})});
  const data = await res.json();
  const text = data.content?.[0]?.text || "{}";
  try { const c = text.replace(/```json|```/g,"").trim(); const m = c.match(/\{[\s\S]*\}/); return m?JSON.parse(m[0]):{}; } catch(e){return{};}
}
