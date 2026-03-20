// pages/index.js â GRANTIQ ë©ì¸ ëìë³´ë (ëí/ììì©)
import { useState } from "react";
import Head from "next/head";
import { jsonrepair } from "jsonrepair";

// âââ ê³µíµ ìì ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
const UMTR = {
  company: process.env.NEXT_PUBLIC_COMPANY_NAME || "ãìí",
  mainBiz: "ë°ì´ì¤ì°ìì© NC/PES ë©¤ë¸ë ì¸Â·íí° ì°êµ¬ê°ë°Â·ì ì¡°",
  keywords: ["ë°ì´ì¤ ë©¤ë¸ë ì¸", "ìë¶ì¥ êµ­ì°í", "PES ë©¤ë¸ë ì¸", "NC ë©¤ë¸ë ì¸", "TFF ëª¨ë", "ì ê· íí°", "GMP", "ì²´ì¸ì§ë¨ê¸°ê¸°", "ISO13485"],
};

const PRESET_QUERIES = [
  { label: "ë°ì´ì¤ ìë¶ì¥", q: "ë°ì´ì¤ ìë¶ì¥ R&D ì§ìì¬ì ê³µê³  2025 2026" },
  { label: "ë©¤ë¸ë ì¸ ê¸°ì ê°ë°", q: "ë©¤ë¸ë ì¸ íí° ê¸°ì ê°ë° ì ë¶ R&D ê³µê³  2026" },
  { label: "ì°ìë¶ ìë¶ì¥", q: "ì°ìíµìììë¶ ìì¬ë¶íì¥ë¹ R&D ê³µê³  2026" },
  { label: "ì¤ê¸°ë¶ ì¤ì¼ì¼ì", q: "ì¤ìë²¤ì²ê¸°ìë¶ ê¸°ì íì  ì¤ì¼ì¼ì ì§ì ê³µê³ " },
  { label: "ì²´ì¸ì§ë¨", q: "ì²´ì¸ì§ë¨ê¸°ê¸° ë©¤ë¸ë ì¸ ìì¬ R&D ê³µê³  2026" },
  { label: "ì¤ì¡ ë°ì´ì¤", q: "ì¤ì¡ ë°ì´ì¤í¬ì¤ ì²¨ë¨ìë£ R&D ì§ì ê³µê³  ì¶©ë¶" },
];

// âââ API í¸ì¶ í¬í¼ âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
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

// âââ ê³µíµ ì»´í¬ëí¸ âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
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

