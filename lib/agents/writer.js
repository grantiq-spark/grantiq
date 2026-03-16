import { buildMemoryContext } from "../store/companyMemory.js";

export async function runWriter(opportunity, boardSummary) {
  const memory = await buildMemoryContext();
  const prompt = `--JSON:{"project_title":"","overview":"","background":"","final_goal":"","annual_goals":[],"annual_goals_summary":"","budget_outline":"","commercialization":"","expected_effects":"","gantt_outline":"","missing_inputs":[]}`;
  const res = await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"x-api-key":process.env.ANTHROPIC_API_KEY,"anthropic-version":"2023-06-01","content-type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-5",max_tokens:3000,messages:[{role:"user",content:prompt}]})});
  const data = await res.json();
  const text = data.content?.[0]?.text || "{}";
  try { const m = text.replace(/```json|```/g,"").trim().match(/\{[\s\S]*\}/); return m ? JSON.parse(m[0]) : null; } catch { return null; }
}
