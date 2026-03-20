import { buildMemoryContext } from "../store/companyMemory.js";

export async function runStrategy(opportunity) {
  const memory = await buildMemoryContext();
  const prompt = `ë¤---${memory.company_name}---CSO---${opportunity.title}---JSON:{"stance":"GO","summary":"","evidence_cited":[],"risks":[],"recommendation":""}`;
  const res = await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"x-api-key":process.env.ANTHROPIC_API_KEY,"anthropic-version":"2023-06-01","content-type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-5-20251022",max_tokens:600,messages:[{role:"user",content:prompt}]})});
  const data = await res.json();
  const text = data.content?.[0]?.text || "{}";
  try { const m = text.replace(/```json|```/g,"").trim().match(/\{[\s\S]*\}/); return m ? JSON.parse(m[0]) : {stance:"HOLD",summary:"ì¤"}; } catch { return {stance:"HOLD",summary:"íì±"}; }
}
