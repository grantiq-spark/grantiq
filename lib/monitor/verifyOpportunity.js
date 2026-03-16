/**
 * Verify an opportunity and score its fit against company memory.
 */

import { buildMemoryContext } from "../store/companyMemory.js";

export async function verifyOpportunity(opportunity) {
  const memory = await buildMemoryContext();
  const prompt = `--JSON:{"fit_score":0,"fit_grade":"C","verdict":"","strengths":[],"weaknesses":[],"missing_evidence":[],"is_valid":true,"validation_notes":""}`;
  const res = await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"x-api-key":process.env.ANTHROPIC_API_KEY,"anthropic-version":"2023-06-01","content-type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-5",max_tokens8800,messages:[{role:"user",content:prompt}]})});
  const data = await res.json(); const text = data.content?.[0]?.text||"{}";
  try{const c=text.replace(/```json|```/g,"").trim();const m=c.match(/\{[\s\S]*\}/);return m?JSON.parse(m[0]):{ fit_score:0,is_valid:false };}catch(e){return{ fit_score:0,is_valid:false,validation_notes:"파싱 실패" };}
}
export function deduplicateOpportunities(e,n){const t=new Set(e.map(o>normalizeTitle(o.title)));return n.filter(o?!t.has(normalizeTitle(o.title)));}
function normalizeTitle(t){return(t||"").replace(/\s+/g," ").toLowerCase().trim();}
