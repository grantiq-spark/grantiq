// pages/index.js — GRANTIQ 메인 대시보드 (대표/임원용)
import { useState } from "react";
import Head from "next/head";
import { jsonrepair } from "jsonrepair";

// ─── 공통 상수 ───────────────────────────────────────────────────
const UMTR = {
  company: process.env.NEXT_PUBLIC_COMPANY_NAME || "⑨움틀",
  mainBiz: "바이오산업용 NC/PES 멤브레인·필터 연구개발·제조",
  keywords: ["바이오 멤브레인", "소부장 국산화", "PES 중공사막인", "NC 멤브레인", "TFF 모듈", "재관필터", "GMP", "체외진단기기", "ISO13485"],
};

const PRESET_QUERIES = [
  { label: "바이오 소부장", q: "바이오 소부장 R&D 지원사업 공고 2025 2026" },
  { label: "멤브레인 기술개발", q: "멤브레인 필터 기술개발 정부 R&D 금고 2026" },
  { label: "산업통상자원부", q: "산업통상자원부 소재부품장비 R&D 공고 2026" },
  { label: "창업·벤처", q: "바이오 창업지원 벤처육성 2026 소부장" },
  { label: "IRIS 검색", q: "iris.go.kr 멤브레인 분리막 R&D 2026" },
];

// ─── API 호출 헬퍼 ──────────────────────────────────────────────────
async function callClaude(body) {
  const res = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data.error || "API 오류");
    err.code = data.code || "UNKNOWN";
    err.status = res.status;
    throw err;
  }
  return data;
}

async function postToSlack(action, data) {
  const res = await fetch("/api/slack", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, data }),
  });
  return res.json();
}

// ─── IRIS 파이프라인 API ──────────────────────────────────────────────
async function callIrisSearch(query, source) {
  const res = await fetch("/api/iris/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, source: source || "all" }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "IRIS 검색 오류");
  return data;
}

async function callIrisAnalyze(grant) {
  const res = await fetch("/api/iris/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: grant.title,
      organization: grant.agency || grant.organization || "",
      url: grant.url || "",
      notice_number: grant.notice_number || "",
      summary: grant.summary || grant.description || "",
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "RFP 분석 오류");
  return data;
}

// ─── 공통 컴포넌트 ────────────────────────────────────────────────
function ScoreRing({ score, size = 52 }) {
  const r = (size - 8) / 2, c = 2 * Math.PI * r;
  const color = score >= 80 ? "#10b981" : score >= 60 ? "#3b82f6" : score >= 40 ? "#f59e0b" : "#ef4444";
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)", flexShrink: 0 }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#ffffff08" strokeWidth={4}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={4}
        strokeDasharray={c} strokeDashoffset={c * (1 - score / 100)} strokeLinecap="round"/>
      <text x={size/2} y={size/2} textAnchor="middle" dy="5" fill={color}
        style={{ fontSize: size * 0.30, fontWeight: 900, transform: "rotate(90deg)", transformOrigin: "center" }}>
        {score}
      </text>
    </svg>
  );
}

function Spinner({ size = 20, color = "#8b5cf6" }) {
  return (
    <div style={{ width: size, height: size, border: `2px solid ${color}33`, borderTop: `2px solid ${color}`,
      borderRadius: "50%", animation: "spin .6s linear infinite", display: "inline-block", verticalAlign: "middle" }}/>
  );
}

