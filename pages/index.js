// pages/index.js — GRANTIQ 메인 대시보드 (대표/임원용)
import { useState } from "react";
import Head from "next/head";

// ─── 공통 상수 ────────────────────────────────────────────────────────────────
const UMTR = {
  company: process.env.NEXT_PUBLIC_COMPANY_NAME || "㈜움틀",
  mainBiz: "바이오산업용 NC/PES 멤브레인·필터 연구개발·제조",
  keywords: ["바이오 멤브레인", "소부장 국산화", "PES 멤브레인", "NC 멤브레인", "TFF 모듈", "제균필터", "GMP", "체외진단기기", "ISO13485"],
};

const PRESET_QUERIES = [
  { label: "바이오 소부장", q: "바이오 소부장 R&D 지원사업 공고 2025 2026" },
  { label: "멤브레인 기술개발", q: "멤브레인 필터 기술개발 정부 R&D 공고 2026" },
  { label: "산업부 소부장", q: "산업통상자원부 소재부품장비 R&D 공고 2026" },
  { label: "중기부 스케일업", q: "중소벤처기업부 기술혁신 스케일업 지원 공고" },
  { label: "체외진단", q: "체외진단기기 멤브레인 소재 R&D 공고 2026" },
  { label: "오송 바이오", q: "오송 바이오헬스 첨단의료 R&D 지원 공고 충북" },
];

// ─── API 호출 헬퍼 ─────────────────────────────────────────────────────────────
async function callClaude({ messages, system, tools, tool_choice, max_tokens = 1500 }) {
  const res = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, system, tools, tool_choice, max_tokens }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "HTTP " + res.status }));
    throw new Error(err.error || "Claude API " + res.status);
  }
  return res.json();
}

async function postToSlack(action, data) {
  const res = await fetch("/api/slack", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, data }),
  });
  return res.json();
}

// ─── 공통 컴포넌트 ─────────────────────────────────────────────────────────────
function ScoreRing({ score, size = 52 }) {
  const r = size / 2 - 5;
  const circ = 2 * Math.PI * r;
  const filled = (score / 100) * circ;
  const color = score >= 70 ? "#10b981" : score >= 45 ? "#f59e0b" : "#6b7280";
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)", flexShrink: 0 }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#ffffff12" strokeWidth={4.5}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={4.5}
        strokeDasharray={`${filled} ${circ}`} strokeLinecap="round"
        style={{ transition: "stroke-dasharray 0.6s ease" }}/>
      <text x={size/2} y={size/2+1} textAnchor="middle" dominantBaseline="middle"
        fill={color} fontSize={size < 44 ? 9 : 12} fontWeight="800"
        style={{ transform: `rotate(90deg) translate(0,-${size}px)`, fontFamily: "monospace" }}>
        {score}
      </text>
    </svg>
  );
}

function Spinner({ size = 20, color = "#8b5cf6" }) {
  return (
    <div style={{ width: size, height: size, borderRadius: "50%",
      border: `${size * 0.15}px solid ${color}30`,
      borderTop: `${size * 0.15}px solid ${color}`,
      animation: "spin 0.8s linear infinite", flexShrink: 0 }} />
  );
}

