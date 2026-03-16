// pages/api/notion.js
import { Client } from "@notionhq/client";
const notion = new Client({ auth: process.env.NOTION_API_KEY });
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const { action, data } = req.body;
  try {
    if (action === "saveGrant") {
      const page = await notion.pages.create({
        parent: { database_id: process.env.NOTION_GRANTS_DB_ID },
        properties: {
          "공고명": { title: [{ text: { content: data.title } }] },
          "주관기관": { rich_text: [{ text: { content: data.agency || "" } }] },
          "매칭점수": { number: data.matchScore || 0 },
          "마감일": data.deadline ? { date: { start: data.deadline } } : { date: null },
          "예산": { rich_text: [{ text: { content: data.budget || "" } }] },
          "상태": { select: { name: "검토중" } },
        },
      });
      return res.status(200).json({ success: true, pageId: page.id });
    }
    res.status(400).json({ error: "Unknown action" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
