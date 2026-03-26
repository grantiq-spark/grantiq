// pages/api/board-review.js
// 움틀 가상 이사진 4인 검토 API — 봇에서 호출
// POST { type: "announcement"|"expense"|"weekly_report"|"rfp", content: "..." }
// → { ok: true, reviews: [{id, name, role, comment, stance}] }

const UMTR_CONTEXT = `
㎝움틀(UMTR Bio)은 국내 유일 바이오공정용 PES MF/UF 멤브레인 전문 제조기업이다.
설립: 2019년 12월 / 경기 성남 / Innobiz / ISO 13485 보유
투자자: 블루포인트파트너스, 롯데벤처스, 젤바디
핵심제품: 비대칭 PES MF 멤브레인(0.2μm), NC 멤브레인, TFF 카세트
주요고객: 셀트리온(평가중), 이셀, 아미코젤, 현대마이크로
진행과제: 소부장, 디딜돌, 에어필터, KCL 과제 동시 수행
강점: BCT 7 LRV 이상, Endotoxin 0.136 EU/mL, Sartorius 대비 104% 성능
재무: 2025년 첫 흑자 달성. 매출 대부분 연구과제 수주. 부채비율 증가 중.
전략목표: 수입대체(국산화), GMP 인증, 해외 진출(VivaTech, Bio USA)
`;

const BOARD = [
  {
    id: "cto",
    name: "기술이사",
    role: "CTO",
    background: "바이오공정 엔지니어링 20년. PES 멤브레인 소재·공정 전문가. 성능 데이터와 재현성을 가장 중시한다.",
    focus: "기술적 타당성, 멤브레인 성능 스펙 충족 여부, R&D 실현 가능성, 기술 리스크, 특허 차별성",
    question: "우리 기술로 실제로 할 수 있는가? 성능 요건을 맞출 수 있는가?",
  },
  {
    id: "cfo",
    name: "재무이사",
    role: "CFO",
    background: "스타트업 재무 전문가. 연구개발비 집행과 RCMS/EZBARO 관리 경험. 자금 흐름과 매칭 펀드 부담을 항상 따진다.",
    focus: "예산 적정성, 매칭 펀드 부담 비율, 현금흐름 영향, 과제 간접비율, ROI, 재무 리스크",
    question: "지금 우리 재무 상황에서 감당 가능한가? 매칭 자금은 어디서 나오는가?",
  },
  {
    id: "cso",
    name: "전략이사",
    role: "CSO",
    background: "바이오 산업 전략 컨설턴트 출신. 시장 트렌드와 경쟁사 동향에 밝다. 셀트리온·삼성바이오로직스 같은 대형 고객사와의 연결을 늘 고민한다.",
    focus: "시장성, 수입대체 가능성, 고객 레퍼런스 확보 가치, 경쟁사 대비 차별성, 해외 진출 연계성",
    question: "이게 시장에서 팔리는가? 셀트리온 납품으로 연결될 수 있는가?",
  },
  {
    id: "coo",
    name: "운영이사",
    role: "COO",
    background: "제조업 운영 전문가. Pilot 라인 스케일업과 품질 관리 경험. 현재 움틀의 인력 4명 체제 한계를 잘 안다.",
    focus: "실행 가능성, 현재 4인 체제에서 수행 가능 여부, 납기·일정 리스크, 생산능력 충족, 인증 부담",
    question: "지금 우리 인력과 설비로 실제로 수행할 수 있는가? 다른 과제와 충돌하지 않는가?",
  },
];

async function getReview(member, context, type) {
  const typeLabel = {
    announcement: "신규 공고/RFP",
    expense: "지출결의",
    weekly_report: "주간보고",
    rfp: "RFP 기획안",
  };

  const prompt = `당신은 ㎝움틀의 ${member.name}(${member.role})입니다.

[회사 맥락]
${UMTR_CONTEXT}

[당신의 배경과 관점]
${member.background}
핵심 검토 관점: ${member.focus}
핵심 질문: ${member.question}

[검토 요청: ${typeLabel[type] || type}]
${context}

위 내용을 검토하고 ${member.name}로서 솔직한 의견을 주세요.

규칙:
- 한국어로 답변
- 3~4문장으로 구체적으로
- 움틀의 현재 상황(인력 4명, 첫 흑자, 매출집중도, 기술력)을 반영
- 입장은 반드시 "찬성" / "검토필요" / "반대" 중 하나
- 근거는 구체적 수치나 사실 기반
- JSON만 반환:
{"stance": "찬성|검토필요|반대", "comment": "의견 내용"}`;

  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_BASE_URL || "https://grantiq.vercel.app"}/api/claude`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 400,
        }),
      }
    );
    const data = await res.json();
    const text = data.content?.find((b) => b.type === "text")?.text || "";
    const clean = text.replace(/\`\`\`json|\`\`\`/g, "").trim();
    const parsed = JSON.parse(clean);

    return {
      id: member.id,
      name: member.name,
      role: member.role,
      comment: parsed.comment,
      stance: parsed.stance,
    };
  } catch (e) {
    return {
      id: member.id,
      name: member.name,
      role: member.role,
      comment: "검토 중 오류 발생 — 재시도 필요",
      stance: "검토필요",
    };
  }
}

function buildContext(type, content) {
  const prefix = {
    announcement: "【신규 공고/RFP 검토】\n",
    expense: "【지출결의 검토】\n",
    weekly_report: "【주간보고 검토】\n",
    rfp: "【RFP 기획안 검토】\n",
  };
  return (prefix[type] || "") + content;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { type, content } = req.body;

    if (!type || !content) {
      return res.status(400).json({ error: "type과 content 필요" });
    }

    const context = buildContext(type, content);

    // 4명 병렬 호출
    const reviews = await Promise.all(
      BOARD.map((member) => getReview(member, context, type))
    );

    return res.status(200).json({ ok: true, reviews });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
}