// âââ ê³µê³  íì í­ âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
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
    setSearching(true); setGrants([]); setSelected(null); setStatus("ê²ì ì¤...");
    try {
      const data = await callClaude({
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        messages: [{
          role: "user",
          content: `íêµ­ ì ë¶ R&D ê³µê³  ê²ì: "${sq}"\nê¸°ì: ${UMTR.company} (${UMTR.mainBiz})\ní¤ìë: ${UMTR.keywords.join(", ")}\n\nì¹ ê²ì í JSONë§ ë°í:\n{"grants":[{"title":"","agency":"","budget":"","deadline":"","period":"","summary":"","url":"","matchScore":0-100,"matchReasons":[]}],"searchSummary":""}`,
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
      setStatus(parsed.searchSummary || `${sorted.length}ê° ê³µê³ `);
    } catch (err) { console.error(err); setStatus(err.message || "ê²ì ì¤í¨"); }
    finally { setSearching(false); }
  }

  async function analyze(grant) {
    if (analysis[grant.title]) return;
    setAnalyzing(grant.title);
    try {
      const data = await callClaude({
        messages: [{
          role: "user",
          content: `ê¸°ì: ${UMTR.company} | ${UMTR.mainBiz} | í¤ìë: ${UMTR.keywords.join(", ")}\nê³µê³ : ${grant.title} / ${grant.agency} / ${grant.summary}\n\nJSONë§: {"score":0-100,"grade":"S/A/B/C","verdict":"íì¤ê²°ë¡ ","strengths":["",""],"weaknesses":["",""],"strategy":"ì ëµ 2ë¬¸ì¥"}`,
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
    } catch { alert("Slack ì ì¡ ì¤í¨. .env SLACK_WEBHOOK_URL íì¸"); }
  }

  const s = selected; const an = s ? analysis[s.title] : null;
  const gColor = c => ({ S: "#10b981", A: "#3b82f6", B: "#f59e0b", C: "#6b7280" }[c] || "#6b7280");

  return (
    <div style={{ display: "flex", height: "calc(100vh - 112px)", gap: 0 }}>
      {/* ë¦¬ì¤í¸ í¨ë */}
      <div style={{ width: 420, borderRight: "1px solid #ffffff09", display: "flex", flexDirection: "column" }}>
        {/* ê²ìì°½ */}
        <div style={{ padding: "14px 16px", borderBottom: "1px solid #ffffff09", background: "#0a0c15" }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === "Enter" && search()}
              placeholder="ê³µê³  ê²ìì´ ìë ¥..."
              style={{ flex: 1, background: "#ffffff08", border: "1px solid #ffffff09", borderRadius: 8, color: "#e2e8f0", fontSize: 12, padding: "9px 12px", outline: "none", fontFamily: "inherit" }}/>
            <button onClick={() => search()} disabled={searching}
              style={{ padding: "9px 16px", borderRadius: 8, border: "none", background: searching ? "#1f2937" : "linear-gradient(135deg,#3b82f6,#8b5cf6)", color: searching ? "#4b5563" : "#fff", fontSize: 12, fontWeight: 700, cursor: searching ? "not-allowed" : "pointer" }}>
              {searching ? <Spinner size={16} color="#6b7280"/> : "ê²ì"}
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
        {/* ìí */}
        {status && (
          <div style={{ padding: "8px 16px", fontSize: 11, color: searching ? "#8b5cf6" : "#10b981", background: "#0a0d14", borderBottom: "1px solid #ffffff09", display: "flex", gap: 8, alignItems: "center" }}>
            {searching && <Spinner size={12} color="#8b5cf6"/>} {status}
          </div>
        )}
        {/* ë¦¬ì¤í¸ */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {grants.length === 0 && !searching && (
            <div style={{ padding: "50px 20px", textAlign: "center", color: "#374151" }}>
              <div style={{ fontSize: 28, marginBottom: 10 }}>ð</div>
              <div style={{ fontSize: 12 }}>ì ë²í¼ì¼ë¡ ê³µê³ ë¥¼ ê²ìí´ë³´ì¸ì</div>
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
                    {(g.matchScore||0) >= 70 && <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 4, background: "#10b98120", color: "#10b981", border: "1px solid #10b98140", fontWeight: 700 }}>ð¯ ê°ë ¥ë§¤ì¹­</span>}
                    {g.agency && <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 4, background: "#3b82f615", color: "#60a5fa", border: "1px solid #3b82f625" }}>{g.agency}</span>}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#f1f5f9", lineHeight: 1.4, marginBottom: 4 }}>{g.title}</div>
                  <div style={{ fontSize: 10, color: "#6b7280" }}>{g.budget} Â· ë§ê° {g.deadline}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ìì¸ í¨ë */}
      <div style={{ flex: 1, overflowY: "auto", padding: "24px 28px" }}>
        {!s ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", color: "#374151" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>ð¡</div>
            <div style={{ fontSize: 14, color: "#6b7280" }}>ê³µê³ ë¥¼ ì ííë©´ AI ë¶ìì´ ììë¼ì</div>
          </div>
        ) : (
          <div style={{ maxWidth: 620 }}>
            {/* ê³µê³  ì¹´ë */}
            <div style={{ background: "#0a0c15", borderRadius: 14, border: "1px solid #ffffff09", padding: "20px 22px", marginBottom: 18 }}>
              <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                {s.agency && <span style={{ fontSize: 10, padding: "3px 9px", borderRadius: 5, background: "#3b82f615", color: "#60a5fa", border: "1px solid #3b82f625" }}>{s.agency}</span>}
                {s.deadline && <span style={{ fontSize: 10, color: "#6b7280" }}>ð {s.deadline}</span>}
              </div>
              <div style={{ fontSize: 17, fontWeight: 900, color: "#f1f5f9", lineHeight: 1.4, marginBottom: 10 }}>{s.title}</div>
              {s.budget && <div style={{ fontSize: 13, color: "#fcd34d", fontWeight: 700, marginBottom: 10 }}>ð° {s.budget}</div>}
              <div style={{ fontSize: 12, color: "#9ca3af", lineHeight: 1.8, background: "#ffffff05", borderRadius: 8, padding: "12px 14px", marginBottom: 12 }}>{s.summary}</div>
              <div style={{ display: "flex", gap: 8 }}>
                {s.url && s.url !== "#" && (
                  <a href={s.url} target="_blank" rel="noreferrer"
                    style={{ fontSize: 11, color: "#60a5fa", padding: "6px 14px", borderRadius: 7, border: "1px solid #3b82f630", textDecoration: "none" }}>
                    ð ìë¬¸ ë°ë¡ê°ê¸°
                  </a>
                )}
                <button onClick={() => saveGrant(s)}
                  style={{ fontSize: 11, padding: "6px 14px", borderRadius: 7, border: "none", background: saved[s.title] ? "#10b98120" : "#ffffff08", color: saved[s.title] ? "#10b981" : "#94a3b8", cursor: "pointer" }}>
                  {saved[s.title] ? "â Slack ê³µì ë¨" : "ð¬ Slackì ê³µì "}
                </button>
                <button onClick={() => onSelectGrant(s)}
                  style={{ fontSize: 11, padding: "6px 14px", borderRadius: 7, border: "none", background: "linear-gradient(135deg,#3b82f6,#8b5cf6)", color: "#fff", fontWeight: 700, cursor: "pointer", marginLeft: "auto" }}>
                  âï¸ ì¬ìê³íì ìì±
                </button>
              </div>
            </div>

            {/* AI ë¶ì */}
            <div style={{ background: "#0a0c15", borderRadius: 14, border: "1px solid #ffffff09", overflow: "hidden" }}>
              <div style={{ padding: "12px 18px", borderBottom: "1px solid #ffffff09", display: "flex", alignItems: "center", gap: 10, background: "#0d1020" }}>
                <span style={{ fontSize: 12, fontWeight: 700 }}>â¦ AI ë§¤ì¹­ ë¶ì</span>
                {analyzing === s.title && <Spinner size={14}/>}
                {an && <span style={{ marginLeft: "auto", fontSize: 11, padding: "2px 9px", borderRadius: 5, background: gColor(an.grade)+"20", color: gColor(an.grade), border: `1px solid ${gColor(an.grade)}40`, fontWeight: 800 }}>ë±ê¸ {an.grade} Â· {an.score}ì </span>}
              </div>
              {an ? (
                <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ background: "#3b82f610", borderRadius: 8, padding: "12px", border: "1px solid #3b82f625", fontSize: 12, color: "#93c5fd", lineHeight: 1.7 }}>ð¬ {an.verdict}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div style={{ background: "#10b98108", borderRadius: 8, padding: "12px", border: "1px solid #10b98120" }}>
                      <div style={{ fontSize: 10, color: "#10b981", fontWeight: 700, marginBottom: 7 }}>â ê°ì </div>
                      {an.strengths?.map((s2, i) => <div key={i} style={{ fontSize: 11, color: "#d1fae5", padding: "2px 0", lineHeight: 1.5 }}>Â· {s2}</div>)}
                    </div>
                    <div style={{ background: "#f59e0b08", borderRadius: 8, padding: "12px", border: "1px solid #f59e0b20" }}>
                      <div style={{ fontSize: 10, color: "#f59e0b", fontWeight: 700, marginBottom: 7 }}>â ï¸ ë³´ìì </div>
                      {an.weaknesses?.map((w, i) => <div key={i} style={{ fontSize: 11, color: "#fef3c7", padding: "2px 0", lineHeight: 1.5 }}>Â· {w}</div>)}
                    </div>
                  </div>
                  <div style={{ background: "#8b5cf608", borderRadius: 8, padding: "12px", border: "1px solid #8b5cf620", fontSize: 12, color: "#ddd6fe", lineHeight: 1.7 }}>
                    <span style={{ fontSize: 10, color: "#a78bfa", fontWeight: 700, display: "block", marginBottom: 5 }}>ð ì ëµ</span>
                    {an.strategy}
                  </div>
                </div>
              ) : (
                <div style={{ padding: "24px", textAlign: "center", color: "#6b7280", fontSize: 12 }}>
                  {analyzing === s.title ? "ë¶ì ì¤..." : "ê³µê³  ì í ì ìë ë¶ìë©ëë¤"}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// âââ ì¬ìê³íì í­ âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
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
    { id: "overview", label: "ê³¼ì  ê°ì" },
    { id: "background", label: "ë°°ê²½Â·íìì±" },
    { id: "goal", label: "ìµì¢ ëª©í" },
    { id: "annual", label: "ì°ì°¨ë³ ëª©í" },
    { id: "budget", label: "ìì° í¸ì±" },
    { id: "commercialize", label: "ì¬ìí ê³í" },
    { id: "effect", label: "ê¸°ëí¨ê³¼" },
  ];

  async function generate() {
    if (!info.title) return;
    setGenerating(true); setProposal(null);
    try {
      const data = await callClaude({
        max_tokens: 2000,
        messages: [{
          role: "user",
          content: `íêµ­ R&D ì¬ìê³íì ì´ì. ìì JSONë§ ì¶ë ¥.

ê¸°ì: ${UMTR.company} | ${UMTR.mainBiz}
íí©: íì¼ë¿ NC/PES ë©¤ë¸ë ì¸ ìì°. ISO 13485. ì¼ì±ë°ì´ì¤ë¡ì§ì¤ ê³µëì¤ì¦ ìë£. R&D ì°ê° 10ìµ+. ì¤ì¡ ë¶ì§ íë³´.
ë¬¸ì : ë°ì´ì¤ ìë¶ì¥ êµ­ì°íì¨ 6%, GMP ìì°ìì¤ ë¶ì¬.
ë´ë¬í°ë¸: "ì§ê¸ê¹ì§ íµì¬ ê¸°ì ì íë³´í´ìê³  R&D íëë¡ ëëìì° ë¬¸ì ë¥¼ íì© í´ê²°í  ì ìë¤"

ê³µê³ : ${info.title} / ${info.agency} / ${info.budget} / ${info.years}ë

{"grantTitle":"","agency":"","totalBudget":"","period":"","overview":{"applicant":"","summary":""},"background":"ë°°ê²½ 4ë¬¸ë¨","finalGoal":{"statement":"","techGoals":[],"bizGoals":[]},"annualGoals":[{"year":1,"title":"","budget":"","milestone":"","kpi":[],"content":"","tasks":[{"id":"t1","name":"","category":"ê¸°ì ê°ë°","startQ":1,"endQ":3,"year":1}]}],"budget":{"items":[{"name":"ì¸ê±´ë¹","y1":"","y2":"","y3":"","total":""},{"name":"ì§ì ë¹","y1":"","y2":"","y3":"","total":""},{"name":"í©ê³","y1":"","y2":"","y3":"","total":"${info.budget}","isTotal":true}],"note":""},"commercialize":{"strategy":"","targets":[],"revenueGoal":"","roadmap":[]},"effect":{"tech":[],"economy":[],"social":[],"summary":""}}`,
        }],
      });
      const text = data.content?.[0]?.text || "{}";
      const m = text.match(/\{[\s\S]*\}/);
      if (m) setProposal(JSON.parse(m[0]));
    } catch { alert("ìì± ì¤í¨. ë¤ì ìëí´ì£¼ì¸ì."); }
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
    } catch { alert("Slack ì ì¡ ì¤í¨"); }
    finally { setSaving(false); }
  }

  const YC = ["#3b82f6", "#8b5cf6", "#10b981", "#f59e0b"];

  if (!proposal && !generating) return (
    <div style={{ maxWidth: 580, margin: "40px auto", padding: "0 24px" }}>
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <div style={{ fontSize: 28, marginBottom: 10 }}>âï¸</div>
        <div style={{ fontSize: 18, fontWeight: 900, color: "#f1f5f9", marginBottom: 6 }}>ì¬ìê³íì ì´ì ìì±</div>
        <div style={{ fontSize: 12, color: "#6b7280" }}>ê³µê³  ì ë³´ë¥¼ ìë ¥íë©´ Claudeê° ìí ë§ì¶¤ ì´ìì ìë ìì±í©ëë¤</div>
      </div>
      <div style={{ background: "#0a0c15", borderRadius: 14, border: "1px solid #ffffff09", padding: "20px 22px", marginBottom: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        {[["ê³¼ì ëª", "title", "GMPê¸ ë°ì´ì¤ ë©¤ë¸ë ì¸ ëëìì° ê¸°ì  ê°ë°..."], ["ì£¼ê´ê¸°ê´", "agency", "ì°ìíµìììë¶"], ["ì´ ìì°", "budget", "34.4ìµì"], ["ê¸°ê°(ë)", "years", "3"]].map(([label, key, ph]) => (
          <div key={key}>
            <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 5 }}>{label}</div>
            <input value={info[key]} onChange={e => setInfo(p => ({...p, [key]: e.target.value}))} placeholder={ph}
              style={{ width: "100%", background: "#ffffff06", border: "1px solid #ffffff09", borderRadius: 8, color: "#e2e8f0", fontSize: 12, padding: "9px 12px", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }}/>
          </div>
        ))}
      </div>
      <button onClick={generate} disabled={!info.title}
        style={{ width: "100%", padding: "14px", borderRadius: 12, border: "none", background: info.title ? "linear-gradient(135deg,#3b82f6,#8b5cf6)" : "#1f2937", color: info.title ? "#fff" : "#4b5563", fontSize: 14, fontWeight: 900, cursor: info.title ? "pointer" : "not-allowed", boxShadow: info.title ? "0 0 24px #3b82f640" : "none" }}>
        â¦ ì¬ìê³íì ì´ì ìì±
      </button>
    </div>
  );

  if (generating) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "calc(100vh - 160px)" }}>
      <Spinner size={48} color="#8b5cf6"/>
      <div style={{ marginTop: 20, fontSize: 14, fontWeight: 700, color: "#a78bfa" }}>ì¬ìê³íì ìì± ì¤...</div>
      <div style={{ marginTop: 8, fontSize: 12, color: "#4b5563" }}>ìí íë¡í + ê³µê³  ìê±´ + R&D ë´ë¬í°ë¸ ì¡°í© ì¤</div>
    </div>
  );

  return (
    <div style={{ display: "flex", height: "calc(100vh - 112px)" }}>
      {/* ì¬ì´ë ëª©ì°¨ */}
      <div style={{ width: 180, borderRight: "1px solid #ffffff09", background: "#0a0c15", overflowY: "auto" }}>
        <div style={{ padding: "14px 14px 6px", fontSize: 9, color: "#4b5563", fontFamily: "monospace", textTransform: "uppercase", letterSpacing: 1 }}>ëª©ì°¨</div>
        {SECTIONS.map((sec, i) => (
          <button key={sec.id} onClick={() => setActiveSection(sec.id)}
            style={{ width: "100%", padding: "9px 14px", border: "none", background: activeSection === sec.id ? "#3b82f615" : "transparent", color: activeSection === sec.id ? "#60a5fa" : "#6b7280", fontSize: 11, cursor: "pointer", textAlign: "left", borderLeft: activeSection === sec.id ? "2px solid #3b82f6" : "2px solid transparent", fontWeight: activeSection === sec.id ? 700 : 400 }}>
            {String(i+1).padStart(2,"0")}. {sec.label}
          </button>
        ))}
        <div style={{ padding: "14px", marginTop: 8, borderTop: "1px solid #ffffff09" }}>
          <button onClick={saveProposal} disabled={saving || saved}
            style={{ width: "100%", padding: "8px", borderRadius: 8, border: "none", background: saved ? "#10b98120" : "linear-gradient(135deg,#3b82f6,#8b5cf6)", color: saved ? "#10b981" : "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
            {saving ? "ì ì¡ ì¤..." : saved ? "â Slack ê³µì ë¨" : "ð¬ Slackì ê³µì "}
          </button>
          <button onClick={() => { setProposal(null); }} style={{ width: "100%", marginTop: 6, padding: "7px", borderRadius: 8, border: "1px solid #ffffff09", background: "transparent", color: "#6b7280", fontSize: 11, cursor: "pointer" }}>
            âº ë¤ì ìì±
          </button>
        </div>
      </div>

      {/* ë³¸ë¬¸ */}
      <div style={{ flex: 1, overflowY: "auto", padding: "28px 36px" }}>
        <div style={{ maxWidth: 720 }}>
          <div style={{ marginBottom: 28, paddingBottom: 20, borderBottom: "1px solid #ffffff09" }}>
            <div style={{ fontSize: 10, color: "#8b5cf6", fontFamily: "monospace", marginBottom: 6 }}>AI ìì± ì´ì</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: "#f8fafc", lineHeight: 1.4 }}>{proposal.grantTitle}</div>
            <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
              {[proposal.agency, proposal.period, proposal.totalBudget, UMTR.company].map((v, i) => v && (
                <span key={i} style={{ fontSize: 11, padding: "3px 10px", borderRadius: 5, background: "#ffffff08", border: "1px solid #ffffff09", color: "#94a3b8" }}>{v}</span>
              ))}
            </div>
          </div>

          {/* ê°ì */}
          {(activeSection === "overview") && (
            <Section label="01. ê³¼ì  ê°ì">
              <p style={{ fontSize: 12, color: "#9ca3af", lineHeight: 1.8 }}>{proposal.overview?.applicant}</p>
              <div style={{ background: "#3b82f610", borderRadius: 8, padding: "12px 14px", border: "1px solid #3b82f625", fontSize: 12, color: "#93c5fd", lineHeight: 1.8, marginTop: 12 }}>{proposal.overview?.summary}</div>
            </Section>
          )}
          {/* ë°°ê²½ */}
          {activeSection === "background" && (
            <Section label="02. ê°ë° ë°°ê²½ ë° íìì±">
              <p style={{ fontSize: 12, color: "#9ca3af", lineHeight: 1.9, whiteSpace: "pre-wrap" }}>{proposal.background}</p>
            </Section>
          )}
          {/* ìµì¢ëª©í */}
          {activeSection === "goal" && (
            <Section label="03. ìµì¢ ëª©í">
              <div style={{ background: "#10b98110", borderRadius: 8, padding: "14px", border: "1px solid #10b98125", fontSize: 12, color: "#d1fae5", lineHeight: 1.8, marginBottom: 14 }}>{proposal.finalGoal?.statement}</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {[["ê¸°ì  ëª©í", proposal.finalGoal?.techGoals, "#3b82f6"], ["ì¬ìí ëª©í", proposal.finalGoal?.bizGoals, "#8b5cf6"]].map(([title, items, color]) => (
                  <div key={title} style={{ background: "#ffffff05", borderRadius: 8, padding: "14px", border: "1px solid #ffffff09" }}>
                    <div style={{ fontSize: 10, color, fontWeight: 700, marginBottom: 8, textTransform: "uppercase" }}>{title}</div>
                    {items?.map((g, i) => <div key={i} style={{ fontSize: 11, color: "#94a3b8", padding: "3px 0", display: "flex", gap: 6 }}><span style={{ color }}>âº</span>{g}</div>)}
                  </div>
                ))}
              </div>
            </Section>
          )}
          {/* ì°ì°¨ë³ */}
          {activeSection === "annual" && (
            <Section label="04. ì°ì°¨ë³ ëª©í ë° ë´ì©">
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {proposal.annualGoals?.map((g, i) => (
                  <div key={i} style={{ background: "#0d1020", borderRadius: 12, border: `1px solid ${YC[i]}30`, borderTop: `3px solid ${YC[i]}`, padding: "16px 18px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                      <span style={{ width: 22, height: 22, borderRadius: "50%", background: YC[i]+"25", border: `2px solid ${YC[i]}50`, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: YC[i], flexShrink: 0 }}>{i+1}</span>
                      <span style={{ fontSize: 13, fontWeight: 800, color: "#f1f5f9" }}>{g.title}</span>
                      <span style={{ marginLeft: "auto", fontSize: 11, color: YC[i], fontFamily: "monospace" }}>{g.budget}</span>
                    </div>
                    <div style={{ background: YC[i]+"10", borderRadius: 7, padding: "8px 12px", fontSize: 12, color: "#e2e8f0", marginBottom: 10, border: `1px solid ${YC[i]}20` }}>ð¯ {g.milestone}</div>
                    {g.kpi?.map((k, j) => <div key={j} style={{ fontSize: 11, color: "#94a3b8", padding: "2px 0", display: "flex", gap: 6 }}><span style={{ color: YC[i] }}>â</span>{k}</div>)}
                    {g.content && <p style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.7, marginTop: 10, paddingTop: 10, borderTop: "1px solid #ffffff08" }}>{g.content}</p>}
                  </div>
                ))}
              </div>
            </Section>
          )}
          {/* ìì° */}
          {activeSection === "budget" && (
            <Section label="05. ì°êµ¬ë¹ í¸ì±">
              <div style={{ background: "#0d1020", borderRadius: 10, border: "1px solid #ffffff09", overflow: "hidden" }}>
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr", background: "#ffffff06", padding: "8px 14px" }}>
                  {["ë¹ëª©","1ì°¨ëë","2ì°¨ëë","3ì°¨ëë","í©ê³"].map(h => <div key={h} style={{ fontSize: 10, fontWeight: 700, color: "#4b5563", fontFamily: "monospace" }}>{h}</div>)}
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
          {/* ì¬ìí */}
          {activeSection === "commercialize" && (
            <Section label="06. ì¬ìí ê³í">
              <p style={{ fontSize: 12, color: "#9ca3af", lineHeight: 1.8, marginBottom: 14 }}>{proposal.commercialize?.strategy}</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div style={{ background: "#ffffff05", borderRadius: 8, padding: "14px", border: "1px solid #ffffff09" }}>
                  <div style={{ fontSize: 10, color: "#f59e0b", fontWeight: 700, marginBottom: 8 }}>ëª©í ìì¥Â·ê³ ê°</div>
                  {proposal.commercialize?.targets?.map((t, i) => <div key={i} style={{ fontSize: 11, color: "#94a3b8", padding: "2px 0" }}>Â· {t}</div>)}
                  <div style={{ marginTop: 10, fontSize: 12, color: "#fcd34d", fontWeight: 700 }}>ëª©í ë§¤ì¶: {proposal.commercialize?.revenueGoal}</div>
                </div>
                <div style={{ background: "#ffffff05", borderRadius: 8, padding: "14px", border: "1px solid #ffffff09" }}>
                  <div style={{ fontSize: 10, color: "#8b5cf6", fontWeight: 700, marginBottom: 8 }}>ì¬ìí ë¡ëë§µ</div>
                  {proposal.commercialize?.roadmap?.map((r, i) => <div key={i} style={{ fontSize: 11, color: "#94a3b8", padding: "3px 0", display: "flex", gap: 6 }}><span style={{ color: "#8b5cf6" }}>0{i+1}</span>{r}</div>)}
                </div>
              </div>
            </Section>
          )}
          {/* ê¸°ëí¨ê³¼ */}
          {activeSection === "effect" && (
            <Section label="07. ê¸°ëí¨ê³¼">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 14 }}>
                {[["ê¸°ì ì ", proposal.effect?.tech, "#3b82f6"], ["ê²½ì ì ", proposal.effect?.economy, "#10b981"], ["ì¬íì ", proposal.effect?.social, "#f59e0b"]].map(([label, items, color]) => (
                  <div key={label} style={{ background: "#ffffff05", borderRadius: 8, padding: "14px", border: "1px solid #ffffff09" }}>
                    <div style={{ fontSize: 10, color, fontWeight: 700, marginBottom: 8 }}>{label} í¨ê³¼</div>
                    {items?.map((e, i) => <div key={i} style={{ fontSize: 11, color: "#94a3b8", padding: "2px 0", lineHeight: 1.5 }}>Â· {e}</div>)}
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

// âââ ë©ì¸ ì± âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
export default function App() {
  const [tab, setTab] = useState("search");
  const [prefillGrant, setPrefillGrant] = useState(null);

  function handleSelectGrant(grant) {
    setPrefillGrant(grant);
    setTab("proposal");
  }

  const TABS = [
    { id: "search", label: "ð ê³µê³  íì" },
    { id: "proposal", label: "âï¸ ì¬ìê³íì" },
  ];

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#060810", color: "#e2e8f0", fontFamily: "'Noto Sans KR', -apple-system, sans-serif" }}>
      <Head>
        <title>GRANTIQ â {UMTR.company}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1"/>
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;900&display=swap" rel="stylesheet"/>
      </Head>
      <style>{`*{box-sizing:border-box;margin:0;padding:0} @keyframes spin{to{transform:rotate(360deg)}} body{background:#060810}`}</style>

      {/* í¤ë */}
      <div style={{ padding: "0 28px", borderBottom: "1px solid #ffffff09", background: "#0a0c15", display: "flex", alignItems: "center", height: 56, position: "sticky", top: 0, zIndex: 50, backdropFilter: "blur(12px)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginRight: 32 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: "linear-gradient(135deg,#3b82f6,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 900 }}>G</div>
          <span style={{ fontSize: 14, fontWeight: 900 }}>GRANTIQ</span>
        </div>
        {/* í­ */}
        <div style={{ display: "flex", height: "100%", gap: 2 }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{ padding: "0 18px", border: "none", background: "transparent", color: tab === t.id ? "#60a5fa" : "#6b7280", fontSize: 12, fontWeight: tab === t.id ? 700 : 400, cursor: "pointer", borderBottom: tab === t.id ? "2px solid #3b82f6" : "2px solid transparent", height: "100%" }}>
              {t.label}
            </button>
          ))}
        </div>
        {/* ê¸°ì íì */}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#10b981", animation: "pulse 2s infinite" }}/>
          <span style={{ fontSize: 11, color: "#10b981" }}>ì¤ìê° ê²ì</span>
          <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 5, background: "#3b82f615", border: "1px solid #3b82f630", color: "#60a5fa" }}>{UMTR.company}</span>
        </div>
      </div>

      {/* ì½íì¸  */}
      {tab === "search" && <GrantSearch onSelectGrant={handleSelectGrant}/>}
      {tab === "proposal" && <ProposalGenerator prefillGrant={prefillGrant}/>}
    </div>
  );
}