// ─── 공고 탐색 탭 ─────────────────────────────────────────────────────────────
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
          content: `한국 정부 R&D 공고 검색: "${sq}"\n기업: ${UMTR.company} (${UMTR.mainBiz})\n키워드: ${UMTR.keywords.join(", ")}\n\n웹 검색 후 JSON만 반환:\n{"grants":[{"title":"","agency":"","budget":"","deadline":"","period":"","summary":"","url":"","matchScore":0-100,"matchReasons":[]}],"searchSummary":""}`,
        }],
      });
      const text = data.content?.find(b => b.type === "text")?.text || "{}";
      let cleanText = text.replace(/```json\n?|```\n?/g, "").trim();
      const m = cleanText.match(/\{[\s\S]*\}/);
      let parsed = { grants: [] };
      if (m) { try { parsed = JSON.parse(m[0]); } catch(e) { console.error("JSON parse error:", e); } }
      const sorted = (parsed.grants || []).sort((a, b) => (b.matchScore||0) - (a.matchScore||0));
      setGrants(sorted);
      setStatus(parsed.searchSummary || `${sorted.length}개 공고`);
    } catch (err) { console.error(err); setStatus(err.message || "검색 실패"); }
    finally { setSearching(false); }
  }

  async function analyze(grant) {
    if (analysis[grant.title]) return;
    setAnalyzing(grant.title);
    try {
      const data = await callClaude({
        messages: [{
          role: "user",
          content: `기업: ${UMTR.company} | ${UMTR.mainBiz} | 키워드: ${UMTR.keywords.join(", ")}\n공고: ${grant.title} / ${grant.agency} / ${grant.summary}\n\nJSON만: {"score":0-100,"grade":"S/A/B/C","verdict":"한줄결론","strengths":["",""],"weaknesses":["",""],"strategy":"전략 2문장"}`,
        }],
      });
      const text = data.content?.[0]?.text || "{}";
      const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
      setAnalysis(p => ({ ...p, [grant.title]: parsed }));
    } catch { setAnalyzing(null); }
    finally { setAnalyzing(null); }
  }

  async function saveGrant(grant) {
    try {
      const an = analysis[grant.title];
      await postToSlack("shareGrant", { ...grant, verdict: an?.verdict });
      setSaved(p => ({ ...p, [grant.title]: true }));
    } catch { alert("Slack 전송 실패. .env SLACK_WEBHOOK_URL 확인"); }
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
              style={{ flex: 1, background: "#ffffff08", border: "1px solid #ffffff09", borderRadius: 8, color: "#e2e8f0", fontSize: 12, padding: "9px 12px", outline: "none", fontFamily: "inherit" }}/>
            <button onClick={() => search()} disabled={searching}
              style={{ padding: "9px 16px", borderRadius: 8, border: "none", background: searching ? "#1f2937" : "linear-gradient(135deg,#3b82f6,#8b5cf6)", color: searching ? "#4b5563" : "#fff", fontSize: 12, fontWeight: 700, cursor: searching ? "not-allowed" : "pointer" }}>
              {searching ? <Spinner size={16} color="#6b7280"/> : "검색"}
            </button>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {PRESET_QUERIES.map(p => (
              <button key={p.label} onClick={() => { setQuery(p.q); search(p.q); }}
                style={{ fontSize: 10, padding: "3px 9px", borderRadius: 5, border: "1px solid #ffffff09", background: "#ffffff05", color: "#94a3b8", cursor: "pointer" }}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
        {/* 상태 */}
        {status && (
          <div style={{ padding: "8px 16px", fontSize: 11, color: searching ? "#8b5cf6" : "#10b981", background: "#0a0d14", borderBottom: "1px solid #ffffff09", display: "flex", gap: 8, alignItems: "center" }}>
            {searching && <Spinner size={12} color="#8b5cf6"/>} {status}
          </div>
        )}
        {/* 리스트 */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {grants.length === 0 && !searching && (
            <div style={{ padding: "50px 20px", textAlign: "center", color: "#374151" }}>
              <div style={{ fontSize: 28, marginBottom: 10 }}>🔍</div>
              <div style={{ fontSize: 12 }}>위 버튼으로 공고를 검색해보세요</div>
            </div>
          )}
          {grants.map((g, i) => (
            <div key={i} onClick={() => { setSelected(g); analyze(g); }}
              style={{ padding: "12px 14px", borderBottom: "1px solid #ffffff06", cursor: "pointer",
                background: s?.title === g.title ? "#1a1f35" : "transparent",
                borderLeft: `3px solid ${s?.title === g.title ? "#3b82f6" : "transparent"}` }}>
              <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <ScoreRing score={g.matchScore||0} size={46}/>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", gap: 5, marginBottom: 5, flexWrap: "wrap" }}>
                    {(g.matchScore||0) >= 70 && <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 4, background: "#10b98120", color: "#10b981", border: "1px solid #10b98140", fontWeight: 700 }}>🎯 강력매칭</span>}
                    {g.agency && <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 4, background: "#3b82f615", color: "#60a5fa", border: "1px solid #3b82f625" }}>{g.agency}</span>}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#f1f5f9", lineHeight: 1.4, marginBottom: 4 }}>{g.title}</div>
                  <div style={{ fontSize: 10, color: "#6b7280" }}>{g.budget} · 마감 {g.deadline}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 상세 패널 */}
      <div style={{ flex: 1, overflowY: "auto", padding: "24px 28px" }}>
        {!s ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", color: "#374151" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>📡</div>
            <div style={{ fontSize: 14, color: "#6b7280" }}>공고를 선택하면 AI 분석이 시작돼요</div>
          </div>
        ) : (
          <div style={{ maxWidth: 620 }}>
            {/* 공고 카드 */}
            <div style={{ background: "#0a0c15", borderRadius: 14, border: "1px solid #ffffff09", padding: "20px 22px", marginBottom: 18 }}>
              <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                {s.agency && <span style={{ fontSize: 10, padding: "3px 9px", borderRadius: 5, background: "#3b82f615", color: "#60a5fa", border: "1px solid #3b82f625" }}>{s.agency}</span>}
                {s.deadline && <span style={{ fontSize: 10, color: "#6b7280" }}>📅 {s.deadline}</span>}
              </div>
              <div style={{ fontSize: 17, fontWeight: 900, color: "#f1f5f9", lineHeight: 1.4, marginBottom: 10 }}>{s.title}</div>
              {s.budget && <div style={{ fontSize: 13, color: "#fcd34d", fontWeight: 700, marginBottom: 10 }}>💰 {s.budget}</div>}
              <div style={{ fontSize: 12, color: "#9ca3af", lineHeight: 1.8, background: "#ffffff05", borderRadius: 8, padding: "12px 14px", marginBottom: 12 }}>{s.summary}</div>
              <div style={{ display: "flex", gap: 8 }}>
                {s.url && s.url !== "#" && (
                  <a href={s.url} target="_blank" rel="noreferrer"
                    style={{ fontSize: 11, color: "#60a5fa", padding: "6px 14px", borderRadius: 7, border: "1px solid #3b82f630", textDecoration: "none" }}>
                    🔗 원문 바로가기
                  </a>
                )}
                <button onClick={() => saveGrant(s)}
                  style={{ fontSize: 11, padding: "6px 14px", borderRadius: 7, border: "none", background: saved[s.title] ? "#10b98120" : "#ffffff08", color: saved[s.title] ? "#10b981" : "#94a3b8", cursor: "pointer" }}>
                  {saved[s.title] ? "✓ Slack 공유됨" : "💬 Slack에 공유"}
                </button>
                <button onClick={() => onSelectGrant(s)}
                  style={{ fontSize: 11, padding: "6px 14px", borderRadius: 7, border: "none", background: "linear-gradient(135deg,#3b82f6,#8b5cf6)", color: "#fff", fontWeight: 700, cursor: "pointer", marginLeft: "auto" }}>
                  ✍️ 사업계획서 작성
                </button>
              </div>
            </div>

            {/* AI 분석 */}
            <div style={{ background: "#0a0c15", borderRadius: 14, border: "1px solid #ffffff09", overflow: "hidden" }}>
              <div style={{ padding: "12px 18px", borderBottom: "1px solid #ffffff09", display: "flex", alignItems: "center", gap: 10, background: "#0d1020" }}>
                <span style={{ fontSize: 12, fontWeight: 700 }}>✦ AI 매칭 분석</span>
                {analyzing === s.title && <Spinner size={14}/>}
                {an && <span style={{ marginLeft: "auto", fontSize: 11, padding: "2px 9px", borderRadius: 5, background: gColor(an.grade)+"20", color: gColor(an.grade), border: `1px solid ${gColor(an.grade)}40`, fontWeight: 800 }}>등급 {an.grade} · {an.score}점</span>}
              </div>
              {an ? (
                <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ background: "#3b82f610", borderRadius: 8, padding: "12px", border: "1px solid #3b82f625", fontSize: 12, color: "#93c5fd", lineHeight: 1.7 }}>💬 {an.verdict}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div style={{ background: "#10b98108", borderRadius: 8, padding: "12px", border: "1px solid #10b98120" }}>
                      <div style={{ fontSize: 10, color: "#10b981", fontWeight: 700, marginBottom: 7 }}>✅ 강점</div>
                      {an.strengths?.map((s2, i) => <div key={i} style={{ fontSize: 11, color: "#d1fae5", padding: "2px 0", lineHeight: 1.5 }}>· {s2}</div>)}
                    </div>
                    <div style={{ background: "#f59e0b08", borderRadius: 8, padding: "12px", border: "1px solid #f59e0b20" }}>
                      <div style={{ fontSize: 10, color: "#f59e0b", fontWeight: 700, marginBottom: 7 }}>⚠️ 보완점</div>
                      {an.weaknesses?.map((w, i) => <div key={i} style={{ fontSize: 11, color: "#fef3c7", padding: "2px 0", lineHeight: 1.5 }}>· {w}</div>)}
                    </div>
                  </div>
                  <div style={{ background: "#8b5cf608", borderRadius: 8, padding: "12px", border: "1px solid #8b5cf620", fontSize: 12, color: "#ddd6fe", lineHeight: 1.7 }}>
                    <span style={{ fontSize: 10, color: "#a78bfa", fontWeight: 700, display: "block", marginBottom: 5 }}>📋 전략</span>
                    {an.strategy}
                  </div>
                </div>
              ) : (
                <div style={{ padding: "24px", textAlign: "center", color: "#6b7280", fontSize: 12 }}>
                  {analyzing === s.title ? "분석 중..." : "공고 선택 시 자동 분석됩니다"}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── 사업계획서 탭 ─────────────────────────────────────────────────────────────
function ProposalGenerator({ prefillGrant }) {
  const [info, setInfo] = useState({
    title: prefillGrant?.title || "",
    agency: prefillGrant?.agency || "",
    budget: prefillGrant?.budget || "",
    years: "3",
  });
  const [generating, setGenerating] = useState(false);
  const [proposal, setProposal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeSection, setActiveSection] = useState("overview");

  const SECTIONS = [
    { id: "overview", label: "과제 개요" },
    { id: "background", label: "배경·필요성" },
    { id: "goal", label: "최종 목표" },
    { id: "annual", label: "연차별 목표" },
    { id: "budget", label: "예산 편성" },
    { id: "commercialize", label: "사업화 계획" },
    { id: "effect", label: "기대효과" },
  ];

  async function generate() {
    if (!info.title) return;
    setGenerating(true); setProposal(null);
    try {
      const data = await callClaude({
        max_tokens: 2000,
        messages: [{
          role: "user",
          content: `한국 R&D 사업계획서 초안. 순수 JSON만 출력.

기업: ${UMTR.company} | ${UMTR.mainBiz}
현황: 파일럿 NC/PES 멤브레인 생산. ISO 13485. 삼성바이오로직스 공동실증 완료. R&D 연간 10억+. 오송 부지 확보.
문제: 바이오 소부장 국산화율 6%, GMP 생산시설 부재.
내러티브: "지금까지 핵심 기술을 확보해왔고 R&D 펀드로 대량생산 문제를 훌쩍 해결할 수 있다"

공고: ${info.title} / ${info.agency} / ${info.budget} / ${info.years}년

{"grantTitle":"","agency":"","totalBudget":"","period":"","overview":{"applicant":"","summary":""},"background":"배경 4문단","finalGoal":{"statement":"","techGoals":[],"bizGoals":[]},"annualGoals":[{"year":1,"title":"","budget":"","milestone":"","kpi":[],"content":"","tasks":[{"id":"t1","name":"","category":"기술개발","startQ":1,"endQ":3,"year":1}]}],"budget":{"items":[{"name":"인건비","y1":"","y2":"","y3":"","total":""},{"name":"직접비","y1":"","y2":"","y3":"","total":""},{"name":"합계","y1":"","y2":"","y3":"","total":"${info.budget}","isTotal":true}],"note":""},"commercialize":{"strategy":"","targets":[],"revenueGoal":"","roadmap":[]},"effect":{"tech":[],"economy":[],"social":[],"summary":""}}`,
        }],
      });
      const text = data.content?.[0]?.text || "{}";
      const m = text.match(/\{[\s\S]*\}/);
      if (m) setProposal(JSON.parse(m[0]));
    } catch { alert("생성 실패. 다시 시도해주세요."); }
    finally { setGenerating(false); }
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
      });
      setSaved(true);
    } catch { alert("Slack 전송 실패"); }
    finally { setSaving(false); }
  }

  const YC = ["#3b82f6", "#8b5cf6", "#10b981", "#f59e0b"];

  if (!proposal && !generating) return (
    <div style={{ maxWidth: 580, margin: "40px auto", padding: "0 24px" }}>
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <div style={{ fontSize: 28, marginBottom: 10 }}>✍️</div>
        <div style={{ fontSize: 18, fontWeight: 900, color: "#f1f5f9", marginBottom: 6 }}>사업계획서 초안 생성</div>
        <div style={{ fontSize: 12, color: "#6b7280" }}>공고 정보를 입력하면 Claude가 움틀 맞춤 초안을 자동 작성합니다</div>
      </div>
      <div style={{ background: "#0a0c15", borderRadius: 14, border: "1px solid #ffffff09", padding: "20px 22px", marginBottom: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        {[["과제명", "title", "GMP급 바이오 멤브레인 대량생산 기술 개발..."], ["주관기관", "agency", "산업통상자원부"], ["총 예산", "budget", "34.4억원"], ["기간(년)", "years", "3"]].map(([label, key, ph]) => (
          <div key={key}>
            <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 5 }}>{label}</div>
            <input value={info[key]} onChange={e => setInfo(p => ({...p, [key]: e.target.value}))} placeholder={ph}
              style={{ width: "100%", background: "#ffffff06", border: "1px solid #ffffff09", borderRadius: 8, color: "#e2e8f0", fontSize: 12, padding: "9px 12px", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }}/>
          </div>
        ))}
      </div>
      <button onClick={generate} disabled={!info.title}
        style={{ width: "100%", padding: "14px", borderRadius: 12, border: "none", background: info.title ? "linear-gradient(135deg,#3b82f6,#8b5cf6)" : "#1f2937", color: info.title ? "#fff" : "#4b5563", fontSize: 14, fontWeight: 900, cursor: info.title ? "pointer" : "not-allowed", boxShadow: info.title ? "0 0 24px #3b82f640" : "none" }}>
        ✦ 사업계획서 초안 생성
      </button>
    </div>
  );

  if (generating) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "calc(100vh - 160px)" }}>
      <Spinner size={48} color="#8b5cf6"/>
      <div style={{ marginTop: 20, fontSize: 14, fontWeight: 700, color: "#a78bfa" }}>사업계획서 작성 중...</div>
      <div style={{ marginTop: 8, fontSize: 12, color: "#4b5563" }}>움틀 프로필 + 공고 요건 + R&D 내러티브 조합 중</div>
    </div>
  );

  return (
    <div style={{ display: "flex", height: "calc(100vh - 112px)" }}>
      {/* 사이드 목차 */}
      <div style={{ width: 180, borderRight: "1px solid #ffffff09", background: "#0a0c15", overflowY: "auto" }}>
        <div style={{ padding: "14px 14px 6px", fontSize: 9, color: "#4b5563", fontFamily: "monospace", textTransform: "uppercase", letterSpacing: 1 }}>목차</div>
        {SECTIONS.map((sec, i) => (
          <button key={sec.id} onClick={() => setActiveSection(sec.id)}
            style={{ width: "100%", padding: "9px 14px", border: "none", background: activeSection === sec.id ? "#3b82f615" : "transparent", color: activeSection === sec.id ? "#60a5fa" : "#6b7280", fontSize: 11, cursor: "pointer", textAlign: "left", borderLeft: activeSection === sec.id ? "2px solid #3b82f6" : "2px solid transparent", fontWeight: activeSection === sec.id ? 700 : 400 }}>
            {String(i+1).padStart(2,"0")}. {sec.label}
          </button>
        ))}
        <div style={{ padding: "14px", marginTop: 8, borderTop: "1px solid #ffffff09" }}>
          <button onClick={saveProposal} disabled={saving || saved}
            style={{ width: "100%", padding: "8px", borderRadius: 8, border: "none", background: saved ? "#10b98120" : "linear-gradient(135deg,#3b82f6,#8b5cf6)", color: saved ? "#10b981" : "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
            {saving ? "전송 중..." : saved ? "✓ Slack 공유됨" : "💬 Slack에 공유"}
          </button>
          <button onClick={() => { setProposal(null); }} style={{ width: "100%", marginTop: 6, padding: "7px", borderRadius: 8, border: "1px solid #ffffff09", background: "transparent", color: "#6b7280", fontSize: 11, cursor: "pointer" }}>
            ↺ 다시 생성
          </button>
        </div>
      </div>

      {/* 본문 */}
      <div style={{ flex: 1, overflowY: "auto", padding: "28px 36px" }}>
        <div style={{ maxWidth: 720 }}>
          <div style={{ marginBottom: 28, paddingBottom: 20, borderBottom: "1px solid #ffffff09" }}>
            <div style={{ fontSize: 10, color: "#8b5cf6", fontFamily: "monospace", marginBottom: 6 }}>AI 생성 초안</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: "#f8fafc", lineHeight: 1.4 }}>{proposal.grantTitle}</div>
            <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
              {[proposal.agency, proposal.period, proposal.totalBudget, UMTR.company].map((v, i) => v && (
                <span key={i} style={{ fontSize: 11, padding: "3px 10px", borderRadius: 5, background: "#ffffff08", border: "1px solid #ffffff09", color: "#94a3b8" }}>{v}</span>
              ))}
            </div>
          </div>

          {/* 개요 */}
          {(activeSection === "overview") && (
            <Section label="01. 과제 개요">
              <p style={{ fontSize: 12, color: "#9ca3af", lineHeight: 1.8 }}>{proposal.overview?.applicant}</p>
              <div style={{ background: "#3b82f610", borderRadius: 8, padding: "12px 14px", border: "1px solid #3b82f625", fontSize: 12, color: "#93c5fd", lineHeight: 1.8, marginTop: 12 }}>{proposal.overview?.summary}</div>
            </Section>
          )}
          {/* 배경 */}
          {activeSection === "background" && (
            <Section label="02. 개발 배경 및 필요성">
              <p style={{ fontSize: 12, color: "#9ca3af", lineHeight: 1.9, whiteSpace: "pre-wrap" }}>{proposal.background}</p>
            </Section>
          )}
          {/* 최종목표 */}
          {activeSection === "goal" && (
            <Section label="03. 최종 목표">
              <div style={{ background: "#10b98110", borderRadius: 8, padding: "14px", border: "1px solid #10b98125", fontSize: 12, color: "#d1fae5", lineHeight: 1.8, marginBottom: 14 }}>{proposal.finalGoal?.statement}</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {[["기술 목표", proposal.finalGoal?.techGoals, "#3b82f6"], ["사업화 목표", proposal.finalGoal?.bizGoals, "#8b5cf6"]].map(([title, items, color]) => (
                  <div key={title} style={{ background: "#ffffff05", borderRadius: 8, padding: "14px", border: "1px solid #ffffff09" }}>
                    <div style={{ fontSize: 10, color, fontWeight: 700, marginBottom: 8, textTransform: "uppercase" }}>{title}</div>
                    {items?.map((g, i) => <div key={i} style={{ fontSize: 11, color: "#94a3b8", padding: "3px 0", display: "flex", gap: 6 }}><span style={{ color }}>›</span>{g}</div>)}
                  </div>
                ))}
              </div>
            </Section>
          )}
          {/* 연차별 */}
          {activeSection === "annual" && (
            <Section label="04. 연차별 목표 및 내용">
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {proposal.annualGoals?.map((g, i) => (
                  <div key={i} style={{ background: "#0d1020", borderRadius: 12, border: `1px solid ${YC[i]}30`, borderTop: `3px solid ${YC[i]}`, padding: "16px 18px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                      <span style={{ width: 22, height: 22, borderRadius: "50%", background: YC[i]+"25", border: `2px solid ${YC[i]}50`, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: YC[i], flexShrink: 0 }}>{i+1}</span>
                      <span style={{ fontSize: 13, fontWeight: 800, color: "#f1f5f9" }}>{g.title}</span>
                      <span style={{ marginLeft: "auto", fontSize: 11, color: YC[i], fontFamily: "monospace" }}>{g.budget}</span>
                    </div>
                    <div style={{ background: YC[i]+"10", borderRadius: 7, padding: "8px 12px", fontSize: 12, color: "#e2e8f0", marginBottom: 10, border: `1px solid ${YC[i]}20` }}>🎯 {g.milestone}</div>
                    {g.kpi?.map((k, j) => <div key={j} style={{ fontSize: 11, color: "#94a3b8", padding: "2px 0", display: "flex", gap: 6 }}><span style={{ color: YC[i] }}>✓</span>{k}</div>)}
                    {g.content && <p style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.7, marginTop: 10, paddingTop: 10, borderTop: "1px solid #ffffff08" }}>{g.content}</p>}
                  </div>
                ))}
              </div>
            </Section>
          )}
          {/* 예산 */}
          {activeSection === "budget" && (
            <Section label="05. 연구비 편성">
              <div style={{ background: "#0d1020", borderRadius: 10, border: "1px solid #ffffff09", overflow: "hidden" }}>
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr", background: "#ffffff06", padding: "8px 14px" }}>
                  {["비목","1차년도","2차년도","3차년도","합계"].map(h => <div key={h} style={{ fontSize: 10, fontWeight: 700, color: "#4b5563", fontFamily: "monospace" }}>{h}</div>)}
                </div>
                {proposal.budget?.items?.map((row, i) => (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr", padding: "9px 14px", borderTop: "1px solid #ffffff08", background: i%2===0?"transparent":"#ffffff02" }}>
                    <div style={{ fontSize: 12, color: "#e2e8f0", fontWeight: row.isTotal ? 800 : 400 }}>{row.name}</div>
                    {["y1","y2","y3","total"].map(k => <div key={k} style={{ fontSize: 12, color: row.isTotal ? "#60a5fa" : "#94a3b8", fontWeight: row.isTotal ? 800 : 400, fontFamily: "monospace" }}>{row[k]||"-"}</div>)}
                  </div>
                ))}
              </div>
              {proposal.budget?.note && <p style={{ fontSize: 11, color: "#6b7280", marginTop: 10, lineHeight: 1.6 }}>{proposal.budget.note}</p>}
            </Section>
          )}
          {/* 사업화 */}
          {activeSection === "commercialize" && (
            <Section label="06. 사업화 계획">
              <p style={{ fontSize: 12, color: "#9ca3af", lineHeight: 1.8, marginBottom: 14 }}>{proposal.commercialize?.strategy}</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div style={{ background: "#ffffff05", borderRadius: 8, padding: "14px", border: "1px solid #ffffff09" }}>
                  <div style={{ fontSize: 10, color: "#f59e0b", fontWeight: 700, marginBottom: 8 }}>목표 시장·고객</div>
                  {proposal.commercialize?.targets?.map((t, i) => <div key={i} style={{ fontSize: 11, color: "#94a3b8", padding: "2px 0" }}>· {t}</div>)}
                  <div style={{ marginTop: 10, fontSize: 12, color: "#fcd34d", fontWeight: 700 }}>목표 매출: {proposal.commercialize?.revenueGoal}</div>
                </div>
                <div style={{ background: "#ffffff05", borderRadius: 8, padding: "14px", border: "1px solid #ffffff09" }}>
                  <div style={{ fontSize: 10, color: "#8b5cf6", fontWeight: 700, marginBottom: 8 }}>사업화 로드맵</div>
                  {proposal.commercialize?.roadmap?.map((r, i) => <div key={i} style={{ fontSize: 11, color: "#94a3b8", padding: "3px 0", display: "flex", gap: 6 }}><span style={{ color: "#8b5cf6" }}>0{i+1}</span>{r}</div>)}
                </div>
              </div>
            </Section>
          )}
          {/* 기대효과 */}
          {activeSection === "effect" && (
            <Section label="07. 기대효과">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 14 }}>
                {[["기술적", proposal.effect?.tech, "#3b82f6"], ["경제적", proposal.effect?.economy, "#10b981"], ["사회적", proposal.effect?.social, "#f59e0b"]].map(([label, items, color]) => (
                  <div key={label} style={{ background: "#ffffff05", borderRadius: 8, padding: "14px", border: "1px solid #ffffff09" }}>
                    <div style={{ fontSize: 10, color, fontWeight: 700, marginBottom: 8 }}>{label} 효과</div>
                    {items?.map((e, i) => <div key={i} style={{ fontSize: 11, color: "#94a3b8", padding: "2px 0", lineHeight: 1.5 }}>· {e}</div>)}
                  </div>
                ))}
              </div>
              <div style={{ background: "#10b98110", borderRadius: 8, padding: "14px", border: "1px solid #10b98125", fontSize: 12, color: "#d1fae5", lineHeight: 1.8 }}>{proposal.effect?.summary}</div>
            </Section>
          )}
          <div style={{ height: 60 }}/>
        </div>
      </div>
    </div>
  );
}

