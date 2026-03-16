// pages/api/claude.js
import Anthropic from "@anthropic-ai/sdk";
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  try {
    const { messages, system, tools, max_tokens = 2000 } = req.body;
    const params = { model: "claude-sonnet-4-20250514", max_tokens, messages: [...messages] };
    if (system) params.system = system;
    if (tools) params.tools = tools;

    if (tools?.some(t => t.name === "web_search")) {
      let msgs = [...messages];
      for (let i = 0; i < 5; i++) {
        const r = await client.messages.create({ ...params, messages: msgs });
        if (r.stop_reason === "end_turn" || !r.content.some(b => b.type === "tool_use")) {
          return res.status(200).json(r);
        }
        msgs.push({ role: "assistant", content: r.content });
        msgs.push({ role: "user", content: r.content.filter(b => b.type === "tool_use").map(b => ({ type: "tool_result", tool_use_id: b.id, content: "검색 완료" })) });
      }
    }

    const response = await client.messages.create(params);
    res.status(200).json(response);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
