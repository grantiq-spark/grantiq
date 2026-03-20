import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export const config = {
        maxDuration: 60, // Vercel Pro: 최대 60초 (Hobby는 10초 제한)
};

export default async function handler(req, res) {
        if (req.method !== "POST") return res.status(405).end();

    try {
                const { messages, system, tools, tool_choice, max_tokens = 2000 } = req.body;

            // 모델명: 정확한 버전 문자열 사용
            const baseParams = { model: "claude-sonnet-4-6", max_tokens };
                if (system) baseParams.system = system;
                if (tools) baseParams.tools = tools;
                if (tool_choice) baseParams.tool_choice = tool_choice;

            let history = Array.isArray(messages) ? [...messages] : [];
                let lastResponse = null;

            for (let i = 0; i < 6; i++) {
                            const response = await client.messages.create({ ...baseParams, messages: history });
                            lastResponse = response;

                    console.log("turn:", i, "stop_reason:", response.stop_reason, "types:", response.content?.map(b => b.type));

                    // end_turn 또는 tool_use가 아닌 경우 즉시 반환
                    if (response.stop_reason !== "pause_turn") {
                                        return res.status(200).json(response);
                    }

                    // pause_turn이면 assistant 응답 이어붙이기
                    history = [...history, { role: "assistant", content: response.content }];
            }

            return res.status(200).json(lastResponse);
    } catch (err) {
                console.error("Claude API error:", err?.status, err?.message || err);

            // API 키 문제 구분
            if (err?.status === 401) {
                            return res.status(500).json({ error: "ANTHROPIC_API_KEY가 유효하지 않습니다. Vercel 환경변수를 확인하세요." });
            }
                if (err?.status === 429) {
                                return res.status(429).json({ error: "API 요청 한도 초과. 잠시 후 다시 시도해주세요." });
                }

            return res.status(500).json({ error: err.message || "Claude API error" });
    }
}
