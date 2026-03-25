import { fetchOpportunities } from "../../lib/monitor/fetchOpportunities.js";
import { verifyOpportunity } from "../../lib/monitor/verifyOpportunity.js";
import { runBoardReview } from "../../lib/workflows/boardReview.js";
import { buildMemoryContext } from "../../lib/store/companyMemory.js";
import { postMessage } from "../../lib/slack/client.js";
import { dbInsert, dbList } from "../../lib/db/index.js";

export default async function handler(req, res) {
  const channel = process.env.SLACK_NOTIFY_CHANNEL || "C09V3K66C6P";
  res.status(200).json({ ok: true, message: "이사회 검토 시작됨" });

  (async () => {
    try {
      let opps = await dbList("opportunities");
      if (!opps?.length) {
        await postMessage({ channel, text: "공고 탐색 중..." });
        const found = await fetchOpportunities();
        for (const opp of found.slice(0, 3)) {
          const v = await verifyOpportunity(opp);
          await dbInsert("opportunities", { ...opp, fit_score: v.fit_score, status: "found" });
        }
        opps = await dbList("opportunities");
      }
      if (!opps?.length) { await postMessage({ channel, text: "검토할 공고 없음" }); return; }
      const opp = opps[0];
      await postMessage({ channel, text: `⚖️ 이사회 검토 시작: ${opp.title}` });
      const result = await runBoardReview(opp);
      await postMessage({ channel, text: `🎯 완료! 결정: ${result.decision}\n${result.summary}` });
    } catch (err) {
      await postMessage({ channel, text: `❌ 오류: ${err.message}` }).catch(() => {});
    }
  })();
}
