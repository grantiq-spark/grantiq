import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { messages, system, tools, max_tokens = 2000 } = req.body;

    const params = {
      model: 'claude-sonnet-4-6',
      max_tokens,
      messages,
    };
    if (system) params.system = system;
    if (tools) params.tools = tools;

    const response = await client.messages.create(params);
    res.status(200).json(response);
  } catch (err) {
    console.error('Claude API error:', err);
    res.status(500).json({ error: err.message });
  }
}
