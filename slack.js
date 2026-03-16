// pages/api/board-meeting.js
// 매주 자동 실행: 공고 탐색 → 4인 임원 토론 → 대표 보고

const UMTR = {
  company: "㈜움틀",
  mainBiz: "바이오산업용 NC/PES 멤브레인·필터 연구개발·제조",
  currentRevenue: "연 15억원",
  rdBudget: "연간 10억+",
  cashFlow: "영업손실 구간, 대출 여력 약 16억",
  strengths: "ISO 13485, 특허 8건, 삼성바이오로직스 공동실증, 오송 부지 확보",
  keywords: ["바이오 멤브레인", "소부장 국산화", "PES 멤브레인", "NC 멤브레인", "TFF 모듈", "제균필터", "GMP", "체외진단기기"],
};

const EXECUTIVES = {
  tech: {
    name: "박기술",
    title: "기술이사",
    emoji: "🔴",
    focus: "기술 실현가능성, 개발 난이도, 기존 IP와의 연계성, 인력/장비 준비도",
    style: "냉철하고 구체적. 수치 기반. 불가능한 건 불가능하다고 직언.",
  },
  finance: {
    name: "이재무",
    title: "재무이사",
    emoji: "🟢",
    focus: "자기부담금, 현금흐름 영향, 정부지원 비율, 매출 실현까지 손익 시뮬레이션",
    style: "보수적. 리스크 먼저. 숫자가 안 맞으면 반대.",
  },
  strategy: {
    name: "김전략",
    title: "전략이사",
    emoji: "🔵",
    focus: "시장 타이밍, 경쟁사 동향, 정부 정책 흐름, 전략적 포지셔닝",
    style: "큰 그림. 지금 이 공고를 왜 잡아야 하는지 혹은 왜 패스해야 하는지.",
  },
  biz: {
    name: "최사업",
    title: "사업화이사",
    emoji: "🟡",
    focus: "주요 고객사 연결 가능성, 매출 전환 경로, 레퍼런스 활용, 납품 타임라인",
    style: "실용적. 공고가 끝난 후 실제 돈이 되는지만 관심.",
  },
};

async function callClaude(messages, system, max_tokens = 800) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/claude`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, system, max_tokens }),
  });
  const data = await res.json();
  return data.content?.find(b => b.type === "text")?.text || "";
}

async function searchGrants() {
  // Claude 웹 검색으로 최신 공고 탐색
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/claude`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      max_tokens: 1200,
      messages: [{
        role: "user",
        content: `한국 정부 R&D 공고를 검색하세요. 
검색 키워드: 바이오 소부장 R&D 2026, 멤브레인 필터 기술개발 공고, 산업부 소부장 지원사업, 체외진단 바이오의약품 R&D

기업: ${UMTR.company} | ${UMTR.mainBiz}

JSON만 반환:
{"grants":[{"title":"","agency":"","budget":"","deadline":"","period":"","summary":"","url":"","matchScore":0-100}]}

5~7개 공고, matchScore는 ${UMTR.keywords.join(",")} 키워드 기준으로 채점.`,
      }],
    }),
  });
  const data = await res.json();
  const text = data.content?.find(b => b.type === "text")?.text || "{}";
  const m = text.match(/\{[\s\S]*\}/);
  try {
    const parsed = m ? JSON.parse(m[0]) : { grants: [] };
    return (parsed.grants || []).sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0)).slice(0, 5);
  } catch { return []; }
}

