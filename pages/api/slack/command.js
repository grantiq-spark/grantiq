import { verifySlackSignature } from "../../../lib/slack/verify.js";
import { fetchOpportunities } from "../../../lib/monitor/fetchOpportunities.js";
import { verifyOpportunity } from "../../../lib/monitor/verifyOpportunity.js";
import { runBoardReview } from "../../../lib/workflows/boardReview.js";
import { buildMemoryContext } from "../../../lib/store/companyMemory.js";
import { dbInsert, dbList } from "../../../lib/db/index.js";

export const config = { api: { bodyParser: false } };

async function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", c => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

async function reply(response_url, text) {
  await fetch(response_url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ response_type: 'in_channel', replace_original: false, text })
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const rawBody = await readRawBody(req);
  const isValid = await verifySlackSignature(req, rawBody);
  if (!isValid) return res.status(401).json({ error: "Invalid signature" });

  const params = new URLSearchParams(rawBody.toString());
  const text = (params.get("text") || "").toLowerCase().trim();
  const channel_id = params.get("channel_id");
  const response_url = params.get("response_url");

  // 3초 내 즉시 응답
  res.status(200).json({ response_type: 'in_channel', text: '⏳ 처리 중...' });

  try {
    if (!text || text === 'help') {
      await reply(response_url, '🤖 *GRANTIQ 명령어*\n• `/grantiq status` — 시스템 상태\n• `/grantiq scan` — 공고 탐색\n• `/grantiq review` — 이사회 검토');
    } else if (text === 'status') {
      const opps = (await dbList("opportunities")) || [];
      const reviews = (await dbList("board_reviews")) || [];
      const dbNote = process.env.DATABASE_URL ? '' : ' ⚠️ in-memory DB';
      await reply(response_url, `✅ *GRANTIQ 상태*\n• 공고: ${opps.length}건\n• 이사회 검토: ${reviews.length}건\n• 서버: 정상${dbNote}`);
    } else if (text.includes('scan') || text.includes('공고')) {
      await reply(response_url, '🔍 공고 탐색 시작...');
      const memory = await buildMemoryContext();
      const opps = await fetchOpportunities(memory);
      if (!opps.length) { await reply(response_url, '검색 결과가 없어요.'); return; }
      let posted = 0;
      for (const opp of opps.slice(0, 5)) {
        const v = await verifyOpportunity(opp);
        await dbInsert("opportunities", { ...opp, fit_score: v.fit_score, status: "found" });
        if (v.fit_score >= 55) posted++;
      }
      await reply(response_url, `📋 탐색 완료: ${opps.length}건 발견, ${posted}건 고매칭`);
    } else if (text.includes('review')) {
      await reply(response_url, '⚖️ 이사회 검토 시작...');
      const opps = await dbList("opportunities");
      if (!opps?.length) { await reply(response_url, '공고가 없어요. `/grantiq scan` 먼저 실행하세요.'); return; }
      const result = await runBoardReview(opps[0]);
      await reply(response_url, `🎯 이사회 검토 완료: ${result.summary}`);
    } else {
      await reply(response_url, '❓ 명령어: `/grantiq scan` | `/grantiq review` | `/grantiq status`');
    }
  } catch (err) {
    await reply(response_url, `❌ 오류: ${err.message}`).catch(() => {});
  }
}
