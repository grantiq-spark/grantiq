// Edge Runtime: Hobby 플랜에서도 최대 30초 허용
export const config = {
            runtime: "edge",
            maxDuration: 30,
};

export default async function handler(req) {
            if (req.method !== "POST") {
                            return new Response(null, { status: 405 });
            }

    try {
                    const { messages, system, tools, tool_choice, max_tokens = 2000 } = await req.json();

                const baseParams = { model: "claude-sonnet-4-6", max_tokens };
                    if (system) baseParams.system = system;
                    if (tools) baseParams.tools = tools;
                    if (tool_choice) baseParams.tool_choice = tool_choice;

                let history = Array.isArray(messages) ? [...messages] : [];
                    let lastResponse = null;

                for (let i = 0; i < 6; i++) {
                                    const res = await fetch("https://api.anthropic.com/v1/messages", {
                                                            method: "POST",
                                                            headers: {
                                                                                        "x-api-key": process.env.ANTHROPIC_API_KEY,
                                                                                        "anthropic-version": "2023-06-01",
                                                                                        "content-type": "application/json",
                                                            },
                                                            body: JSON.stringify({ ...baseParams, messages: history }),
                                    });

                        const response = await res.json();
                                    lastResponse = response;

                        console.log("turn:", i, "stop_reason:", response.stop_reason);

                        if (response.stop_reason !== "pause_turn") {
                                                return new Response(JSON.stringify(response), {
                                                                            status: 200,
                                                                            headers: { "content-type": "application/json" },
                                                });
                        }

                        history = [...history, { role: "assistant", content: response.content }];
                }

                return new Response(JSON.stringify(lastResponse), {
                                    status: 200,
                                    headers: { "content-type": "application/json" },
                });
    } catch (err) {
                    console.error("Claude API error:", err);
                    return new Response(JSON.stringify({ error: err.message || "Claude API error" }), {
                                        status: 500,
                                        headers: { "content-type": "application/json" },
                    });
    }
}