async function execDebate(grant) {
  // 각 임원이 순서대로 의견 제시 + 반박
  const grantInfo = `공고명: ${grant.title}\n주관: ${grant.agency}\n예산: ${grant.budget}\n기간: ${grant.period}\n요약: ${grant.summary}`;
  const companyInfo = `기업: ${UMTR.company}\n현황: ${UMTR.currentRevenue}, ${UMTR.rdBudget}\n재무: ${UMTR.cashFlow}\n강점: ${UMTR.strengths}`;

  const opinions = {};

  // 1라운드: 각자 초기 의견
  for (const [key, exec] of Object.entries(EXECUTIVES)) {
    const text = await callClaude(
      [{ role: "user", content: `아래 공고에 대해 ${exec.title}로서 의견을 2~3문장으로 제시하세요.\n\n${grantInfo}\n\n${companyInfo}` }],
      `당신은 ${UMTR.company}의 ${exec.title} ${exec.name}입니다.\n담당: ${exec.focus}\n성격: ${exec.style}\n반드시 한국어로, 직책 특성에 맞게 핵심만 간결하게.`
    );
    opinions[key] = text.trim();
  }

  // 2라운드: 전략이사가 종합 + 최종 권고
  const allOpinions = Object.entries(EXECUTIVES).map(([k, e]) => `${e.emoji}${e.name}(${e.title}): ${opinions[k]}`).join("\n\n");

  const verdict = await callClaude(
    [{ role: "user", content: `아래 임원들의 의견을 종합해서 대표에게 최종 보고를 작성하세요.\n\n${allOpinions}\n\n공고: ${grant.title}` }],
    `당신은 ${UMTR.company} 이사회 서기입니다. 대표에게 드리는 보고 형식으로:\n- 권고: 지원/보류/패스 중 하나\n- 이유: 한 문장\n- 조건: 있다면 한 문장\n간결하고 명확하게.`,
    400
  );

  return { opinions, verdict: verdict.trim() };
}

async function postToSlack(report) {
  const WEBHOOK = process.env.SLACK_WEBHOOK_URL;
  if (!WEBHOOK) return;

  const date = new Date().toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "short" });

  const blocks = [
    {
      type: "header",
      text: { type: "plain_text", text: `📊 GRANTIQ 주간 공고 보고 — ${date}` },
    },
    {
      type: "section",
      text: { type: "mrkdwn", text: `이번 주 검토 공고 *${report.grants.length}건* 중 주목할 공고를 임원진이 검토했습니다.` },
    },
    { type: "divider" },
  ];

  for (const item of report.grants) {
    const score = item.grant.matchScore || 0;
    const scoreEmoji = score >= 70 ? "🎯" : score >= 45 ? "⚡" : "📋";
    const verdictLine = item.debate.verdict;

    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `${scoreEmoji} *${item.grant.title}*\n${item.grant.agency} · ${item.grant.budget || "미정"} · 마감 ${item.grant.deadline || "미정"}\n\n${Object.entries(EXECUTIVES).map(([k, e]) => `${e.emoji} *${e.name}*: ${item.debate.opinions[k]}`).join("\n\n")}\n\n📋 *이사회 종합의견*: ${verdictLine}`,
      },
      ...(item.grant.url && item.grant.url !== "#" ? {
        accessory: {
          type: "button",
          text: { type: "plain_text", text: "원문 보기" },
          url: item.grant.url,
        },
      } : {}),
    });
    blocks.push({ type: "divider" });
  }

  blocks.push({
    type: "context",
    elements: [{ type: "mrkdwn", text: `GRANTIQ 자율 에이전트 · 매주 월요일 오전 9시 자동 실행 · _${UMTR.company}_` }],
  });

  await fetch(WEBHOOK, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ blocks }),
  });
}

// ── 메인 핸들러 ────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  // Vercel Cron은 GET으로 호출됨. 수동 트리거는 POST
  if (req.method !== "GET" && req.method !== "POST") return res.status(405).end();

  // Vercel Cron secret 검증
  const authHeader = req.headers.authorization;
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    console.log("[BoardMeeting] 공고 탐색 시작...");
    const grants = await searchGrants();

    if (grants.length === 0) {
      return res.status(200).json({ message: "검색된 공고 없음" });
    }

    console.log(`[BoardMeeting] ${grants.length}개 공고 발견. 임원 검토 시작...`);

    // 상위 3개 공고만 심층 토론 (API 비용 절감)
    const topGrants = grants.slice(0, 3);
    const results = [];

    for (const grant of topGrants) {
      console.log(`[BoardMeeting] 검토 중: ${grant.title}`);
      const debate = await execDebate(grant);
      results.push({ grant, debate });
    }

    const report = { grants: results, generatedAt: new Date().toISOString() };

    console.log("[BoardMeeting] Slack 보고 전송 중...");
    await postToSlack(report);

    console.log("[BoardMeeting] 완료");
    return res.status(200).json({ success: true, grantsReviewed: results.length });

  } catch (err) {
    console.error("[BoardMeeting] 오류:", err);
    return res.status(500).json({ error: err.message });
  }
}
