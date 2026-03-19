import { fetchOpportunities } from "../../lib/monitor/fetchOpportunities.js";
import { verifyOpportunity } from "../../lib/monitor/verifyOpportunity.js";
import { buildMemoryContext } from "../../lib/store/companyMemory.js";
import { postMessage } from "../../lib/slack/client.js";
import { dbInsert } from "../../lib/db/index.js";
import { boardPacketBlocks } from "../../lib/slack/messages.js";

export default async function handler(req, res) {
  const channel = process.env.SLACK_NOTIFY_CHANNEL || "C09V3K66C6P";
  res.status(200).json({ ok: true, message: "탐색 시작됨", ts: new Date().toISOString() });
  (async () => {
    try {
      await postMessage({ channel, text: "GRANTIQ 공고 탐색 시작..." });
      const memory = await buildMemoryContext();
      const opps = await fetchOpportunities(memory);
      if (!opps.length) {
        await postMessage({ channel, text: "탐색 완료: 결과 없음" });
        return;
      }
      let hi = 0;
      for (const opp of opps.slice(0, 5)) {
        const v = await verifyOpportunity(opp);
        const rec = await dbInsert("opportunities", { ...opp, fit_score: v.fit_score, fit_grade: v.fit_grade, verdict: v.verdict, status: "found" });
        if (v.fit_score >= 55) {
          hi++;
          await postMessage({ channel, text: opp.title + " (" + v.fit_score + "점)", blocks: boardPacketBlocks(rec) });
        }
      }
      await postMessage({ channel, text: "탐색 완료: " + opps.length + "건 발견, " + hi + "건 고매칭" });
    } catch (err) {
      console.error("[trigger]", err);
      await postMessage({ channel, text: "오류: " + err.message }).catch(() => {});
    }
  })();
}