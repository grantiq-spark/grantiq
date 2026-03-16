import Anthropic from "@anthropic-ai/sdk";
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  try {
    const { messages, system, tools, max_tokens = 2000 } = req.body;

    const baseParams = {
      model: "claude-sonnet-4-5",
      max_tokens,
    };
    if (system) baseParams.system = system;
    if (tools) baseParams.tools = tools;

    // web_search 도구가 있을 때 멀티턴 자동 처리
    if (tools && tools.some(t => t.name === "web_search")) {
      let msgs = [...messages];
      let lastResponse = null;

      for (let i = 0; i < 6; i++) {
        const r = await client.messages.create({ ...baseParams, messages: msgs });
        lastResponse = r;

        const toolUseBlocks = r.content.filter(b => b.type === "tool_use");

        // tool_use 없거나 end_turn이면 완료
        if (toolUseBlocks.length === 0 || r.stop_reason === "end_turn") {
          return res.status(200).json(r);
        }

        // 다음 턴으로: assistant 응답 추가 + tool_result 추가
        msgs = [...msgs,
          { role: "assistant", content: r.content },
          { role: "user", content: toolUseBlocks.map(b => ({
            type: "tool_result",
            tool_use_id: b.id,
            content: "검색 완료",
          })) }
        ];
      }

      return res.status(200).json(lastResponse);
    }

    // 일반 요청 (web_search 없음)
    const response = await client.messages.create({ ...baseParams, messages });
    res.status(200).json(response);

  } catch (err) {
    console.error("Claude API error:", err.message);
    res.status(500).json({ error: err.message });
  }
}
