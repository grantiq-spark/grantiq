import Anthropic from "@anthropic-ai/sdk";
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  try {
    const { messages, system, tools, max_tokens = 2000 } = req.body;
    const baseParams = {
      model: "claude-sonnet-4-20250514",
      max_tokens,
    };
    if (system) baseParams.system = system;
    if (tools) baseParams.tools = tools;

    // web_search 도구가 있으면 멀티턴으로 최종 텍스트까지 처리
    if (tools && tools.some(t => t.name === "web_search")) {
      let msgs = [...messages];
      for (let i = 0; i < 6; i++) {
        const r = await client.messages.create({ ...baseParams, messages: msgs });
        
        const hasToolUse = r.content.some(b => b.type === "tool_use");
        const hasText = r.content.some(b => b.type === "text" && b.text.length > 20);
        
        // 텍스트가 있고 tool_use가 없으면 최종 응답
        if (!hasToolUse && hasText) {
          return res.status(200).json(r);
        }
        
        // stop_reason이 end_turn이면 최종
        if (r.stop_reason === "end_turn") {
          return res.status(200).json(r);
        }
        
        // tool_use가 있으면 계속 루프
        if (hasToolUse) {
          msgs.push({ role: "assistant", content: r.content });
          const toolResults = r.content
            .filter(b => b.type === "tool_use")
            .map(b => ({
              type: "tool_result",
              tool_use_id: b.id,
              content: "검색이 실행되었습니다.",
            }));
          msgs.push({ role: "user", content: toolResults });
          continue;
        }
        
        return res.status(200).json(r);
      }
      
      // 루프 초과 - 마지막 시도
      const finalR = await client.messages.create({ ...baseParams, messages });
      return res.status(200).json(finalR);
    }

    // 일반 요청
    const response = await client.messages.create({ ...baseParams, messages });
    res.status(200).json(response);

  } catch (err) {
    console.error("Claude API error:", err);
    res.status(500).json({ error: err.message });
  }
}
