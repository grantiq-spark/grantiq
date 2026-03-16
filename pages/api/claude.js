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

    let history = Array.isArray(messages) ? [...messages] : [];
    let lastResponse = null;

    for (let i = 0; i < 6; i++) {
      const response = await client.messages.create({
        ...baseParams,
        messages: history,
      });
      lastResponse = response;
      console.log(
        "Claude stop_reason:", response.stop_reason,
        "content types:",
        Array.isArray(response.content)
          ? response.content.map((b) => b.type)
          : []
      );

      if (response.stop_reason !== "pause_turn") {
        return res.status(200).json(response);
      }

      // server-tool: append assistant turn and continue
      history = [
        ...history,
        { role: "assistant", content: response.content },
      ];
    }

    return res.status(200).json(lastResponse);
  } catch (err) {
    console.error("Claude API error:", err);
    return res.status(500).json({ error: err.message || "Claude API error" });
  }
}