function Section({ label, children }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: "#f1f5f9", marginBottom: 16, paddingBottom: 10, borderBottom: "1px solid #ffffff09", fontFamily: "monospace", letterSpacing: 0.3 }}>{label}</div>
      {children}
    </div>
  );
}

// ─── 메인 앱 ─────────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState("search");
  const [prefillGrant, setPrefillGrant] = useState(null);

  function handleSelectGrant(grant) {
    setPrefillGrant(grant);
    setTab("proposal");
  }

  const TABS = [
    { id: "search", label: "🔍 공고 탐색" },
    { id: "proposal", label: "✍️ 사업계획서" },
  ];

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#060810", color: "#e2e8f0", fontFamily: "'Noto Sans KR', -apple-system, sans-serif" }}>
      <Head>
        <title>GRANTIQ — {UMTR.company}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1"/>
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;900&display=swap" rel="stylesheet"/>
      </Head>
      <style>{`*{box-sizing:border-box;margin:0;padding:0} @keyframes spin{to{transform:rotate(360deg)}} body{background:#060810}`}</style>

      {/* 헤더 */}
      <div style={{ padding: "0 28px", borderBottom: "1px solid #ffffff09", background: "#0a0c15", display: "flex", alignItems: "center", height: 56, position: "sticky", top: 0, zIndex: 50, backdropFilter: "blur(12px)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginRight: 32 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: "linear-gradient(135deg,#3b82f6,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 900 }}>G</div>
          <span style={{ fontSize: 14, fontWeight: 900 }}>GRANTIQ</span>
        </div>
        {/* 탭 */}
        <div style={{ display: "flex", height: "100%", gap: 2 }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{ padding: "0 18px", border: "none", background: "transparent", color: tab === t.id ? "#60a5fa" : "#6b7280", fontSize: 12, fontWeight: tab === t.id ? 700 : 400, cursor: "pointer", borderBottom: tab === t.id ? "2px solid #3b82f6" : "2px solid transparent", height: "100%" }}>
              {t.label}
            </button>
          ))}
        </div>
        {/* 기업 표시 */}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#10b981", animation: "pulse 2s infinite" }}/>
          <span style={{ fontSize: 11, color: "#10b981" }}>실시간 검색</span>
          <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 5, background: "#3b82f615", border: "1px solid #3b82f630", color: "#60a5fa" }}>{UMTR.company}</span>
        </div>
      </div>

      {/* 콘텐츠 */}
      {tab === "search" && <GrantSearch onSelectGrant={handleSelectGrant}/>}
      {tab === "proposal" && <ProposalGenerator prefillGrant={prefillGrant}/>}
    </div>
  );
}
