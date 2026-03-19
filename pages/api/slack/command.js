import { verifySlackSignature } from "../../../lib/slack/verify.js";
import { postMessage } from "../../../lib/slack/client.js";
import { buildMemoryContext } from "../../../lib/store/companyMemory.js";
import { fetchOpportunities } from "../../../lib/monitor/fetchOpportunities.js";
import { verifyOpportunity } from "../../../lib/monitor/verifyOpportunity.js";
import { runBoardReview } from "../../../lib/workflows/boardReview.js";
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
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const rawBody = await readRawBody(req);
  const isValid = await verifySlackSignature(req, rawBody);
  if (!isValid) return res.status(401).json({ error: "Invalid signature" });
  const params = new URLSearchParams(rawBody.toString());
  const text = (params.get("text") || "").toLowerCase().trim();
  const channel_id = params.get("channel_id");
  res.status(200).end();
  try {
    if (!text || text === "help") {
      await postMessage({ channel: channel_id, text: "GRANTIQ 명령어 - /grantiq status | scan | review" });
    } else if (text === "status") {
      const opps = (await dbList("opportunities")) || [];
      const reviews = (await dbList("board_reviews")) || [];
      await postMessage({ channel: channel_id, text: "GRANTIQ 상태: 공고 " + opps.length + "건, 이사회검토 " + reviews.length + "건, 서버 정상" + (process.env.DATABASE_URL ? "" : " (in-memory)") });
    } else if (text.includes("scan")) {
      await postMessage({ channel: channel_id, text: "공고 탐색 중..." });
      const memory = await buildMemoryContext();
      const opps = await fetchOpportunities(memory);
      if (!opps.length) { await postMessage({ channel: channel_id, text: "결과 없음" }); return; }
      let hi = 0;
      for (const opp of opps.slice(0,5)) {
        const v = await verifyOpportunity(opp);
        await dbInsert("opportunities", { ...opp, fit_score: v.fit_score, status: "found" });
        if (v.fit_score >= 55) hi++;
      }
      await postMessage({ channel: channel_id, text: "탐색완료: " + opps.length + "건, " + hi + "건 고매칭" });
    } else if (text.includes("review")) {
      await postMessage({ channel: channel_id, text: "이사회 검토 시작..." });
      const opps = await dbList("opportunities");
      if (!opps?.length) { await postMessage({ channel: channel_id, text: "공고없음. /grantiq scan 먼저" }); return; }
      const result = await runBoardReview(opps[0]);
      await postMessage({ channel: channel_id, text: "검토완료: " + result.summary });
    } else {
      await postMessage({ channel: channel_id, text: "명령어: scan / review / status" });
    }
  } catch (err) {
    console.error("[command]", err);
    await postMessage({ channel: channel_id, text: "오류: " + err.message }).catch(() => {});
  }
}