function StepIndicator({ steps, current }) {
  return (
    <div style={{ display: "flex", gap: 2, marginBottom: 20 }}>
      {steps.map((s, i) => {
        const active = i === current;
        const done = i < current;
        return (
          <div key={i} style={{ flex: 1, textAlign: "center" }}>
            <div style={{ height: 3, borderRadius: 2, marginBottom: 6,
              background: done ? "#10b981" : active ? "#8b5cf6" : "#ffffff0a" }}/>
            <span style={{ fontSize: 10, color: done ? "#10b981" : active ? "#a78bfa" : "#4b5563", fontWeight: active ? 700 : 400 }}>
              {s}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── 공고 탐색 탭 ─────────────────────────────────────────────────
function GrantSearch({ onSelectGrant }) {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [grants, setGrants] = useState([]);
  const [selected, setSelected] = useState(null);
  const [analysis, setAnalysis] = useState({});
  const [analyzing, setAnalyzing] = useState(null);
  const [saved, setSaved] = useState({});
  const [status, setStatus] = useState("");

  async function search(q) {
    const sq = q || query;
    if (!sq.trim() || searching) return;
    setSearching(true); setGrants([]); setSelected(null); setStatus("검색 중...");
    try {
      const data = await callClaude({
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        messages: [{
          role: "user",
          content: `한국 정부 R&D 공고 검색: "${sq}"\n기업: ${UMTR.company} (${UMTR.mainBiz})\n키워드: ${UMTR.keywords.join(", ")}\n\n주요 출처: iris.go.kr, ntis.go.kr, mss.go.kr, keit.re.kr, bioin.or.kr\n\n결과는 JSON으로: {"grants":[{"title":"","agency":"","deadline":"","budget":"","matchScore":0∼100,"reason":"","url":"","source":""}],"searchSummary":""}`,
        }],
      });
      const text = data.content?.find(b => b.type === "text")?.text || "{}";
      let cleanText = text.replace(/```json\n?|```\n?/g, "").trim();
      const m = cleanText.match(/\{[\s\S]*\}/);
      let parsed = { grants: [] };
      if (m) {
        try {
          parsed = JSON.parse(jsonrepair(m[0]));
        } catch(e) { console.error("jsonrepair failed:", e); }
      }
      const sorted = (parsed.grants || []).sort((a, b) => (b.matchScore||0) - (a.matchScore||0));
      setGrants(sorted);
      setStatus(parsed.searchSummary || `${sorted.length}개 공고`);
    } catch (err) {
      console.error("Search error:", err);
      const msg = err.code === "RATE_LIMIT"
        ? "⚠️ API 요청 한도 초과. 1분 후 다시 시도해주세요."
        : err.code === "AUTH_ERROR"
        ? "❌ API 키 오류. 관리자에게 문의하세요."
        : err.code === "OVERLOADED"
        ? "⏳ Claude 서버 혼잡. 잠시 후 다시 시도해주세요."
        : "❌ " + (err.message || "검색 실패");
      setStatus(msg);
    }
    finally { setSearching(false); }
  }

  async function analyze(grant) {
    if (analysis[grant.title]) return;
    setAnalyzing(grant.title);
    try {
      const data = await callIrisAnalyze(grant);
      const fit = data.fit_analysis || {};
      const rfp = data.rfp || {};
      // verdict 매핑: overall_score → S/A/B/C
      const score = fit.overall_score || 0;
      const verdict = score >= 80 ? "S" : score >= 60 ? "A" : score >= 40 ? "B" : "C";
      setAnalysis(p => ({ ...p, [grant.title]: {
        verdict,
        fitScore: score,
        recommendation: fit.recommendation || "",
        reasons: fit.strengths || [],
        weaknesses: fit.weaknesses || [],
        matchingCapabilities: fit.matching_capabilities || [],
        missingRequirements: fit.missing_requirements || [],
        strategy: fit.reason || "",
        risk: (fit.weaknesses || []).slice(0, 2).join(", ") || "분석 중",
        rfp,
        raw: data,
      }}));
    } catch (err) {
      console.error("IRIS analyze error:", err);
      // 실패 시 간이 Claude 분석으로 폴백
      try {
        const data = await callClaude({
          messages: [{
            role: "user",
            content: `기업: ${UMTR.company} | ${UMTR.mainBiz} | 키워드: ${UMTR.keywords.join(", ")}\n공고: ${grant.title}\n기관: ${grant.agency}\n\n분석 JSON: {"verdict":"S|A|B|C","fitScore":0,"reasons":["이유"],"strategy":"전략","risk":"위험"}`,
          }],
        });
        const text = data.content?.[0]?.text || "{}";
        const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
        setAnalysis(p => ({ ...p, [grant.title]: parsed }));
      } catch { /* 최종 실패 */ }
    }
    finally { setAnalyzing(null); }
  }

  async function saveGrant(grant) {
    try {
      const an = analysis[grant.title];
      await postToSlack("shareGrant", {
        ...grant,
        matchScore: an?.fitScore || grant.matchScore || 0,
        verdict: an ? `[${an.verdict}등급] 적합도 ${an.fitScore}점 (${an.recommendation || ""})\n${an.strategy || ""}` : null,
      });
      setSaved(p => ({ ...p, [grant.title]: true }));
    } catch { alert("Slack 전송 실패. Vercel 환경변수 확인:\n- SLACK_WEBHOOK_URL\n- INTERNAL_API_SECRET"); }
  }

  const s = selected; const an = s ? analysis[s.title] : null;
  const gColor = c => ({ S: "#10b981", A: "#3b82f6", B: "#f59e0b", C: "#6b7280" }[c] || "#6b7280");

  return (
    <div style={{ display: "flex", height: "calc(100vh - 112px)", gap: 0 }}>
      {/* 리스트 패널 */}
      <div style={{ width: 420, borderRight: "1px solid #ffffff09", display: "flex", flexDirection: "column" }}>
        {/* 검색창 */}
        <div style={{ padding: "14px 16px", borderBottom: "1px solid #ffffff09", background: "#0a0c15" }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === "Enter" && search()}
              placeholder="공고 검색어 입력..."
              style={{ flex: 1, background: "#ffffff08", border: "1px solid #ffffff09", borderRadius: 8, padding: "9px 14px", color: "#e2e8f0", fontSize: 13, outline: "none" }}/>
            <button onClick={() => search()} disabled={searching}
              style={{ padding: "9px 16px", borderRadius: 8, border: "none", background: searching ? "#1e1e2e" : "#3b82f6", color: "#fff", cursor: "pointer", fontSize: 13 }}>
              {searching ? <Spinner size={16} color="#6b7280"/> : "검색"}
            </button>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {PRESET_QUERIES.map(p => (
              <button key={p.label} onClick={() => { setQuery(p.q); search(p.q); }}
                style={{ fontSize: 10, padding: "3px 9px", borderRadius: 5, border: "1px solid #ffffff0a", background: "#ffffff05", color: "#9ca3af", cursor: "pointer" }}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
        {/* 상태 */}
        {status && (
          <div style={{ padding: "8px 16px", fontSize: 11, color: searching ? "#8b5cf6" : "#10b981", display: "flex", gap: 6, alignItems: "center" }}>
            {searching && <Spinner size={12} color="#8b5cf6"/>} {status}
          </div>
        )}
        {/* 리스트 */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {grants.length === 0 && !searching && (
            <div style={{ padding: "50px 20px", textAlign: "center", color: "#374151" }}>
              <div style={{ fontSize: 28, marginBottom: 10 }}>&#128270;</div>
              <div style={{ fontSize: 12 }}>위 버튼으로 공고를 검색해보세요</div>
            </div>
          )}
          {!searching && status && <p style={{ padding: "8px 12px", color: status.includes("⚠") || status.includes("❌") ? "#ef4444" : "#4b5563", fontSize: 11 }}></p>}
          {grants.map((g, i) => (
            <div key={i} onClick={() => { setSelected(g); analyze(g); }}
              style={{ padding: "12px 14px", borderBottom: "1px solid #ffffff06", cursor: "pointer",
              background: s?.title === g.title ? "#1a1f35" : "transparent",
              borderLeft: `3px solid ${s?.title === g.title ? "#3b82f6" : "transparent"}` }}>
              <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <ScoreRing score={g.matchScore||0} size={46}/>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#f1f5f9", lineHeight: 1.4 }}>{g.title}</div>
                  <div style={{ fontSize: 10, color: "#6b7280", marginTop: 4 }}>{g.agency} {g.deadline && `| ${g.deadline}`}</div>
                  {g.budget && <div style={{ fontSize: 10, color: "#8b5cf6", marginTop: 2 }}>{g.budget}</div>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 상세 패널 */}
      <div style={{ flex: 1, overflowY: "auto", padding: "28px 32px" }}>
        {!s ? (
          <div style={{ textAlign: "center", color: "#374151", marginTop: 120 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>&#128209;</div>
            <div style={{ fontSize: 13 }}>공고를 선택하면 상세 분석이 표시됩니다</div>
          </div>
        ) : (
          <div style={{ maxWidth: 680 }}>
            <div style={{ fontSize: 20, fontWeight: 900, color: "#f8fafc", lineHeight: 1.4, marginBottom: 8 }}>{s.title}</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
              {[s.agency, s.deadline, s.budget, s.source].filter(Boolean).map((v, i) =>
                <span key={i} style={{ fontSize: 10, padding: "3px 10px", borderRadius: 5, background: "#ffffff08", color: "#9ca3af" }}>{v}</span>
              )}
            </div>
            {s.url && <a href={s.url} target="_blank" rel="noopener" style={{ fontSize: 11, color: "#3b82f6" }}>공고 원문 →</a>}
            <div style={{ marginTop: 16 }}>
              {s.reason && <p style={{ fontSize: 12, color: "#9ca3af", lineHeight: 1.8, marginBottom: 12 }}>{s.reason}</p>}

              {/* 분석 결과 */}
              {analyzing === s.title ? (
                <div style={{ padding: 30, textAlign: "center" }}>
                  <Spinner size={28}/>
                  <div style={{ fontSize: 12, color: "#8b5cf6", marginTop: 12, fontWeight: 600 }}>IRIS 상세 분석 중...</div>
                  <div style={{ fontSize: 10, color: "#4b5563", marginTop: 4 }}>공고 정보 수집 + 움틀 적합도 분석 (30초~1분)</div>
                </div>
              ) : an ? (
                <div style={{ marginBottom: 20 }}>
                  {/* 상단 스코어 카드 */}
                  <div style={{ background: "#0d1020", borderRadius: 14, padding: 20, border: "1px solid #ffffff09", marginBottom: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
                      <ScoreRing score={an.fitScore || 0} size={64}/>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                          <span style={{ fontSize: 22, fontWeight: 900, color: gColor(an.verdict) }}>{an.verdict}</span>
                          {an.recommendation && (
                            <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 5,
                              background: ({GO:"#10b98120",HOLD:"#f59e0b20","NO-GO":"#ef444420"})[an.recommendation] || "#ffffff08",
                              color: ({GO:"#10b981",HOLD:"#f59e0b","NO-GO":"#ef4444"})[an.recommendation] || "#9ca3af" }}>
                              {an.recommendation}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "#f1f5f9" }}>적합도 {an.fitScore}점</div>
                        {an.risk && <div style={{ fontSize: 10, color: "#6b7280", marginTop: 2 }}>주요 리스크: {an.risk}</div>}
                      </div>
                    </div>

                    {/* 전략/종합 의견 */}
                    {an.strategy && (
                      <div style={{ background: "#ffffff04", borderRadius: 8, padding: 12, marginBottom: 14 }}>
                        <div style={{ fontSize: 10, color: "#8b5cf6", fontWeight: 700, marginBottom: 4 }}>AI 종합 의견</div>
                        <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.7 }}>{an.strategy}</div>
                      </div>
                    )}

                    {/* 강점 / 보완점 그리드 */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      {[
                        ["강점", an.reasons, "#10b981"],
                        ["보완점", an.weaknesses, "#f59e0b"],
                        ["부합 역량", an.matchingCapabilities, "#3b82f6"],
                        ["부족 요건", an.missingRequirements, "#ef4444"],
                      ].filter(([, items]) => items && items.length > 0).map(([title, items, color]) => (
                        <div key={title} style={{ background: "#ffffff04", borderRadius: 8, padding: 10 }}>
                          <div style={{ fontSize: 10, color, fontWeight: 700, marginBottom: 6 }}>{title}</div>
                          {items.map((item, i) => <div key={i} style={{ fontSize: 11, color: "#94a3b8", padding: "2px 0", lineHeight: 1.5 }}>• {item}</div>)}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* RFP 요약 (있을 경우) */}
                  {an.rfp && an.rfp.objectives && (
                    <div style={{ background: "#0d1020", borderRadius: 14, padding: 16, border: "1px solid #ffffff09", marginBottom: 14 }}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: "#f1f5f9", marginBottom: 10 }}>📋 RFP 요약</div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        {[
                          ["목적", an.rfp.objectives],
                          ["범위", an.rfp.scope],
                          ["총예산", an.rfp.budget_total],
                          ["과제당", an.rfp.budget_per_project],
                          ["기간", an.rfp.duration],
                          ["자격", an.rfp.eligibility],
                          ["마감", an.rfp.deadline],
                          ["대응자금", an.rfp.matching_fund],
                        ].filter(([, v]) => v).map(([label, value]) => (
                          <div key={label}>
                            <div style={{ fontSize: 9, color: "#6b7280", marginBottom: 2 }}>{label}</div>
                            <div style={{ fontSize: 11, color: "#d1d5db", lineHeight: 1.5 }}>{value}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : null}

              {/* 버튼 */}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                <button onClick={() => onSelectGrant(s)}
                  style={{ padding: "10px 20px", borderRadius: 8, border: "none", background: "linear-gradient(135deg, #8b5cf6, #6366f1)", color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>
                  ✍️ 사업계획서 작성
                </button>
                <button onClick={() => saveGrant(s)} disabled={saved[s.title]}
                  style={{ padding: "10px 16px", borderRadius: 8, border: "1px solid #ffffff12", background: saved[s.title] ? "#10b98120" : "#ffffff06", color: saved[s.title] ? "#10b981" : "#9ca3af", cursor: "pointer", fontSize: 12 }}>
                  {saved[s.title] ? "✓ Slack 전송완료" : "Slack 공유"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── 사업계획서 탭 (파이프라인 통합) ──────────────────────────────────
function ProposalGenerator({ prefillGrant }) {
  // Step management: input -> rfpAnalysis -> proposal -> financial
  const [step, setStep] = useState(prefillGrant ? "input" : "input");
  const [info, setInfo] = useState({
    title: prefillGrant?.title || "",
    agency: prefillGrant?.agency || prefillGrant?.organization || "",
    budget: prefillGrant?.budget || "",
    url: prefillGrant?.url || "",
    summary: prefillGrant?.reason || prefillGrant?.summary || "",
    years: "3",
  });

  // RFP Analysis
  const [rfpLoading, setRfpLoading] = useState(false);
  const [rfpResult, setRfpResult] = useState(null);

  // Proposal
  const [generating, setGenerating] = useState(false);
  const [proposal, setProposal] = useState(null);
  const [activeSection, setActiveSection] = useState("overview");

  // Financial
  const [finLoading, setFinLoading] = useState(false);
  const [finResult, setFinResult] = useState(null);

  // Saving
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const SECTIONS = [
    { id: "overview", label: "과제 개요" },
    { id: "background", label: "배경·필요성" },
    { id: "goal", label: "최종 목표" },
    { id: "annual", label: "연차별 목표" },
    { id: "budget", label: "예산 편성" },
    { id: "commercialize", label: "사업화 계획" },
    { id: "effect", label: "기대효과" },
  ];

  const PIPELINE_STEPS = ["RFP 분석", "사업계획서", "재경분석"];

  // Step 1: RFP Analysis via IRIS
  async function analyzeRfp() {
    if (!info.title) return;
    setRfpLoading(true); setRfpResult(null);
    try {
      const data = await callIrisAnalyze({
        title: info.title,
        agency: info.agency,
        url: info.url,
        summary: info.summary,
      });
      setRfpResult(data);
      setStep("rfpResult");
    } catch (err) {
      console.error("RFP analysis error:", err);
      alert("RFP 분석 실패: " + (err.message || "다시 시도해주세요"));
    }
    finally { setRfpLoading(false); }
  }

  // Step 2: Generate proposal (enhanced with RFP data)
  async function generate() {
    setGenerating(true); setProposal(null);
    try {
      const rfpContext = rfpResult?.rfp ? `
RFP 분석 결과:
- 목적: ${rfpResult.rfp.objectives || "N/A"}
- 범위: ${rfpResult.rfp.scope || "N/A"}
- 총 예산: ${rfpResult.rfp.budget_total || info.budget}
- 과제당 예산: ${rfpResult.rfp.budget_per_project || "N/A"}
- 기간: ${rfpResult.rfp.duration || info.years + "년"}
- 자격요건: ${rfpResult.rfp.eligibility || "N/A"}
- 평가기준: ${rfpResult.rfp.evaluation_criteria || "N/A"}
- 핵심요구사항: ${rfpResult.rfp.key_requirements || "N/A"}
- 대응자금: ${rfpResult.rfp.matching_fund || "N/A"}` : "";

      const fitContext = rfpResult?.fit_analysis ? `
적합도 분석:
- 점수: ${rfpResult.fit_analysis.overall_score}/100
- 강점: ${rfpResult.fit_analysis.strengths?.join(", ") || "N/A"}
- 보완점: ${rfpResult.fit_analysis.weaknesses?.join(", ") || "N/A"}
- 부합 역량: ${rfpResult.fit_analysis.matching_capabilities?.join(", ") || "N/A"}` : "";

      const data = await callClaude({
        max_tokens: 4000,
        messages: [{
          role: "user",
          content: `한국 R&D 사업계획서 초안. 순수 JSON만 출력.

기업: ${UMTR.company} | ${UMTR.mainBiz}
현황: 파일럿 NC/PES 멤브레인 생산. ISO 13485. 삼성바이오로직스 공동실증 완료. R&D 연간 10억+. 오송 부지 확보.
문제: 바이오 소부장 국산화율 6%, GMP 생산시설 부재.
내러티브: "지금까지 핵심 기술을 확보해왔고 R&D 펀드로 대량생산 문제를 훌적 해결할 수 있다"
${rfpContext}
${fitContext}

공고: ${info.title} / ${info.agency} / ${info.budget || "N/A"} / ${info.years}년

{"grantTitle":"","agency":"","totalBudget":"","period":"","overview":{"applicant":"","summary":"","techField":""},"background":{"problem":"","necessity":"","marketSize":"","trend":"","gap":""},"finalGoal":{"statement":"","techGoals":[],"bizGoals":[]},"annualGoals":[{"year":1,"title":"","objectives":[],"milestones":[]}],"budgetOutline":[{"category":"","amount":"","ratio":""}],"commercialization":{"strategy":"","targetMarket":"","timeline":"","revenue":""},"expectedEffects":{"technical":[],"economic":[],"social":[]}}`,
        }],
      });
      const text = data.content?.[0]?.text || "{}";
      const m = text.match(/\{[\s\S]*\}/);
      if (m) {
        try {
          setProposal(JSON.parse(jsonrepair(m[0])));
        } catch {
          setProposal(JSON.parse(m[0]));
        }
      }
      setStep("proposal");
    } catch (err) {
      console.error("Generate error:", err);
      alert("생성 실패: " + (err.message || "다시 시도해주세요"));
    }
    finally { setGenerating(false); }
  }

  // Step 3: Financial Analysis
  async function runFinancial() {
    if (!proposal) return;
    setFinLoading(true); setFinResult(null);
    try {
      const data = await callClaude({
        max_tokens: 2000,
        messages: [{
          role: "user",
          content: `CFO 관점 재경분석. 순수 JSON만 출력.

기업: ${UMTR.company} | ${UMTR.mainBiz}
공고: ${proposal.grantTitle || info.title}
총 예산: ${proposal.totalBudget || info.budget}
기간: ${proposal.period || info.years + "년"}
사업화: ${proposal.commercialization?.strategy || "N/A"}
목표시장: ${proposal.commercialization?.targetMarket || "N/A"}
예상매출: ${proposal.commercialization?.revenue || "N/A"}

{"recommendation":"GO|HOLD|NO-GO","reason":"","costEstimate":{"totalProject":"","govFunding":"","selfFunding":"","matchingRatio":""},"roi":{"expectedReturn":"","paybackPeriod":"","irr":""},"cashFlow":{"year1":"","year2":"","year3":"","breakEven":""},"risks":[{"item":"","impact":"high|mid|low","mitigation":""}],"keyMetrics":[{"label":"","value":"","status":"good|warning|danger"}]}`,
        }],
      });
      const text = data.content?.[0]?.text || "{}";
      const m = text.match(/\{[\s\S]*\}/);
      if (m) {
        try {
          setFinResult(JSON.parse(jsonrepair(m[0])));
        } catch {
          setFinResult(JSON.parse(m[0]));
        }
      }
      setStep("financial");
    } catch (err) {
      alert("재경분석 실패: " + (err.message || "다시 시도"));
    }
    finally { setFinLoading(false); }
  }

  async function saveProposal() {
    if (!proposal) return;
    setSaving(true);
    try {
      await postToSlack("shareProposal", {
        title: proposal.grantTitle,
        agency: proposal.agency,
        budget: proposal.totalBudget,
        finalGoal: proposal.finalGoal?.statement,
        summary: proposal.overview?.summary,
        fitScore: rfpResult?.fit_analysis?.overall_score,
        recommendation: finResult?.recommendation,
      });
      setSaved(true);
    } catch { alert("Slack 전송 실패"); }
    finally { setSaving(false); }
  }

  const YC = ["#3b82f6", "#8b5cf6", "#10b981", "#f59e0b"];
  const recColor = r => ({ GO: "#10b981", HOLD: "#f59e0b", "NO-GO": "#ef4444" }[r] || "#6b7280");
  const stepIdx = step === "input" ? 0 : step === "rfpResult" ? 0 : step === "proposal" ? 1 : 2;

  // ===== INPUT FORM =====
  if (!proposal && !generating && step === "input" && !rfpLoading) return (
    <div style={{ maxWidth: 600, margin: "32px auto", padding: "0 24px" }}>
      <StepIndicator steps={PIPELINE_STEPS} current={0}/>
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <div style={{ fontSize: 28, marginBottom: 8 }}>✍️</div>
        <div style={{ fontSize: 18, fontWeight: 900, color: "#f1f5f9", marginBottom: 6 }}>사업계획서 파이프라인</div>
        <div style={{ fontSize: 12, color: "#6b7280" }}>공고 정보 → RFP 분석 → 초안 생성 → 재경분석</div>
      </div>

      <div style={{ background: "#0a0c15", borderRadius: 14, border: "1px solid #ffffff09", padding: 20 }}>
        {[
          { key: "title", label: "공고명 *", ph: "예: 바이오 소부장 기술개발 지원사업" },
          { key: "agency", label: "주관기관", ph: "예: 산업통상자원부" },
          { key: "budget", label: "예산규모", ph: "예: 30억원" },
          { key: "url", label: "공고 URL", ph: "https://..." },
          { key: "summary", label: "공고 요약", ph: "공고 내용 간략 입력 (선택)", rows: 3 },
        ].map(f => (
          <div key={f.key} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 5 }}>{f.label}</div>
            {f.rows ? (
              <textarea value={info[f.key]} onChange={e => setInfo(p => ({ ...p, [f.key]: e.target.value }))}
                placeholder={f.ph} rows={f.rows}
                style={{ width: "100%", background: "#ffffff06", border: "1px solid #ffffff09", borderRadius: 8, padding: "10px 14px", color: "#e2e8f0", fontSize: 13, outline: "none", resize: "vertical", fontFamily: "inherit" }}/>
            ) : (
              <input value={info[f.key]} onChange={e => setInfo(p => ({ ...p, [f.key]: e.target.value }))}
                placeholder={f.ph}
                style={{ width: "100%", background: "#ffffff06", border: "1px solid #ffffff09", borderRadius: 8, padding: "10px 14px", color: "#e2e8f0", fontSize: 13, outline: "none" }}/>
            )}
          </div>
        ))}

        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 5 }}>연구기간</div>
            <select value={info.years} onChange={e => setInfo(p => ({ ...p, years: e.target.value }))}
              style={{ width: "100%", background: "#ffffff06", border: "1px solid #ffffff09", borderRadius: 8, padding: "10px 14px", color: "#e2e8f0", fontSize: 13 }}>
              {["2", "3", "4", "5"].map(y => <option key={y} value={y}>{y}년</option>)}
            </select>
          </div>
        </div>

        <button onClick={analyzeRfp} disabled={!info.title}
          style={{ width: "100%", marginTop: 18, padding: "14px", borderRadius: 12, border: "none",
            background: info.title ? "linear-gradient(135deg, #8b5cf6, #6366f1)" : "#1e1e2e",
            color: info.title ? "#fff" : "#4b5563", cursor: info.title ? "pointer" : "default", fontSize: 14, fontWeight: 700 }}>
          \uD83D\uDD0D RFP 분석 시작
        </button>

        <button onClick={() => { setStep("proposal"); generate(); }} disabled={!info.title}
          style={{ width: "100%", marginTop: 8, padding: "10px", borderRadius: 10, border: "1px solid #ffffff12",
            background: "transparent", color: "#6b7280", cursor: "pointer", fontSize: 12 }}>
          RFP 분석 건너뛰고 바로 초안 생성 →
        </button>
      </div>
    </div>
  );

  // ===== LOADING STATES =====
  if (rfpLoading) return (
    <div style={{ maxWidth: 600, margin: "40px auto", padding: "0 24px" }}>
      <StepIndicator steps={PIPELINE_STEPS} current={0}/>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 0" }}>
        <Spinner size={36}/>
        <div style={{ marginTop: 20, fontSize: 14, fontWeight: 700, color: "#a78bfa" }}>RFP 분석 중...</div>
        <div style={{ marginTop: 8, fontSize: 12, color: "#4b5563" }}>IRIS/NTIS 공고 정보 수집 + 움틀 적합도 분석</div>
        <div style={{ marginTop: 4, fontSize: 11, color: "#374151" }}>30초~1분 소요</div>
      </div>
    </div>
  );

  if (generating) return (
    <div style={{ maxWidth: 600, margin: "40px auto", padding: "0 24px" }}>
      <StepIndicator steps={PIPELINE_STEPS} current={1}/>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 0" }}>
        <Spinner size={36}/>
        <div style={{ marginTop: 20, fontSize: 14, fontWeight: 700, color: "#a78bfa" }}>사업계획서 초안 생성 중...</div>
        <div style={{ marginTop: 8, fontSize: 12, color: "#4b5563" }}>움틀 프로필 + 공고 요건 + R&D 전략 반영</div>
      </div>
    </div>
  );

  // ===== RFP ANALYSIS RESULT =====
  if (step === "rfpResult" && rfpResult) {
    const fit = rfpResult.fit_analysis || {};
    const rfp = rfpResult.rfp || {};
    return (
      <div style={{ maxWidth: 700, margin: "28px auto", padding: "0 24px" }}>
        <StepIndicator steps={PIPELINE_STEPS} current={0}/>

        <div style={{ background: "#0a0c15", borderRadius: 14, border: "1px solid #ffffff09", padding: 24, marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
            <ScoreRing score={fit.overall_score || 0} size={72}/>
            <div>
              <div style={{ fontSize: 18, fontWeight: 900, color: "#f1f5f9" }}>적합도 분석 결과</div>
              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>{info.title}</div>
              <div style={{ display: "inline-block", marginTop: 8, padding: "4px 14px", borderRadius: 6, fontSize: 13, fontWeight: 700,
                background: recColor(fit.recommendation) + "20", color: recColor(fit.recommendation) }}>
                {fit.recommendation || "N/A"}
              </div>
            </div>
          </div>

          {fit.reason && <p style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.8, marginBottom: 16, padding: "12px", background: "#ffffff04", borderRadius: 8 }}>{fit.reason}</p>}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {[
              ["강점", fit.strengths, "#10b981"],
              ["보완점", fit.weaknesses, "#f59e0b"],
              ["부합 역량", fit.matching_capabilities, "#3b82f6"],
              ["부족 요건", fit.missing_requirements, "#ef4444"],
            ].map(([title, items, color]) => (
              <div key={title} style={{ background: "#ffffff04", borderRadius: 10, padding: 14 }}>
                <div style={{ fontSize: 10, color, fontWeight: 700, marginBottom: 8, textTransform: "uppercase" }}>{title}</div>
                {(items || []).map((item, i) => <div key={i} style={{ fontSize: 11, color: "#94a3b8", padding: "3px 0" }}>• {item}</div>)}
                {(!items || items.length === 0) && <div style={{ fontSize: 11, color: "#374151" }}>-</div>}
              </div>
            ))}
          </div>
        </div>

        {/* RFP 요약 */}
        {rfp.objectives && (
          <div style={{ background: "#0a0c15", borderRadius: 14, border: "1px solid #ffffff09", padding: 20, marginBottom: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: "#f1f5f9", marginBottom: 14 }}>RFP 요약</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {[
                ["목적", rfp.objectives],
                ["범위", rfp.scope],
                ["총예산", rfp.budget_total],
                ["과제당", rfp.budget_per_project],
                ["기간", rfp.duration],
                ["자격", rfp.eligibility],
                ["마감", rfp.deadline],
                ["대응자금", rfp.matching_fund],
              ].filter(([, v]) => v).map(([label, value]) => (
                <div key={label}>
                  <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 3 }}>{label}</div>
                  <div style={{ fontSize: 12, color: "#d1d5db", lineHeight: 1.6 }}>{value}</div>
                </div>
              ))}
            </div>
            {rfp.evaluation_criteria && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 3 }}>평가기준</div>
                <div style={{ fontSize: 12, color: "#d1d5db", lineHeight: 1.6 }}>{rfp.evaluation_criteria}</div>
              </div>
            )}
          </div>
        )}

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => { setStep("input"); setRfpResult(null); }}
            style={{ padding: "10px 18px", borderRadius: 10, border: "1px solid #ffffff12", background: "transparent", color: "#6b7280", cursor: "pointer", fontSize: 12 }}>
            ← 다시 입력
          </button>
          <button onClick={generate} disabled={generating}
            style={{ flex: 1, padding: "14px", borderRadius: 12, border: "none",
              background: "linear-gradient(135deg, #8b5cf6, #6366f1)", color: "#fff", cursor: "pointer", fontSize: 14, fontWeight: 700 }}>
            ✍️ 사업계획서 초안 생성
          </button>
        </div>
      </div>
    );
  }

  // ===== FINANCIAL ANALYSIS RESULT =====
  if (step === "financial" && finResult) {
    return (
      <div style={{ maxWidth: 700, margin: "28px auto", padding: "0 24px" }}>
        <StepIndicator steps={PIPELINE_STEPS} current={2}/>
        <div style={{ background: "#0a0c15", borderRadius: 14, border: "1px solid #ffffff09", padding: 24, marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
            <div style={{ fontSize: 36, fontWeight: 900, color: recColor(finResult.recommendation) }}>
              {finResult.recommendation}
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 900, color: "#f1f5f9" }}>CFO 재경분석</div>
              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>{finResult.reason}</div>
            </div>
          </div>

          {/* Cost Estimate */}
          {finResult.costEstimate && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#a78bfa", marginBottom: 10 }}>사업비 구조</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10 }}>
                {[
                  ["총 사업비", finResult.costEstimate.totalProject],
                  ["정부출연", finResult.costEstimate.govFunding],
                  ["자부담", finResult.costEstimate.selfFunding],
                  ["비율", finResult.costEstimate.matchingRatio],
                ].map(([label, value]) => (
                  <div key={label} style={{ background: "#ffffff04", borderRadius: 8, padding: 12 }}>
                    <div style={{ fontSize: 10, color: "#6b7280" }}>{label}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#f1f5f9", marginTop: 4 }}>{value || "-"}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ROI */}
          {finResult.roi && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#10b981", marginBottom: 10 }}>ROI 분석</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                {[
                  ["기대수익", finResult.roi.expectedReturn],
                  ["회수기간", finResult.roi.paybackPeriod],
                  ["IRR", finResult.roi.irr],
                ].map(([label, value]) => (
                  <div key={label} style={{ background: "#ffffff04", borderRadius: 8, padding: 12 }}>
                    <div style={{ fontSize: 10, color: "#6b7280" }}>{label}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#10b981", marginTop: 4 }}>{value || "-"}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Cash Flow */}
          {finResult.cashFlow && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#3b82f6", marginBottom: 10 }}>현금흐름</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10 }}>
                {[
                  ["1차년", finResult.cashFlow.year1],
                  ["2차년", finResult.cashFlow.year2],
                  ["3차년", finResult.cashFlow.year3],
                  ["BEP", finResult.cashFlow.breakEven],
                ].map(([label, value]) => (
                  <div key={label} style={{ background: "#ffffff04", borderRadius: 8, padding: 12 }}>
                    <div style={{ fontSize: 10, color: "#6b7280" }}>{label}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#d1d5db", marginTop: 4 }}>{value || "-"}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Risks */}
          {finResult.risks?.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#f59e0b", marginBottom: 10 }}>위험 요소</div>
              {finResult.risks.map((r, i) => (
                <div key={i} style={{ background: "#ffffff04", borderRadius: 8, padding: 12, marginBottom: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 12, color: "#d1d5db" }}>{r.item}</span>
                    <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4,
                      background: r.impact === "high" ? "#ef444420" : r.impact === "mid" ? "#f59e0b20" : "#10b98120",
                      color: r.impact === "high" ? "#ef4444" : r.impact === "mid" ? "#f59e0b" : "#10b981" }}>{r.impact}</span>
                  </div>
                  {r.mitigation && <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>대응: {r.mitigation}</div>}
                </div>
              ))}
            </div>
          )}

          {/* Key Metrics */}
          {finResult.keyMetrics?.length > 0 && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#8b5cf6", marginBottom: 10 }}>핵심 지표</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                {finResult.keyMetrics.map((m, i) => (
                  <div key={i} style={{ background: "#ffffff04", borderRadius: 8, padding: 12, textAlign: "center" }}>
                    <div style={{ fontSize: 10, color: "#6b7280" }}>{m.label}</div>
                    <div style={{ fontSize: 16, fontWeight: 800, marginTop: 4,
                      color: m.status === "good" ? "#10b981" : m.status === "warning" ? "#f59e0b" : "#ef4444" }}>{m.value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => setStep("proposal")}
            style={{ padding: "10px 18px", borderRadius: 10, border: "1px solid #ffffff12", background: "transparent", color: "#6b7280", cursor: "pointer", fontSize: 12 }}>
            ← 사업계획서
          </button>
          <button onClick={saveProposal} disabled={saving || saved}
            style={{ flex: 1, padding: "14px", borderRadius: 12, border: "none",
              background: saved ? "#10b98140" : "linear-gradient(135deg, #10b981, #059669)", color: "#fff", cursor: "pointer", fontSize: 14, fontWeight: 700 }}>
            {saved ? "✓ Slack 전송 완료" : "\uD83D\uDCE4 Slack으로 전체 보고"}
          </button>
        </div>
      </div>
    );
  }

  // ===== PROPOSAL VIEW =====
  if (!proposal) return null;
  return (
    <div style={{ display: "flex", height: "calc(100vh - 112px)" }}>
      {/* 사이드바 */}
      <div style={{ width: 180, borderRight: "1px solid #ffffff09", background: "#0a0c15", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "14px 14px 6px", fontSize: 9, color: "#4b5563", fontFamily: "monospace" }}>PROPOSAL SECTIONS</div>
        {SECTIONS.map(sec => (
          <button key={sec.id} onClick={() => setActiveSection(sec.id)}
            style={{ width: "100%", padding: "9px 14px", border: "none", background: activeSection === sec.id ? "#1a1f35" : "transparent",
              color: activeSection === sec.id ? "#a78bfa" : "#6b7280", textAlign: "left", cursor: "pointer", fontSize: 12, borderLeft: `2px solid ${activeSection === sec.id ? "#8b5cf6" : "transparent"}` }}>
            {sec.label}
          </button>
        ))}
        <div style={{ padding: "14px", marginTop: 8, borderTop: "1px solid #ffffff09" }}>
          {!finResult && (
            <button onClick={runFinancial} disabled={finLoading}
              style={{ width: "100%", padding: "8px", borderRadius: 8, border: "none", background: "linear-gradient(135deg, #f59e0b40, #f97316 40)", color: "#fbbf24", cursor: "pointer", fontSize: 11, fontWeight: 700, marginBottom: 6 }}>
              {finLoading ? <Spinner size={14} color="#fbbf24"/> : "\uD83D\uDCCA 재경분석"}
            </button>
          )}
          {finResult && (
            <button onClick={() => setStep("financial")}
              style={{ width: "100%", padding: "8px", borderRadius: 8, border: "none", background: "#10b98120", color: "#10b981", cursor: "pointer", fontSize: 11, fontWeight: 700, marginBottom: 6 }}>
              ✓ 재경분석 보기
            </button>
          )}
          <button onClick={saveProposal} disabled={saving || saved}
            style={{ width: "100%", padding: "8px", borderRadius: 8, border: "none", background: saved ? "#10b98120" : "#8b5cf620", color: saved ? "#10b981" : "#a78bfa", cursor: "pointer", fontSize: 11, marginBottom: 6 }}>
            {saved ? "✓ Slack 전송완료" : "Slack 보고"}
          </button>
          <button onClick={() => { setProposal(null); setRfpResult(null); setFinResult(null); setStep("input"); setSaved(false); }}
            style={{ width: "100%", marginTop: 4, padding: "6px", borderRadius: 8, border: "1px solid #ffffff09", background: "transparent", color: "#4b5563", cursor: "pointer", fontSize: 10 }}>
            처음부터
          </button>
        </div>

        {/* RFP 적합도 미니 */}
        {rfpResult?.fit_analysis && (
          <div style={{ padding: "0 14px 14px", marginTop: "auto" }}>
            <div style={{ background: "#ffffff04", borderRadius: 8, padding: 10, textAlign: "center" }}>
              <div style={{ fontSize: 9, color: "#6b7280", marginBottom: 4 }}>적합도</div>
              <ScoreRing score={rfpResult.fit_analysis.overall_score || 0} size={44}/>
              <div style={{ fontSize: 10, marginTop: 4, fontWeight: 700,
                color: recColor(rfpResult.fit_analysis.recommendation) }}>
                {rfpResult.fit_analysis.recommendation}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 본문 */}
      <div style={{ flex: 1, overflowY: "auto", padding: "28px 36px" }}>
        <div style={{ maxWidth: 720 }}>
          <div style={{ marginBottom: 28, paddingBottom: 20, borderBottom: "1px solid #ffffff09" }}>
            <div style={{ fontSize: 10, color: "#8b5cf6", fontFamily: "monospace", marginBottom: 6 }}>GRANTIQ · 사업계획서 초안</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: "#f8fafc", lineHeight: 1.4 }}>{proposal.grantTitle || info.title}</div>
            <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
              {[proposal.agency, proposal.period, proposal.totalBudget, UMTR.company].map((v, i) =>
                v ? <span key={i} style={{ fontSize: 11, padding: "3px 10px", borderRadius: 5, background: "#ffffff08", color: "#9ca3af" }}>{v}</span> : null
              )}
            </div>
          </div>

          {/* Section Contents */}
          {activeSection === "overview" && proposal.overview && (
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: "#f1f5f9", marginBottom: 14 }}>1. 과제 개요</h3>
              <p style={{ fontSize: 12, color: "#9ca3af", lineHeight: 1.8 }}>{proposal.overview.summary}</p>
              <div style={{ background: "#3b82f610", borderRadius: 8, padding: "12px 14px", border: "1px solid #3b82f620", marginTop: 14 }}>
                <div style={{ fontSize: 10, color: "#3b82f6", fontWeight: 700, marginBottom: 4 }}>신청자</div>
                <div style={{ fontSize: 12, color: "#d1d5db" }}>{proposal.overview.applicant}</div>
                {proposal.overview.techField && <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>기술분야: {proposal.overview.techField}</div>}
              </div>
            </div>
          )}

          {activeSection === "background" && proposal.background && (
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: "#f1f5f9", marginBottom: 14 }}>2. 배경 및 필요성</h3>
              <p style={{ fontSize: 12, color: "#9ca3af", lineHeight: 1.9, whiteSpace: "pre-wrap" }}>
                {[proposal.background.problem, proposal.background.necessity, proposal.background.marketSize, proposal.background.trend, proposal.background.gap].filter(Boolean).join("\n\n")}
              </p>
            </div>
          )}

          {activeSection === "goal" && proposal.finalGoal && (
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: "#f1f5f9", marginBottom: 14 }}>3. 최종 목표</h3>
              <div style={{ background: "#10b98110", borderRadius: 8, padding: "14px", border: "1px solid #10b98120", marginBottom: 16 }}>
                <p style={{ fontSize: 13, color: "#d1d5db", fontWeight: 600 }}>{proposal.finalGoal.statement}</p>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {[
                  ["기술 목표", proposal.finalGoal.techGoals, "#3b82f6"],
                  ["사업화 목표", proposal.finalGoal.bizGoals, "#10b981"],
                ].map(([title, items, color]) => (
                  <div key={title} style={{ background: "#ffffff05", borderRadius: 8, padding: "14px" }}>
                    <div style={{ fontSize: 10, color, fontWeight: 700, marginBottom: 8, textTransform: "uppercase" }}>{title}</div>
                    {items?.map((g, i) => <div key={i} style={{ fontSize: 11, color: "#94a3b8", padding: "3px 0" }}>• {g}</div>)}
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeSection === "annual" && proposal.annualGoals && (
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: "#f1f5f9", marginBottom: 14 }}>4. 연차별 목표</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {proposal.annualGoals.map((g, i) => (
                  <div key={i} style={{ background: "#0d1020", borderRadius: 12, border: `1px solid ${YC[i]}30`, padding: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                      <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, background: YC[i] + "20", color: YC[i], fontWeight: 700 }}>{g.year || i+1}차년</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#f1f5f9" }}>{g.title}</span>
                    </div>
                    {g.objectives?.map((o, j) => <div key={j} style={{ fontSize: 11, color: "#94a3b8", padding: "2px 0" }}>• {o}</div>)}
                    {g.milestones?.length > 0 && (
                      <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid #ffffff06" }}>
                        <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 4 }}>Milestones</div>
                        {g.milestones.map((m, j) => <div key={j} style={{ fontSize: 11, color: "#8b5cf6" }}>→ {m}</div>)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeSection === "budget" && proposal.budgetOutline && (
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: "#f1f5f9", marginBottom: 14 }}>5. 예산 편성</h3>
              <div style={{ background: "#0d1020", borderRadius: 12, overflow: "hidden", border: "1px solid #ffffff09" }}>
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", padding: "8px 14px", background: "#ffffff06", fontSize: 10, color: "#6b7280", fontWeight: 600 }}>
                  <span>항목</span><span>금액</span><span>비율</span>
                </div>
                {proposal.budgetOutline.map((b, i) => (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", padding: "10px 14px", borderTop: "1px solid #ffffff06", fontSize: 12 }}>
                    <span style={{ color: "#d1d5db" }}>{b.category}</span>
                    <span style={{ color: "#a78bfa", fontWeight: 600 }}>{b.amount}</span>
                    <span style={{ color: "#6b7280" }}>{b.ratio}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeSection === "commercialize" && proposal.commercialization && (
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: "#f1f5f9", marginBottom: 14 }}>6. 사업화 계획</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {[
                  ["전략", proposal.commercialization.strategy, "#8b5cf6"],
                  ["목표시장", proposal.commercialization.targetMarket, "#3b82f6"],
                  ["타임라인", proposal.commercialization.timeline, "#10b981"],
                  ["예상매출", proposal.commercialization.revenue, "#f59e0b"],
                ].map(([title, value, color]) => (
                  <div key={title} style={{ background: "#ffffff05", borderRadius: 8, padding: 14 }}>
                    <div style={{ fontSize: 10, color, fontWeight: 700, marginBottom: 6 }}>{title}</div>
                    <div style={{ fontSize: 12, color: "#d1d5db", lineHeight: 1.6 }}>{value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeSection === "effect" && proposal.expectedEffects && (
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: "#f1f5f9", marginBottom: 14 }}>7. 기대효과</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                {[
                  ["기술적", proposal.expectedEffects.technical, "#3b82f6"],
                  ["경제적", proposal.expectedEffects.economic, "#10b981"],
                  ["사회적", proposal.expectedEffects.social, "#f59e0b"],
                ].map(([title, items, color]) => (
                  <div key={title} style={{ background: "#ffffff05", borderRadius: 8, padding: 14 }}>
                    <div style={{ fontSize: 10, color, fontWeight: 700, marginBottom: 8 }}>{title}</div>
                    {(items || []).map((item, i) => <div key={i} style={{ fontSize: 11, color: "#94a3b8", padding: "3px 0" }}>• {item}</div>)}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── 메인 앱 ────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState("search");
  const [prefillGrant, setPrefillGrant] = useState(null);

  function handleSelectGrant(grant) {
    setPrefillGrant(grant);
    setTab("proposal");
  }

  const TABS = [
    { id: "search", label: "\uD83D\uDD0D 공고 탐색" },
    { id: "proposal", label: "✍️ 사업계획서" },
  ];

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#060810", color: "#e2e8f0", fontFamily: "'Noto Sans KR', -apple-system, sans-serif" }}>
      <Head>
        <title>GRANTIQ — {UMTR.company}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1"/>
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;900&display=swap" rel="stylesheet"/>
      </Head>
      <style>{`*{box-sizing:border-box;margin:0;padding:0} @keyframes spin{to{transform:rotate(360deg)}} @keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}} ::selection{background:#8b5cf640} input::placeholder,textarea::placeholder{color:#374151} ::-webkit-scrollbar{width:6px} ::-webkit-scrollbar-thumb{background:#ffffff12;border-radius:3px}`}</style>

      {/* 헤더 */}
      <div style={{ padding: "0 28px", borderBottom: "1px solid #ffffff09", background: "#0a0c15", display: "flex", alignItems: "center", height: 52 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginRight: 32 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: "linear-gradient(135deg, #8b5cf6, #3b82f6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>⚡</div>
          <span style={{ fontSize: 14, fontWeight: 900 }}>GRANTIQ</span>
        </div>
        {/* 탭 */}
        <div style={{ display: "flex", height: "100%", gap: 2 }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{ padding: "0 18px", border: "none", background: "transparent", color: tab === t.id ? "#e2e8f0" : "#4b5563", fontSize: 13, cursor: "pointer", borderBottom: `2px solid ${tab === t.id ? "#8b5cf6" : "transparent"}`, fontWeight: tab === t.id ? 700 : 400 }}>
              {t.label}
            </button>
          ))}
        </div>
        {/* 기업 표시 */}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#10b981", animation: "pulse 2s infinite" }}/>
          <span style={{ fontSize: 11, color: "#10b981" }}>실시간 검색</span>
          <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 5, background: "#3b82f620", color: "#3b82f6" }}>{UMTR.company}</span>
        </div>
      </div>

      {/* 콘텐츠 */}
      {tab === "search" && <GrantSearch onSelectGrant={handleSelectGrant}/>}
      {tab === "proposal" && <ProposalGenerator prefillGrant={prefillGrant}/>}
    </div>
  );
}
