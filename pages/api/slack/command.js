import { verifySlackSignature } from "../../../lib/slack/verify.js";
import { postMessage } from "../../../lib/slack/client.js";
import { buildMemoryContext } from "../../../lib/store/companyMemory.js";
import { fetchOpportunities } from "../../../lib/monitor/fetchOpportunities.js";
import { verifyOpportunity } from "../../../lib/monitor/verifyOpportunity.js";
import { runBoardReview } from "../../../lib/workflows/boardReview.js";
import { runProposalPipeline } from "../../../lib/workflows/proposalPipeline.js";
import { dbInsert, dbList, dbGet } from "../../../lib/db/index.js";

export const config = { api: { bodyParser: false }, maxDuration: 300 };

async function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
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
  const text = (params.get("text") || "").trim();
  const cmd = text.toLowerCase();
  const channel_id = params.get("channel_id");

  // Slack 요구: 3초 이내 응답
  res.status(200).end();

  try {
    // ===== help =====
    if (!cmd || cmd === "help") {
      await postMessage({
        channel: channel_id,
        text:
          "*GRANTIQ 명령어*\n" +
          "• `/grantiq status` - 시스템 상태\n" +
          "• `/grantiq scan` - 공고 탐색 (IRIS/NTIS/KEIT)\n" +
          "• `/grantiq propose` - 최적 공고 기획안 생성\n" +
          "• `/grantiq review` - 이사회 검토 (토론+4임원)\n" +
          "• `/grantiq report` - CFO 최종 보고\n" +
          "• `/grantiq full` - 전체 파이프라인 (탐색→기획안→검토→보고)",
      });

    // ===== status =====
    } else if (cmd === "status") {
      const opps = (await dbList("opportunities")) || [];
      const reviews = (await dbList("board_reviews")) || [];
      const proposals = (await dbList("proposals")) || [];
      const pipelines = (await dbList("proposal_pipelines")) || [];
      await postMessage({
        channel: channel_id,
        text:
          "*GRANTIQ 상태*\n" +
          "• 공고: " + opps.length + "건\n" +
          "• 기획안: " + proposals.length + "건\n" +
          "• 이사회검토: " + reviews.length + "건\n" +
          "• 파이프라인: " + pipelines.length + "건\n" +
          "• 서버: 정상" + (process.env.DATABASE_URL ? "" : " (in-memory)"),
      });

    // ===== scan =====
    } else if (cmd.includes("scan")) {
      await postMessage({ channel: channel_id, text: "🔍 공고 탐색 중..." });
      const opps = await fetchOpportunities();
      if (!opps.length) {
        await postMessage({ channel: channel_id, text: "결과 없음" });
        return;
      }
      let hiCount = 0;
      for (const opp of opps.slice(0, 5)) {
        const v = await verifyOpportunity(opp);
        await dbInsert("opportunities", {
          ...opp,
          fit_score: v.fit_score,
          status: "found",
          found_at: new Date().toISOString(),
        });
        if (v.fit_score >= 55) hiCount++;
      }
      await postMessage({
        channel: channel_id,
        text:
          "✅ 탐색완료: " + opps.length + "건 발견, " + hiCount + "건 고매칭\n" +
          opps.slice(0, 3).map((o, i) =>
            (i + 1) + ". " + o.title + " (" + (o.organization || "") + ")"
          ).join("\n"),
      });

    // ===== propose =====
    } else if (cmd.includes("propose") || cmd.includes("기획")) {
      const opps = await dbList("opportunities");
      if (!opps?.length) {
        await postMessage({
          channel: channel_id,
          text: "공고 없음. `/grantiq scan` 먼저 실행하세요.",
        });
        return;
      }
      // 가장 높은 fit_score 공고 선택
      const sorted = opps.sort((a, b) => (b.fit_score || 0) - (a.fit_score || 0));
      const best = sorted[0];
      await postMessage({
        channel: channel_id,
        text: "📝 기획안 생성 시작: " + best.title,
      });

      const result = await runProposalPipeline({
        opportunity: best,
        slackChannel: channel_id,
        threadTs: null,
      });

      if (result?.proposal) {
        await postMessage({
          channel: channel_id,
          text:
            "✅ 기획안 생성 완료\n" +
            "• 과제명: " + (result.proposal.project_title || "") + "\n" +
            "• 재무판정: " + (result.financial?.recommendation || "N/A"),
        });
      }

    // ===== review =====
    } else if (cmd.includes("review") || cmd.includes("검토")) {
      const opps = await dbList("opportunities");
      if (!opps?.length) {
        await postMessage({
          channel: channel_id,
          text: "공고 없음. `/grantiq scan` 먼저 실행하세요.",
        });
        return;
      }
      await postMessage({
        channel: channel_id,
        text: "⚖️ 이사회 검토 시작...",
      });
      const best = opps.sort((a, b) => (b.fit_score || 0) - (a.fit_score || 0))[0];
      const result = await runBoardReview({
        opportunity: best,
        slackChannel: channel_id,
        threadTs: null,
      });
      await postMessage({
        channel: channel_id,
        text: "✅ 검토완료: " + result.decision,
      });

    // ===== report =====
    } else if (cmd.includes("report") || cmd.includes("보고")) {
      const pipelines = (await dbList("proposal_pipelines")) || [];
      const reviews = (await dbList("board_reviews")) || [];
      const opps = (await dbList("opportunities")) || [];

      if (!opps.length) {
        await postMessage({
          channel: channel_id,
          text: "보고할 데이터가 없습니다. `/grantiq scan` 부터 시작하세요.",
        });
        return;
      }

      // CFO 최종 보고 생성
      const reportPrompt = `당신은 CFO(재무이사)입니다. 아래 데이터를 기반으로 대표이사에게 보고할 최종 요약 보고서를 작성하세요.

발견된 공고: ${opps.length}건
상위 3건:
${opps.sort((a,b) => (b.fit_score||0) - (a.fit_score||0)).slice(0,3).map((o,i) => (i+1) + ". " + o.title + " (적합도: " + (o.fit_score||"?") + ")").join("\n")}

기획안 현황: ${pipelines.length}건 진행
이사회 검토: ${reviews.length}건 완료

한국어로 5줄 이내로 간결하게 보고하세요. 핵심 추천 공고와 이유, 예상 예산, 리스크를 포함하세요.`;

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": process.env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1000,
          messages: [{ role: "user", content: reportPrompt }],
        }),
      });

      const data = await res.json();
      const reportText = data.content?.[0]?.text || "보고서 생성 실패";

      await postMessage({
        channel: channel_id,
        text: "📊 *CFO 최종 보고*\n" + reportText,
      });

    // ===== full pipeline =====
    } else if (cmd.includes("full") || cmd.includes("전체")) {
      await postMessage({
        channel: channel_id,
        text: "🚀 전체 파이프라인 시작 (scan → propose → review → report)...",
      });

      // Step 1: Scan
      const opps = await fetchOpportunities();
      if (!opps.length) {
        await postMessage({ channel: channel_id, text: "공고 발견 실패" });
        return;
      }
      let best = null;
      for (const opp of opps.slice(0, 5)) {
        const v = await verifyOpportunity(opp);
        const saved = await dbInsert("opportunities", {
          ...opp,
          fit_score: v.fit_score,
          status: "found",
        });
        if (!best || v.fit_score > (best.fit_score || 0)) {
          best = { ...opp, ...saved, fit_score: v.fit_score };
        }
      }

      await postMessage({
        channel: channel_id,
        text: "✅ 탐색완료: " + opps.length + "건. 최적: " + best.title,
      });

      // Step 2: Propose
      const pipeResult = await runProposalPipeline({
        opportunity: best,
        slackChannel: channel_id,
        threadTs: null,
      });

      // Step 3: Review
      const reviewResult = await runBoardReview({
        opportunity: best,
        slackChannel: channel_id,
        threadTs: null,
      });

      // Step 4: Report
      await postMessage({
        channel: channel_id,
        text:
          "📋 *전체 파이프라인 완료*\n" +
          "════════════════════\n" +
          "공고: " + best.title + "\n" +
          "기획안: " + (pipeResult?.proposal?.project_title || "N/A") + "\n" +
          "재무판정: " + (pipeResult?.financial?.recommendation || "N/A") + "\n" +
          "이사회: " + (reviewResult?.decision || "N/A") + "\n" +
          "참고: 상세 결과는 스레드에서 확인 가능",
      });

    // ===== unknown =====
    } else {
      await postMessage({
        channel: channel_id,
        text: "명령어: scan / propose / review / report / full / status",
      });
    }
  } catch (err) {
    console.error("[command]", err);
    await postMessage({
      channel: channel_id,
      text: "❌ 오류: " + err.message,
    }).catch(() => {});
  }
}
