export async function runOrchestrator(opportunity, opinions) {
  const { cto, cfo, strategy, bizdev } = opinions;
  const votes = [cto?.stance, cfo?.stance, strategy?.stance, bizdev?.stance];
  const goCount = votes.filter(v => v === "GO").length;
  const rejectCount = votes.filter(v => v === "REJECT").length;
  const prompt = `다...${opportunity.title}...GO ${goCount}...REJECT ${rejectCount}...JSON:{"decision":"GO","reason":"","risks":[],"missing_inputs":[],"next_action":"","confidence":0}`;
  const res = await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"x-api-key":process.env.ANTHROPIC_API_KEY,"anthropic-version":"2023-06-01","content-type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-5",max_tokens:800,messages:[{role:"user",content:prompt}]})});
  const data = await res.json();
  const text = data.content?.[0]?.text || "{}";
  try { const m = text.replace(/```json|```/g,"").trim().match(/\{[\s\S]*\}/); return m ? JSON.parse(m[0]) : {decision:"HOLD",reason:"사"}; } catch { return {decision: "HOLD", reason: "파싱"}; }
}
