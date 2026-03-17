import { useState, useEffect } from "react";
import Head from "next/head";

const UMTR = {
  company: process.env.NEXT_PUBLIC_COMPANY_NAME || "움틀",
  mainBiz: "NC/PES 멤브레인 바이오 소부장",
  keywords: ["멤브레인","체외진단","PES 분리막","TFF 카세트","GMP","ISO13485"],
};

async function callClaude({ messages, system, tools, tool_choice, max_tokens = 1500 }) {
  const res = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, system, tools, tool_choice, max_tokens }),
  });
  return res.json();
}

function Badge({ label, color = "#3b82f6" }) {
  return (
    <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, background: color + "20", color, border: "1px solid " + color + "30", marginRight: 4 }}>
      {label}
    </span>
  );
}

function Dot({ on }) {
  return <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: on ? "#10b981" : "#374151", marginRight: 6 }} />;
}

function HealthBlock({ health }) {
  if (!health) return null;
  const items = [
    { label: "Anthropic API", on: health.anthropicConfigured },
    { label: "Slack 연동", on: health.slackConfigured },
    { label: "외부 DB", on: health.dbConfigured },
    { label: "모니터 활성", on: health.monitorEnabled },
  ];
  return (
    <div style={{ background: "#0a0c15", border: "1px solid #ffffff09", borderRadius: 10, padding: "12px 16px", marginBottom: 20, display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center" }}>
      {items.map(it => (
        <span key={it.label} style={{ fontSize: 11, color: it.on ? "#10b981" : "#6b7280" }}>
          <Dot on={it.on} />{it.label}
        </span>
      ))}
      {health.lastMonitorRunAt && <span style={{ fontSize: 11, color: "#6b7280", marginLeft: "auto" }}>마지막 모니터: {health.lastMonitorRunAt.slice(0, 16)}</span>}
      {typeof health.latestOpportunityCount === "number" && <span style={{ fontSize: 11, color: "#94a3b8" }}>공고 {health.latestOpportunityCount}개</span>}
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState("admin");
  const [status, setStatus] = useState(null);
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [monitorRunning, setMonitorRunning] = useState(false);
  const [monitorResult, setMonitorResult] = useState(null);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [grants, setGrants] = useState([]);
  const [selected, setSelected] = useState(null);
  const [searchStatus, setSearchStatus] = useState("");

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    setLoading(true);
    try {
      const [sr, hr] = await Promise.all([
        fetch("/api/admin/status").then(r => r.json()),
        fetch("/api/admin/health").then(r => r.json()),
      ]);
      if (sr.ok) setStatus(sr);
      if (hr.ok) setHealth(hr);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function runMonitor() {
    setMonitorRunning(true); setMonitorResult(null);
    try {
      const d = await fetch("/api/monitor/opportunities").then(r => r.json());
      setMonitorResult(d); await fetchAll();
    } catch (e) { setMonitorResult({ error: e.message }); }
    finally { setMonitorRunning(false); }
  }

  async function search(q) {
    const sq = q || query;
    if (!sq.trim() || searching) return;
    setSearching(true); setGrants([]); setSelected(null); setSearchStatus("검색 중...");
    try {
      const data = await callClaude({
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        tool_choice: { type: "any" },
        max_tokens: 2000,
        messages: [{ role: "user", content: "한국 정부 R&D 과제 공고 검색: \"" + sq + "\"\n회사: " + UMTR.company + " (" + UMTR.mainBiz + ")\n키워드: " + UMTR.keywords.join(", ") + "\n\nJSON으로만 응답:\n{\"grants\":[{\"title\":\"\",\"agency\":\"\",\"budget\":\"\",\"deadline\":\"\",\"summary\":\"\",\"url\":\"\",\"matchScore\":0,\"matchReasons\":[]}],\"searchSummary\":\"\"}" }],
      });
      const text = data.content?.find(b => b.type === "text")?.text || "{}";
      const m = text.match(/\{[\s\S]*\}/);
      const parsed = m ? JSON.parse(m[0]) : { grants: [] };
      const sorted = (parsed.grants || []).sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));
      setGrants(sorted);
      setSearchStatus(parsed.searchSummary || sorted.length + "개 공고");
    } catch (err) { console.error(err); setSearchStatus(err.message || "검색 실패"); }
    finally { setSearching(false); }
  }

  const s = status;
  const TABS = [{ id: "admin", label: "📊 Admin Console" }, { id: "search", label: "🔍 공고 탐색" }];
  const PRESETS = [{ label: "바이오 소부장", q: "바이오 소부장 멤브레인 R&D 2026" }, { label: "체외진단", q: "체외진단 NC 멤브레인 R&D 2026" }, { label: "중기부 스케일업", q: "중기부 스케일업 소재 R&D 2026" }];

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#060810", color: "#e2e8f0", fontFamily: "'Noto Sans KR', -apple-system, sans-serif" }}>
      <Head>
        <title>GRANTIQ — {UMTR.company}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;900&display=swap" rel="stylesheet" />
      </Head>
      <style>{`*{box-sizing:border-box;margin:0;padding:0} body{background:#060810} code{font-family:monospace;background:#ffffff08;padding:1px 5px;border-radius:3px;font-size:11px}`}</style>

      <div style={{ padding: "0 24px", borderBottom: "1px solid #ffffff09", background: "#0a0c15", display: "flex", alignItems: "center", height: 52, position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginRight: 28 }}>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: "linear-gradient(135deg,#3b82f6,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 900 }}>G</div>
          <span style={{ fontSize: 13, fontWeight: 900 }}>GRANTIQ</span>
        </div>
        <div style={{ display: "flex", height: "100%", gap: 2 }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: "0 16px", border: "none", background: "transparent", color: tab === t.id ? "#60a5fa" : "#6b7280", fontSize: 12, fontWeight: tab === t.id ? 700 : 400, cursor: "pointer", borderBottom: tab === t.id ? "2px solid #3b82f6" : "2px solid transparent", height: "100%" }}>
              {t.label}
            </button>
          ))}
        </div>
        <span style={{ marginLeft: "auto", fontSize: 11, color: "#10b981" }}>{UMTR.company}</span>
      </div>

      {tab === "admin" && (
        <div style={{ padding: "24px", maxWidth: 1100, margin: "0 auto" }}>
          <HealthBlock health={health} />
          <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
            <button onClick={fetchAll} disabled={loading} style={{ fontSize: 11, padding: "6px 14px", borderRadius: 6, border: "1px solid #ffffff09", background: "#ffffff08", color: "#94a3b8", cursor: loading ? "not-allowed" : "pointer" }}>{loading ? "⏳" : "🔄"} 새로고침</button>
            <button onClick={runMonitor} disabled={monitorRunning} style={{ fontSize: 11, padding: "6px 14px", borderRadius: 6, border: "none", background: monitorRunning ? "#1f2937" : "linear-gradient(135deg,#3b82f6,#8b5cf6)", color: monitorRunning ? "#4b5563" : "#fff", cursor: monitorRunning ? "not-allowed" : "pointer" }}>{monitorRunning ? "⏳ 탐색 중..." : "🔍 공고 탐색 실행"}</button>
          </div>
          {monitorResult && (
            <div style={{ background: monitorResult.error ? "#dc262615" : "#10b98115", border: "1px solid " + (monitorResult.error ? "#dc262630" : "#10b98130"), borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 12, color: monitorResult.error ? "#fca5a5" : "#6ee7b7" }}>
              {monitorResult.error ? "❌ " + monitorResult.error : "✅ 완료 — 검색 " + (monitorResult.fetched || 0) + "개, 저장 " + (monitorResult.saved || 0) + "개"}
            </div>
          )}
          {s && <>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, color: "#8b5cf6", fontFamily: "monospace", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>🧠 회사 메모리</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10 }}>
                {[["회사", s.memory.company_name], ["문서", s.memory.document_count + "개"], ["역량", s.memory.capability_count + "개"], ["실적", s.memory.project_count + "개"], ["근거", s.memory.evidence_count + "개"]].map(([l, v]) => (
                  <div key={l} style={{ background: "#0a0c15", border: "1px solid #ffffff09", borderRadius: 10, padding: "12px 14px" }}>
                    <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 3 }}>{l}</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#f1f5f9" }}>{v}</div>
                  </div>
                ))}
              </div>
              {s.memory.keywords?.length > 0 && <div style={{ marginTop: 8 }}>{s.memory.keywords.map(k => <Badge key={k} label={k} color="#8b5cf6" />)}</div>}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginBottom: 18 }}>
              <div style={{ background: "#0a0c15", border: "1px solid #ffffff09", borderRadius: 12, padding: "14px 16px" }}>
                <div style={{ fontSize: 11, color: "#3b82f6", fontFamily: "monospace", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>📋 공고 ({s.opportunities.total})</div>
                {s.opportunities.recent.map(o => (
                  <div key={o.id} style={{ padding: "7px 0", borderBottom: "1px solid #ffffff06", fontSize: 11 }}>
                    <div style={{ color: "#e2e8f0", fontWeight: 600, marginBottom: 2 }}>{o.title}</div>
                    <div style={{ color: "#6b7280" }}>적합도 <b style={{ color: (o.fit_score || 0) >= 70 ? "#10b981" : "#f59e0b" }}>{o.fit_score || "?"}점</b> · {o.deadline || "-"}</div>
                  </div>
                ))}
                {!s.opportunities.recent.length && <div style={{ fontSize: 12, color: "#374151" }}>없음 — 탐색 실행 버튼 클릭</div>}
              </div>
              <div style={{ background: "#0a0c15", border: "1px solid #ffffff09", borderRadius: 12, padding: "14px 16px" }}>
                <div style={{ fontSize: 11, color: "#f59e0b", fontFamily: "monospace", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>🏛️ 이사회 ({s.board_reviews.total})</div>
                <div style={{ display: "flex", gap: 16, marginBottom: 10 }}>
                  <span style={{ fontSize: 11, color: "#10b981" }}>GO {s.board_reviews.go}</span>
                  <span style={{ fontSize: 11, color: "#f59e0b" }}>HOLD {s.board_reviews.hold}</span>
                  <span style={{ fontSize: 11, color: "#ef4444" }}>REJECT {s.board_reviews.reject}</span>
                </div>
                {s.board_reviews.recent.map(r => (
                  <div key={r.id} style={{ padding: "5px 0", borderBottom: "1px solid #ffffff06", fontSize: 11, display: "flex", gap: 8 }}>
                    <span style={{ color: r.decision === "GO" ? "#10b981" : r.decision === "HOLD" ? "#f59e0b" : "#ef4444" }}>{r.decision === "GO" ? "✅" : r.decision === "HOLD" ? "⚠️" : "❌"} {r.decision}</span>
                    <span style={{ color: "#6b7280" }}>{r.created_at?.slice(0, 16)}</span>
                  </div>
                ))}
                {!s.board_reviews.recent.length && <div style={{ fontSize: 12, color: "#374151" }}>없음 — Slack에서 시작</div>}
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginBottom: 18 }}>
              <div style={{ background: "#0a0c15", border: "1px solid #ffffff09", borderRadius: 12, padding: "14px 16px" }}>
                <div style={{ fontSize: 11, color: "#10b981", fontFamily: "monospace", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>📄 문서</div>
                {s.documents.map(d => <div key={d.id} style={{ padding: "5px 0", borderBottom: "1px solid #ffffff06", fontSize: 11, color: "#94a3b8" }}>{d.name} <span style={{ color: d.status === "done" ? "#10b981" : "#f59e0b" }}>● {d.status}</span></div>)}
                {!s.documents.length && <div style={{ fontSize: 12, color: "#374151" }}>없음 — Slack 파일 업로드</div>}
              </div>
              <div style={{ background: "#0a0c15", border: "1px solid #ffffff09", borderRadius: 12, padding: "14px 16px" }}>
                <div style={{ fontSize: 11, color: "#8b5cf6", fontFamily: "monospace", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>✍️ 사업계획서 ({s.proposal_drafts.total})</div>
                {s.proposal_drafts.recent.map(d => <div key={d.id} style={{ padding: "5px 0", fontSize: 11, color: "#94a3b8" }}>{d.created_at?.slice(0, 16)}</div>)}
                {!s.proposal_drafts.recent.length && <div style={{ fontSize: 12, color: "#374151" }}>없음</div>}
              </div>
            </div>
            <div style={{ background: "#0a0c15", border: "1px solid #ffffff09", borderRadius: 10, padding: "14px 16px" }}>
              <div style={{ fontSize: 11, color: "#6b7280", fontFamily: "monospace", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>🔌 Slack 워크플로우</div>
              <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 2 }}>파일 업로드 → 자동 메모리 추출 · <code>@GRANTIQ 공고 탐색</code> → 검색 · 카드 버튼 → 이사회 심의 · GO → 사업계획서<br />Events: <code>/api/slack/events</code> · Interactivity: <code>/api/slack/interactivity</code></div>
            </div>
          </>}
        </div>
      )}

      {tab === "search" && (
        <div style={{ display: "flex", height: "calc(100vh - 52px)" }}>
          <div style={{ width: 400, borderRight: "1px solid #ffffff09", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "12px 14px", borderBottom: "1px solid #ffffff09", background: "#0a0c15" }}>
              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === "Enter" && search()} placeholder="공고 검색어..." style={{ flex: 1, background: "#ffffff08", border: "1px solid #ffffff09", borderRadius: 7, color: "#e2e8f0", fontSize: 12, padding: "8px 11px", outline: "none", fontFamily: "inherit" }} />
                <button onClick={() => search()} disabled={searching} style={{ padding: "8px 14px", borderRadius: 7, border: "none", background: searching ? "#1f2937" : "linear-gradient(135deg,#3b82f6,#8b5cf6)", color: searching ? "#4b5563" : "#fff", fontSize: 12, fontWeight: 700, cursor: searching ? "not-allowed" : "pointer" }}>{searching ? "⏳" : "검색"}</button>
              </div>
              <div style={{ display: "flex", gap: 5 }}>
                {PRESETS.map(p => <button key={p.label} onClick={() => { setQuery(p.q); search(p.q); }} style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, border: "1px solid #ffffff09", background: "#ffffff05", color: "#94a3b8", cursor: "pointer" }}>{p.label}</button>)}
              </div>
            </div>
            {searchStatus && <div style={{ padding: "6px 14px", fontSize: 11, color: searching ? "#8b5cf6" : "#10b981", background: "#0a0d14", borderBottom: "1px solid #ffffff09" }}>{searchStatus}</div>}
            <div style={{ flex: 1, overflowY: "auto" }}>
              {grants.map((g, i) => (
                <div key={i} onClick={() => setSelected(g)} style={{ padding: "11px 13px", borderBottom: "1px solid #ffffff06", cursor: "pointer", background: selected?.title === g.title ? "#1a1f35" : "transparent", borderLeft: "3px solid " + (selected?.title === g.title ? "#3b82f6" : "transparent") }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#f1f5f9", marginBottom: 2 }}>{g.title}</div>
                  <div style={{ fontSize: 10, color: "#6b7280" }}>{g.agency} · {g.budget} · {g.deadline}</div>
                </div>
              ))}
              {!grants.length && !searching && <div style={{ padding: "50px 20px", textAlign: "center", color: "#374151" }}><div style={{ fontSize: 28, marginBottom: 8 }}>🔍</div><div style={{ fontSize: 12 }}>검색어 입력 후 Enter</div></div>}
            </div>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "24px 28px" }}>
            {!selected ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", color: "#374151" }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>📡</div>
                <div style={{ fontSize: 14, color: "#6b7280" }}>공고를 선택하면 상세 정보가 표시됩니다</div>
              </div>
            ) : (
              <div style={{ maxWidth: 620 }}>
                <div style={{ background: "#0a0c15", borderRadius: 14, border: "1px solid #ffffff09", padding: "20px 22px", marginBottom: 16 }}>
                  <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                    {selected.agency && <span style={{ fontSize: 10, padding: "3px 9px", borderRadius: 5, background: "#3b82f615", color: "#60a5fa", border: "1px solid #3b82f625" }}>{selected.agency}</span>}
                    {selected.deadline && <span style={{ fontSize: 10, color: "#6b7280" }}>🗓 {selected.deadline}</span>}
                  </div>
                  <div style={{ fontSize: 17, fontWeight: 900, color: "#f1f5f9", lineHeight: 1.4, marginBottom: 8 }}>{selected.title}</div>
                  {selected.budget && <div style={{ fontSize: 13, color: "#fcd34d", fontWeight: 700, marginBottom: 8 }}>💰 {selected.budget}</div>}
                  <div style={{ fontSize: 12, color: "#9ca3af", lineHeight: 1.8, background: "#ffffff05", borderRadius: 8, padding: "10px 12px", marginBottom: 12 }}>{selected.summary}</div>
                  {selected.url && selected.url !== "#" && <a href={selected.url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: "#60a5fa", padding: "5px 12px", borderRadius: 6, border: "1px solid #3b82f630", textDecoration: "none" }}>🔗 공고 원문</a>}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
