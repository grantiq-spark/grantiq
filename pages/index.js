// pages/index.js \u2014 GRANTIQ \uBA54\uC778 \uB300\uC2DC\uBCF4\uB4DC (\uB300\uD45C/\uC784\uC6D0\uC6A9)
import { useState } from "react";
import Head from "next/head";
import { jsonrepair } from "jsonrepair";

// \u2400\u2400\u2400 \uACF5\uD1B5 \uC0C1\uC218 \u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400
const UMTR = {
  company: process.env.NEXT_PUBLIC_COMPANY_NAME || "\u2468\uC6C0\uD2C0",
  mainBiz: "\uBC14\uC774\uC624\uC0B0\uC5C5\uC6A9 NC/PES \uBA64\uBE0C\uB808\uC778\u00B7\uD544\uD130 \uC5F0\uAD6C\uAC1C\uBC1C\u00B7\uC81C\uC870",
  keywords: ["\uBC14\uC774\uC624 \uBA64\uBE0C\uB808\uC778", "\uC18C\uBD80\uC7A5 \uAD6D\uC0B0\uD654", "PES \uC911\uACF5\uC0AC\uB9C9\uC778", "NC \uBA64\uBE0C\uB808\uC778", "TFF \uBAA8\uB4C8", "\uC7AC\uAD00\uD544\uD130", "GMP", "\uCCB4\uC678\uC9C4\uB2E8\uAE30\uAE30", "ISO13485"],
};

const PRESET_QUERIES = [
  { label: "\uBC14\uC774\uC624 \uC18C\uBD80\uC7A5", q: "\uBC14\uC774\uC624 \uC18C\uBD80\uC7A5 R&D \uC9C0\uC6D0\uC0AC\uC5C5 \uACF5\uACE0 2025 2026" },
  { label: "\uBA64\uBE0C\uB808\uC778 \uAE30\uC220\uAC1C\uBC1C", q: "\uBA64\uBE0C\uB808\uC778 \uD544\uD130 \uAE30\uC220\uAC1C\uBC1C \uC815\uBD80 R&D \uAE08\uACE0 2026" },
  { label: "\uC0B0\uC5C5\uD1B5\uC0C1\uC790\uC6D0\uBD80", q: "\uC0B0\uC5C5\uD1B5\uC0C1\uC790\uC6D0\uBD80 \uC18C\uC7AC\uBD80\uD488\uC7A5\uBE44 R&D \uACF5\uACE0 2026" },
  { label: "\uCC3D\uC5C5\u00B7\uBCA4\uCC98", q: "\uBC14\uC774\uC624 \uCC3D\uC5C5\uC9C0\uC6D0 \uBCA4\uCC98\uC721\uC131 2026 \uC18C\uBD80\uC7A5" },
  { label: "IRIS \uAC80\uC0C9", q: "iris.go.kr \uBA64\uBE0C\uB808\uC778 \uBD84\uB9AC\uB9C9 R&D 2026" },
];

// \u2400\u2400\u2400 API \uD638\uCD9C \uD5EC\uD37C \u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400
async function callClaude(body) {
  const res = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data.error || "API \uC624\uB958");
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

// \u2400\u2400\u2400 IRIS \uD30C\uC774\uD504\uB77C\uC778 API \u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400
async function callIrisSearch(query, source) {
  const res = await fetch("/api/iris/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, source: source || "all" }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "IRIS \uAC80\uC0C9 \uC624\uB958");
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
  if (!res.ok) throw new Error(data.error || "RFP \uBD84\uC11D \uC624\uB958");
  return data;
}

// \u2400\u2400\u2400 \uACF5\uD1B5 \uCEF4\uD3EC\uB10C\uD2B8 \u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400
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

// \u2400\u2400\u2400 \uACF5\uACE0 \uD0D0\uC0C9 \uD0ED \u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400
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
    setSearching(true); setGrants([]); setSelected(null); setStatus("\uAC80\uC0C9 \uC911...");
    try {
      const data = await callClaude({
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        messages: [{
          role: "user",
          content: `\uD55C\uAD6D \uC815\uBD80 R&D \uACF5\uACE0 \uAC80\uC0C9: "${sq}"\n\uAE30\uC5C5: ${UMTR.company} (${UMTR.mainBiz})\n\uD0A4\uC6CC\uB4DC: ${UMTR.keywords.join(", ")}\n\n\uC8FC\uC694 \uCD9C\uCC98: iris.go.kr, ntis.go.kr, mss.go.kr, keit.re.kr, bioin.or.kr\n\n\uACB0\uACFC\uB294 JSON\uC73C\uB85C: {"grants":[{"title":"","agency":"","deadline":"","budget":"","matchScore":0\u223C100,"reason":"","url":"","source":""}],"searchSummary":""}`,
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
      setStatus(parsed.searchSummary || `${sorted.length}\uAC1C \uACF5\uACE0`);
    } catch (err) {
      console.error("Search error:", err);
      const msg = err.code === "RATE_LIMIT"
        ? "\u26A0\uFE0F API \uC694\uCCAD \uD55C\uB3C4 \uCD08\uACFC. 1\uBD84 \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574\uC8FC\uC138\uC694."
        : err.code === "AUTH_ERROR"
        ? "\u274C API \uD0A4 \uC624\uB958. \uAD00\uB9AC\uC790\uC5D0\uAC8C \uBB38\uC758\uD558\uC138\uC694."
        : err.code === "OVERLOADED"
        ? "\u23F3 Claude \uC11C\uBC84 \uD63C\uC7A1. \uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574\uC8FC\uC138\uC694."
        : "\u274C " + (err.message || "\uAC80\uC0C9 \uC2E4\uD328");
      setStatus(msg);
    }
    finally { setSearching(false); }
  }

  async function analyze(grant) {
    if (analysis[grant.title]) return;
    setAnalyzing(grant.title);
    try {
      const data = await callClaude({
        messages: [{
          role: "user",
          content: `\uAE30\uC5C5: ${UMTR.company} | ${UMTR.mainBiz} | \uD0A4\uC6CC\uB4DC: ${UMTR.keywords.join(", ")}\n\uACF5\uACE0: ${grant.title}\n\uAE30\uAD00: ${grant.agency}\n\n\uBD84\uC11D JSON: {"verdict":"S|A|B|C","fitScore":0\u223C100,"reasons":["\uAD6C\uCCB4\uC801 \uC774\uC720"],"strategy":"\uC811\uADFC\uC804\uB7B5","risk":"\uC8FC\uC694\uC704\uD5D8"}`,
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
    } catch { alert("Slack \uC804\uC1A1 \uC2E4\uD328. .env SLACK_WEBHOOK_URL \uD655\uC778"); }
  }

  const s = selected; const an = s ? analysis[s.title] : null;
  const gColor = c => ({ S: "#10b981", A: "#3b82f6", B: "#f59e0b", C: "#6b7280" }[c] || "#6b7280");

  return (
    <div style={{ display: "flex", height: "calc(100vh - 112px)", gap: 0 }}>
      {/* \uB9AC\uC2A4\uD2B8 \uD328\uB110 */}
      <div style={{ width: 420, borderRight: "1px solid #ffffff09", display: "flex", flexDirection: "column" }}>
        {/* \uAC80\uC0C9\uCC3D */}
        <div style={{ padding: "14px 16px", borderBottom: "1px solid #ffffff09", background: "#0a0c15" }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === "Enter" && search()}
              placeholder="\uACF5\uACE0 \uAC80\uC0C9\uC5B4 \uC785\uB825..."
              style={{ flex: 1, background: "#ffffff08", border: "1px solid #ffffff09", borderRadius: 8, padding: "9px 14px", color: "#e2e8f0", fontSize: 13, outline: "none" }}/>
            <button onClick={() => search()} disabled={searching}
              style={{ padding: "9px 16px", borderRadius: 8, border: "none", background: searching ? "#1e1e2e" : "#3b82f6", color: "#fff", cursor: "pointer", fontSize: 13 }}>
              {searching ? <Spinner size={16} color="#6b7280"/> : "\uAC80\uC0C9"}
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
        {/* \uC0C1\uD0DC */}
        {status && (
          <div style={{ padding: "8px 16px", fontSize: 11, color: searching ? "#8b5cf6" : "#10b981", display: "flex", gap: 6, alignItems: "center" }}>
            {searching && <Spinner size={12} color="#8b5cf6"/>} {status}
          </div>
        )}
        {/* \uB9AC\uC2A4\uD2B8 */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {grants.length === 0 && !searching && (
            <div style={{ padding: "50px 20px", textAlign: "center", color: "#374151" }}>
              <div style={{ fontSize: 28, marginBottom: 10 }}>&#128270;</div>
              <div style={{ fontSize: 12 }}>\uC704 \uBC84\uD2BC\uC73C\uB85C \uACF5\uACE0\uB97C \uAC80\uC0C9\uD574\uBCF4\uC138\uC694</div>
            </div>
          )}
          {!searching && status && <p style={{ padding: "8px 12px", color: status.includes("\u26A0") || status.includes("\u274C") ? "#ef4444" : "#4b5563", fontSize: 11 }}></p>}
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

      {/* \uC0C1\uC138 \uD328\uB110 */}
      <div style={{ flex: 1, overflowY: "auto", padding: "28px 32px" }}>
        {!s ? (
          <div style={{ textAlign: "center", color: "#374151", marginTop: 120 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>&#128209;</div>
            <div style={{ fontSize: 13 }}>\uACF5\uACE0\uB97C \uC120\uD0DD\uD558\uBA74 \uC0C1\uC138 \uBD84\uC11D\uC774 \uD45C\uC2DC\uB429\uB2C8\uB2E4</div>
          </div>
        ) : (
          <div style={{ maxWidth: 680 }}>
            <div style={{ fontSize: 20, fontWeight: 900, color: "#f8fafc", lineHeight: 1.4, marginBottom: 8 }}>{s.title}</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
              {[s.agency, s.deadline, s.budget, s.source].filter(Boolean).map((v, i) =>
                <span key={i} style={{ fontSize: 10, padding: "3px 10px", borderRadius: 5, background: "#ffffff08", color: "#9ca3af" }}>{v}</span>
              )}
            </div>
            {s.url && <a href={s.url} target="_blank" rel="noopener" style={{ fontSize: 11, color: "#3b82f6" }}>\uACF5\uACE0 \uC6D0\uBB38 \u2192</a>}
            <div style={{ marginTop: 16 }}>
              {s.reason && <p style={{ fontSize: 12, color: "#9ca3af", lineHeight: 1.8, marginBottom: 12 }}>{s.reason}</p>}

              {/* \uBD84\uC11D \uACB0\uACFC */}
              {analyzing === s.title ? (
                <div style={{ padding: 20, textAlign: "center" }}><Spinner size={24}/><div style={{ fontSize: 11, color: "#6b7280", marginTop: 8 }}>\uBD84\uC11D \uC911...</div></div>
              ) : an ? (
                <div style={{ background: "#0d1020", borderRadius: 12, padding: 16, border: "1px solid #ffffff09", marginBottom: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                    <div style={{ fontSize: 28, fontWeight: 900, color: gColor(an.verdict) }}>{an.verdict}</div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#f1f5f9" }}>\uC801\uD569\uB3C4: {an.fitScore}%</div>
                      <div style={{ fontSize: 10, color: "#6b7280" }}>\uB9AC\uC2A4\uD06C: {an.risk}</div>
                    </div>
                  </div>
                  {an.reasons?.map((r, i) => <div key={i} style={{ fontSize: 11, color: "#94a3b8", padding: "3px 0", borderBottom: "1px solid #ffffff06" }}>\u2022 {r}</div>)}
                  {an.strategy && <div style={{ fontSize: 11, color: "#a78bfa", marginTop: 8 }}>\uC804\uB7B5: {an.strategy}</div>}
                </div>
              ) : null}

              {/* \uBC84\uD2BC */}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                <button onClick={() => onSelectGrant(s)}
                  style={{ padding: "10px 20px", borderRadius: 8, border: "none", background: "linear-gradient(135deg, #8b5cf6, #6366f1)", color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>
                  \u270D\uFE0F \uC0AC\uC5C5\uACC4\uD68D\uC11C \uC791\uC131
                </button>
                <button onClick={() => saveGrant(s)} disabled={saved[s.title]}
                  style={{ padding: "10px 16px", borderRadius: 8, border: "1px solid #ffffff12", background: saved[s.title] ? "#10b98120" : "#ffffff06", color: saved[s.title] ? "#10b981" : "#9ca3af", cursor: "pointer", fontSize: 12 }}>
                  {saved[s.title] ? "\u2713 Slack \uC804\uC1A1\uC644\uB8CC" : "Slack \uACF5\uC720"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// \u2400\u2400\u2400 \uC0AC\uC5C5\uACC4\uD68D\uC11C \uD0ED (\uD30C\uC774\uD504\uB77C\uC778 \uD1B5\uD569) \u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400\u2400
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
    { id: "overview", label: "\uACFC\uC81C \uAC1C\uC694" },
    { id: "background", label: "\uBC30\uACBD\u00B7\uD544\uC694\uC131" },
    { id: "goal", label: "\uCD5C\uC885 \uBAA9\uD45C" },
    { id: "annual", label: "\uC5F0\uCC28\uBCC4 \uBAA9\uD45C" },
    { id: "budget", label: "\uC608\uC0B0 \uD3B8\uC131" },
    { id: "commercialize", label: "\uC0AC\uC5C5\uD654 \uACC4\uD68D" },
    { id: "effect", label: "\uAE30\uB300\uD6A8\uACFC" },
  ];

  const PIPELINE_STEPS = ["RFP \uBD84\uC11D", "\uC0AC\uC5C5\uACC4\uD68D\uC11C", "\uC7AC\uACBD\uBD84\uC11D"];

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
      alert("RFP \uBD84\uC11D \uC2E4\uD328: " + (err.message || "\uB2E4\uC2DC \uC2DC\uB3C4\uD574\uC8FC\uC138\uC694"));
    }
    finally { setRfpLoading(false); }
  }

  // Step 2: Generate proposal (enhanced with RFP data)
  async function generate() {
    setGenerating(true); setProposal(null);
    try {
      const rfpContext = rfpResult?.rfp ? `
RFP \uBD84\uC11D \uACB0\uACFC:
- \uBAA9\uC801: ${rfpResult.rfp.objectives || "N/A"}
- \uBC94\uC704: ${rfpResult.rfp.scope || "N/A"}
- \uCD1D \uC608\uC0B0: ${rfpResult.rfp.budget_total || info.budget}
- \uACFC\uC81C\uB2F9 \uC608\uC0B0: ${rfpResult.rfp.budget_per_project || "N/A"}
- \uAE30\uAC04: ${rfpResult.rfp.duration || info.years + "\uB144"}
- \uC790\uACA9\uC694\uAC74: ${rfpResult.rfp.eligibility || "N/A"}
- \uD3C9\uAC00\uAE30\uC900: ${rfpResult.rfp.evaluation_criteria || "N/A"}
- \uD575\uC2EC\uC694\uAD6C\uC0AC\uD56D: ${rfpResult.rfp.key_requirements || "N/A"}
- \uB300\uC751\uC790\uAE08: ${rfpResult.rfp.matching_fund || "N/A"}` : "";

      const fitContext = rfpResult?.fit_analysis ? `
\uC801\uD569\uB3C4 \uBD84\uC11D:
- \uC810\uC218: ${rfpResult.fit_analysis.overall_score}/100
- \uAC15\uC810: ${rfpResult.fit_analysis.strengths?.join(", ") || "N/A"}
- \uBCF4\uC644\uC810: ${rfpResult.fit_analysis.weaknesses?.join(", ") || "N/A"}
- \uBD80\uD569 \uC5ED\uB7C9: ${rfpResult.fit_analysis.matching_capabilities?.join(", ") || "N/A"}` : "";

      const data = await callClaude({
        max_tokens: 4000,
        messages: [{
          role: "user",
          content: `\uD55C\uAD6D R&D \uC0AC\uC5C5\uACC4\uD68D\uC11C \uCD08\uC548. \uC21C\uC218 JSON\uB9CC \uCD9C\uB825.

\uAE30\uC5C5: ${UMTR.company} | ${UMTR.mainBiz}
\uD604\uD669: \uD30C\uC77C\uB7FF NC/PES \uBA64\uBE0C\uB808\uC778 \uC0DD\uC0B0. ISO 13485. \uC0BC\uC131\uBC14\uC774\uC624\uB85C\uC9C1\uC2A4 \uACF5\uB3D9\uC2E4\uC99D \uC644\uB8CC. R&D \uC5F0\uAC04 10\uC5B5+. \uC624\uC1A1 \uBD80\uC9C0 \uD655\uBCF4.
\uBB38\uC81C: \uBC14\uC774\uC624 \uC18C\uBD80\uC7A5 \uAD6D\uC0B0\uD654\uC728 6%, GMP \uC0DD\uC0B0\uC2DC\uC124 \uBD80\uC7AC.
\uB0B4\uB7EC\uD2F0\uBE0C: "\uC9C0\uAE08\uAE4C\uC9C0 \uD575\uC2EC \uAE30\uC220\uC744 \uD655\uBCF4\uD574\uC654\uACE0 R&D \uD380\uB4DC\uB85C \uB300\uB7C9\uC0DD\uC0B0 \uBB38\uC81C\uB97C \uD6CC\uC801 \uD574\uACB0\uD560 \uC218 \uC788\uB2E4"
${rfpContext}
${fitContext}

\uACF5\uACE0: ${info.title} / ${info.agency} / ${info.budget || "N/A"} / ${info.years}\uB144

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
      alert("\uC0DD\uC131 \uC2E4\uD328: " + (err.message || "\uB2E4\uC2DC \uC2DC\uB3C4\uD574\uC8FC\uC138\uC694"));
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
          content: `CFO \uAD00\uC810 \uC7AC\uACBD\uBD84\uC11D. \uC21C\uC218 JSON\uB9CC \uCD9C\uB825.

\uAE30\uC5C5: ${UMTR.company} | ${UMTR.mainBiz}
\uACF5\uACE0: ${proposal.grantTitle || info.title}
\uCD1D \uC608\uC0B0: ${proposal.totalBudget || info.budget}
\uAE30\uAC04: ${proposal.period || info.years + "\uB144"}
\uC0AC\uC5C5\uD654: ${proposal.commercialization?.strategy || "N/A"}
\uBAA9\uD45C\uC2DC\uC7A5: ${proposal.commercialization?.targetMarket || "N/A"}
\uC608\uC0C1\uB9E4\uCD9C: ${proposal.commercialization?.revenue || "N/A"}

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
      alert("\uC7AC\uACBD\uBD84\uC11D \uC2E4\uD328: " + (err.message || "\uB2E4\uC2DC \uC2DC\uB3C4"));
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
    } catch { alert("Slack \uC804\uC1A1 \uC2E4\uD328"); }
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
        <div style={{ fontSize: 28, marginBottom: 8 }}>\u270D\uFE0F</div>
        <div style={{ fontSize: 18, fontWeight: 900, color: "#f1f5f9", marginBottom: 6 }}>\uC0AC\uC5C5\uACC4\uD68D\uC11C \uD30C\uC774\uD504\uB77C\uC778</div>
        <div style={{ fontSize: 12, color: "#6b7280" }}>\uACF5\uACE0 \uC815\uBCF4 \u2192 RFP \uBD84\uC11D \u2192 \uCD08\uC548 \uC0DD\uC131 \u2192 \uC7AC\uACBD\uBD84\uC11D</div>
      </div>

      <div style={{ background: "#0a0c15", borderRadius: 14, border: "1px solid #ffffff09", padding: 20 }}>
        {[
          { key: "title", label: "\uACF5\uACE0\uBA85 *", ph: "\uC608: \uBC14\uC774\uC624 \uC18C\uBD80\uC7A5 \uAE30\uC220\uAC1C\uBC1C \uC9C0\uC6D0\uC0AC\uC5C5" },
          { key: "agency", label: "\uC8FC\uAD00\uAE30\uAD00", ph: "\uC608: \uC0B0\uC5C5\uD1B5\uC0C1\uC790\uC6D0\uBD80" },
          { key: "budget", label: "\uC608\uC0B0\uADDC\uBAA8", ph: "\uC608: 30\uC5B5\uC6D0" },
          { key: "url", label: "\uACF5\uACE0 URL", ph: "https://..." },
          { key: "summary", label: "\uACF5\uACE0 \uC694\uC57D", ph: "\uACF5\uACE0 \uB0B4\uC6A9 \uAC04\uB7B5 \uC785\uB825 (\uC120\uD0DD)", rows: 3 },
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
            <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 5 }}>\uC5F0\uAD6C\uAE30\uAC04</div>
            <select value={info.years} onChange={e => setInfo(p => ({ ...p, years: e.target.value }))}
              style={{ width: "100%", background: "#ffffff06", border: "1px solid #ffffff09", borderRadius: 8, padding: "10px 14px", color: "#e2e8f0", fontSize: 13 }}>
              {["2", "3", "4", "5"].map(y => <option key={y} value={y}>{y}\uB144</option>)}
            </select>
          </div>
        </div>

        <button onClick={analyzeRfp} disabled={!info.title}
          style={{ width: "100%", marginTop: 18, padding: "14px", borderRadius: 12, border: "none",
            background: info.title ? "linear-gradient(135deg, #8b5cf6, #6366f1)" : "#1e1e2e",
            color: info.title ? "#fff" : "#4b5563", cursor: info.title ? "pointer" : "default", fontSize: 14, fontWeight: 700 }}>
          \uD83D\uDD0D RFP \uBD84\uC11D \uC2DC\uC791
        </button>

        <button onClick={() => { setStep("proposal"); generate(); }} disabled={!info.title}
          style={{ width: "100%", marginTop: 8, padding: "10px", borderRadius: 10, border: "1px solid #ffffff12",
            background: "transparent", color: "#6b7280", cursor: "pointer", fontSize: 12 }}>
          RFP \uBD84\uC11D \uAC74\uB108\uB6F0\uACE0 \uBC14\uB85C \uCD08\uC548 \uC0DD\uC131 \u2192
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
        <div style={{ marginTop: 20, fontSize: 14, fontWeight: 700, color: "#a78bfa" }}>RFP \uBD84\uC11D \uC911...</div>
        <div style={{ marginTop: 8, fontSize: 12, color: "#4b5563" }}>IRIS/NTIS \uACF5\uACE0 \uC815\uBCF4 \uC218\uC9D1 + \uC6C0\uD2C0 \uC801\uD569\uB3C4 \uBD84\uC11D</div>
        <div style={{ marginTop: 4, fontSize: 11, color: "#374151" }}>30\uCD08~1\uBD84 \uC18C\uC694</div>
      </div>
    </div>
  );

  if (generating) return (
    <div style={{ maxWidth: 600, margin: "40px auto", padding: "0 24px" }}>
      <StepIndicator steps={PIPELINE_STEPS} current={1}/>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 0" }}>
        <Spinner size={36}/>
        <div style={{ marginTop: 20, fontSize: 14, fontWeight: 700, color: "#a78bfa" }}>\uC0AC\uC5C5\uACC4\uD68D\uC11C \uCD08\uC548 \uC0DD\uC131 \uC911...</div>
        <div style={{ marginTop: 8, fontSize: 12, color: "#4b5563" }}>\uC6C0\uD2C0 \uD504\uB85C\uD544 + \uACF5\uACE0 \uC694\uAC74 + R&D \uC804\uB7B5 \uBC18\uC601</div>
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
              <div style={{ fontSize: 18, fontWeight: 900, color: "#f1f5f9" }}>\uC801\uD569\uB3C4 \uBD84\uC11D \uACB0\uACFC</div>
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
              ["\uAC15\uC810", fit.strengths, "#10b981"],
              ["\uBCF4\uC644\uC810", fit.weaknesses, "#f59e0b"],
              ["\uBD80\uD569 \uC5ED\uB7C9", fit.matching_capabilities, "#3b82f6"],
              ["\uBD80\uC871 \uC694\uAC74", fit.missing_requirements, "#ef4444"],
            ].map(([title, items, color]) => (
              <div key={title} style={{ background: "#ffffff04", borderRadius: 10, padding: 14 }}>
                <div style={{ fontSize: 10, color, fontWeight: 700, marginBottom: 8, textTransform: "uppercase" }}>{title}</div>
                {(items || []).map((item, i) => <div key={i} style={{ fontSize: 11, color: "#94a3b8", padding: "3px 0" }}>\u2022 {item}</div>)}
                {(!items || items.length === 0) && <div style={{ fontSize: 11, color: "#374151" }}>-</div>}
              </div>
            ))}
          </div>
        </div>

        {/* RFP \uC694\uC57D */}
        {rfp.objectives && (
          <div style={{ background: "#0a0c15", borderRadius: 14, border: "1px solid #ffffff09", padding: 20, marginBottom: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: "#f1f5f9", marginBottom: 14 }}>RFP \uC694\uC57D</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {[
                ["\uBAA9\uC801", rfp.objectives],
                ["\uBC94\uC704", rfp.scope],
                ["\uCD1D\uC608\uC0B0", rfp.budget_total],
                ["\uACFC\uC81C\uB2F9", rfp.budget_per_project],
                ["\uAE30\uAC04", rfp.duration],
                ["\uC790\uACA9", rfp.eligibility],
                ["\uB9C8\uAC10", rfp.deadline],
                ["\uB300\uC751\uC790\uAE08", rfp.matching_fund],
              ].filter(([, v]) => v).map(([label, value]) => (
                <div key={label}>
                  <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 3 }}>{label}</div>
                  <div style={{ fontSize: 12, color: "#d1d5db", lineHeight: 1.6 }}>{value}</div>
                </div>
              ))}
            </div>
            {rfp.evaluation_criteria && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 3 }}>\uD3C9\uAC00\uAE30\uC900</div>
                <div style={{ fontSize: 12, color: "#d1d5db", lineHeight: 1.6 }}>{rfp.evaluation_criteria}</div>
              </div>
            )}
          </div>
        )}

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => { setStep("input"); setRfpResult(null); }}
            style={{ padding: "10px 18px", borderRadius: 10, border: "1px solid #ffffff12", background: "transparent", color: "#6b7280", cursor: "pointer", fontSize: 12 }}>
            \u2190 \uB2E4\uC2DC \uC785\uB825
          </button>
          <button onClick={generate} disabled={generating}
            style={{ flex: 1, padding: "14px", borderRadius: 12, border: "none",
              background: "linear-gradient(135deg, #8b5cf6, #6366f1)", color: "#fff", cursor: "pointer", fontSize: 14, fontWeight: 700 }}>
            \u270D\uFE0F \uC0AC\uC5C5\uACC4\uD68D\uC11C \uCD08\uC548 \uC0DD\uC131
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
              <div style={{ fontSize: 18, fontWeight: 900, color: "#f1f5f9" }}>CFO \uC7AC\uACBD\uBD84\uC11D</div>
              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>{finResult.reason}</div>
            </div>
          </div>

          {/* Cost Estimate */}
          {finResult.costEstimate && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#a78bfa", marginBottom: 10 }}>\uC0AC\uC5C5\uBE44 \uAD6C\uC870</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10 }}>
                {[
                  ["\uCD1D \uC0AC\uC5C5\uBE44", finResult.costEstimate.totalProject],
                  ["\uC815\uBD80\uCD9C\uC5F0", finResult.costEstimate.govFunding],
                  ["\uC790\uBD80\uB2F4", finResult.costEstimate.selfFunding],
                  ["\uBE44\uC728", finResult.costEstimate.matchingRatio],
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
              <div style={{ fontSize: 12, fontWeight: 700, color: "#10b981", marginBottom: 10 }}>ROI \uBD84\uC11D</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                {[
                  ["\uAE30\uB300\uC218\uC775", finResult.roi.expectedReturn],
                  ["\uD68C\uC218\uAE30\uAC04", finResult.roi.paybackPeriod],
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
              <div style={{ fontSize: 12, fontWeight: 700, color: "#3b82f6", marginBottom: 10 }}>\uD604\uAE08\uD750\uB984</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10 }}>
                {[
                  ["1\uCC28\uB144", finResult.cashFlow.year1],
                  ["2\uCC28\uB144", finResult.cashFlow.year2],
                  ["3\uCC28\uB144", finResult.cashFlow.year3],
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
              <div style={{ fontSize: 12, fontWeight: 700, color: "#f59e0b", marginBottom: 10 }}>\uC704\uD5D8 \uC694\uC18C</div>
              {finResult.risks.map((r, i) => (
                <div key={i} style={{ background: "#ffffff04", borderRadius: 8, padding: 12, marginBottom: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 12, color: "#d1d5db" }}>{r.item}</span>
                    <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4,
                      background: r.impact === "high" ? "#ef444420" : r.impact === "mid" ? "#f59e0b20" : "#10b98120",
                      color: r.impact === "high" ? "#ef4444" : r.impact === "mid" ? "#f59e0b" : "#10b981" }}>{r.impact}</span>
                  </div>
                  {r.mitigation && <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>\uB300\uC751: {r.mitigation}</div>}
                </div>
              ))}
            </div>
          )}

          {/* Key Metrics */}
          {finResult.keyMetrics?.length > 0 && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#8b5cf6", marginBottom: 10 }}>\uD575\uC2EC \uC9C0\uD45C</div>
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
            \u2190 \uC0AC\uC5C5\uACC4\uD68D\uC11C
          </button>
          <button onClick={saveProposal} disabled={saving || saved}
            style={{ flex: 1, padding: "14px", borderRadius: 12, border: "none",
              background: saved ? "#10b98140" : "linear-gradient(135deg, #10b981, #059669)", color: "#fff", cursor: "pointer", fontSize: 14, fontWeight: 700 }}>
            {saved ? "\u2713 Slack \uC804\uC1A1 \uC644\uB8CC" : "\uD83D\uDCE4 Slack\uC73C\uB85C \uC804\uCCB4 \uBCF4\uACE0"}
          </button>
        </div>
      </div>
    );
  }

  // ===== PROPOSAL VIEW =====
  if (!proposal) return null;
  return (
    <div style={{ display: "flex", height: "calc(100vh - 112px)" }}>
      {/* \uC0AC\uC774\uB4DC\uBC14 */}
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
              {finLoading ? <Spinner size={14} color="#fbbf24"/> : "\uD83D\uDCCA \uC7AC\uACBD\uBD84\uC11D"}
            </button>
          )}
          {finResult && (
            <button onClick={() => setStep("financial")}
              style={{ width: "100%", padding: "8px", borderRadius: 8, border: "none", background: "#10b98120", color: "#10b981", cursor: "pointer", fontSize: 11, fontWeight: 700, marginBottom: 6 }}>
              \u2713 \uC7AC\uACBD\uBD84\uC11D \uBCF4\uAE30
            </button>
          )}
          <button onClick={saveProposal} disabled={saving || saved}
            style={{ width: "100%", padding: "8px", borderRadius: 8, border: "none", background: saved ? "#10b98120" : "#8b5cf620", color: saved ? "#10b981" : "#a78bfa", cursor: "pointer", fontSize: 11, marginBottom: 6 }}>
            {saved ? "\u2713 Slack \uC804\uC1A1\uC644\uB8CC" : "Slack \uBCF4\uACE0"}
          </button>
          <button onClick={() => { setProposal(null); setRfpResult(null); setFinResult(null); setStep("input"); setSaved(false); }}
            style={{ width: "100%", marginTop: 4, padding: "6px", borderRadius: 8, border: "1px solid #ffffff09", background: "transparent", color: "#4b5563", cursor: "pointer", fontSize: 10 }}>
            \uCC98\uC74C\uBD80\uD130
          </button>
        </div>

        {/* RFP \uC801\uD569\uB3C4 \uBBF8\uB2C8 */}
        {rfpResult?.fit_analysis && (
          <div style={{ padding: "0 14px 14px", marginTop: "auto" }}>
            <div style={{ background: "#ffffff04", borderRadius: 8, padding: 10, textAlign: "center" }}>
              <div style={{ fontSize: 9, color: "#6b7280", marginBottom: 4 }}>\uC801\uD569\uB3C4</div>
              <ScoreRing score={rfpResult.fit_analysis.overall_score || 0} size={44}/>
              <div style={{ fontSize: 10, marginTop: 4, fontWeight: 700,
                color: recColor(rfpResult.fit_analysis.recommendation) }}>
                {rfpResult.fit_analysis.recommendation}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* \uBCF8\uBB38 */}
      <div style={{ flex: 1, overflowY: "auto", padding: "28px 36px" }}>
        <div style={{ maxWidth: 720 }}>
          <div style={{ marginBottom: 28, paddingBottom: 20, borderBottom: "1px solid #ffffff09" }}>
            <div style={{ fontSize: 10, color: "#8b5cf6", fontFamily: "monospace", marginBottom: 6 }}>GRANTIQ \u00B7 \uC0AC\uC5C5\uACC4\uD68D\uC11C \uCD08\uC548</div>
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
              <h3 style={{ fontSize: 16, fontWeight: 800, color: "#f1f5f9", marginBottom: 14 }}>1. \uACFC\uC81C \uAC1C\uC694</h3>
              <p style={{ fontSize: 12, color: "#9ca3af", lineHeight: 1.8 }}>{proposal.overview.summary}</p>
              <div style={{ background: "#3b82f610", borderRadius: 8, padding: "12px 14px", border: "1px solid #3b82f620", marginTop: 14 }}>
                <div style={{ fontSize: 10, color: "#3b82f6", fontWeight: 700, marginBottom: 4 }}>\uC2E0\uCCAD\uC790</div>
                <div style={{ fontSize: 12, color: "#d1d5db" }}>{proposal.overview.applicant}</div>
                {proposal.overview.techField && <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>\uAE30\uC220\uBD84\uC57C: {proposal.overview.techField}</div>}
              </div>
            </div>
          )}

          {activeSection === "background" && proposal.background && (
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: "#f1f5f9", marginBottom: 14 }}>2. \uBC30\uACBD \uBC0F \uD544\uC694\uC131</h3>
              <p style={{ fontSize: 12, color: "#9ca3af", lineHeight: 1.9, whiteSpace: "pre-wrap" }}>
                {[proposal.background.problem, proposal.background.necessity, proposal.background.marketSize, proposal.background.trend, proposal.background.gap].filter(Boolean).join("\n\n")}
              </p>
            </div>
          )}

          {activeSection === "goal" && proposal.finalGoal && (
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: "#f1f5f9", marginBottom: 14 }}>3. \uCD5C\uC885 \uBAA9\uD45C</h3>
              <div style={{ background: "#10b98110", borderRadius: 8, padding: "14px", border: "1px solid #10b98120", marginBottom: 16 }}>
                <p style={{ fontSize: 13, color: "#d1d5db", fontWeight: 600 }}>{proposal.finalGoal.statement}</p>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {[
                  ["\uAE30\uC220 \uBAA9\uD45C", proposal.finalGoal.techGoals, "#3b82f6"],
                  ["\uC0AC\uC5C5\uD654 \uBAA9\uD45C", proposal.finalGoal.bizGoals, "#10b981"],
                ].map(([title, items, color]) => (
                  <div key={title} style={{ background: "#ffffff05", borderRadius: 8, padding: "14px" }}>
                    <div style={{ fontSize: 10, color, fontWeight: 700, marginBottom: 8, textTransform: "uppercase" }}>{title}</div>
                    {items?.map((g, i) => <div key={i} style={{ fontSize: 11, color: "#94a3b8", padding: "3px 0" }}>\u2022 {g}</div>)}
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeSection === "annual" && proposal.annualGoals && (
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: "#f1f5f9", marginBottom: 14 }}>4. \uC5F0\uCC28\uBCC4 \uBAA9\uD45C</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {proposal.annualGoals.map((g, i) => (
                  <div key={i} style={{ background: "#0d1020", borderRadius: 12, border: `1px solid ${YC[i]}30`, padding: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                      <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, background: YC[i] + "20", color: YC[i], fontWeight: 700 }}>{g.year || i+1}\uCC28\uB144</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#f1f5f9" }}>{g.title}</span>
                    </div>
                    {g.objectives?.map((o, j) => <div key={j} style={{ fontSize: 11, color: "#94a3b8", padding: "2px 0" }}>\u2022 {o}</div>)}
                    {g.milestones?.length > 0 && (
                      <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid #ffffff06" }}>
                        <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 4 }}>Milestones</div>
                        {g.milestones.map((m, j) => <div key={j} style={{ fontSize: 11, color: "#8b5cf6" }}>\u2192 {m}</div>)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeSection === "budget" && proposal.budgetOutline && (
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: "#f1f5f9", marginBottom: 14 }}>5. \uC608\uC0B0 \uD3B8\uC131</h3>
              <div style={{ background: "#0d1020", borderRadius: 12, overflow: "hidden", border: "1px solid #ffffff09" }}>
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", padding: "8px 14px", background: "#ffffff06", fontSize: 10, color: "#6b7280", fontWeight: 600 }}>
                  <span>\uD56D\uBAA9</span><span>\uAE08\uC561</span><span>\uBE44\uC728</span>
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
              <h3 style={{ fontSize: 16, fontWeight: 800, color: "#f1f5f9", marginBottom: 14 }}>6. \uC0AC\uC5C5\uD654 \uACC4\uD68D</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {[
                  ["\uC804\uB7B5", proposal.commercialization.strategy, "#8b5cf6"],
                  ["\uBAA9\uD45C\uC2DC\uC7A5", proposal.commercialization.targetMarket, "#3b82f6"],
                  ["\uD0C0\uC784\uB77C\uC778", proposal.commercialization.timeline, "#10b981"],
                  ["\uC608\uC0C1\uB9E4\uCD9C", proposal.commercialization.revenue, "#f59e0b"],
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
              <h3 style={{ fontSize: 16, fontWeight: 800, color: "#f1f5f9", marginBottom: 14 }}>7. \uAE30\uB300\uD6A8\uACFC</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                {[
                  ["\uAE30\uC220\uC801", proposal.expectedEffects.technical, "#3b82f6"],
                  ["\uACBD\uC81C\uC801", proposal.expectedEffects.economic, "#10b981"],
                  ["\uC0AC\uD68C\uC801", proposal.expectedEffects.social, "#f59e0b"],
                ].map(([title, items, color]) => (
                  <div key={title} style={{ background: "#ffffff05", borderRadius: 8, padding: 14 }}>
                    <div style={{ fontSize: 10, color, fontWeight: 700, marginBottom: 8 }}>{title}</div>
                    {(items || []).map((item, i) => <div key={i} style={{ fontSize: 11, color: "#94a3b8", padding: "3px 0" }}>\u2022 {item}</div>)}
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

// \u2500\u2500\u2500 \uBA54\uC778 \uC571 \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
export default function App() {
  const [tab, setTab] = useState("search");
  const [prefillGrant, setPrefillGrant] = useState(null);

  function handleSelectGrant(grant) {
    setPrefillGrant(grant);
    setTab("proposal");
  }

  const TABS = [
    { id: "search", label: "\uD83D\uDD0D \uACF5\uACE0 \uD0D0\uC0C9" },
    { id: "proposal", label: "\u270D\uFE0F \uC0AC\uC5C5\uACC4\uD68D\uC11C" },
  ];

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#060810", color: "#e2e8f0", fontFamily: "'Noto Sans KR', -apple-system, sans-serif" }}>
      <Head>
        <title>GRANTIQ \u2014 {UMTR.company}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1"/>
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;900&display=swap" rel="stylesheet"/>
      </Head>
      <style>{`*{box-sizing:border-box;margin:0;padding:0} @keyframes spin{to{transform:rotate(360deg)}} @keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}} ::selection{background:#8b5cf640} input::placeholder,textarea::placeholder{color:#374151} ::-webkit-scrollbar{width:6px} ::-webkit-scrollbar-thumb{background:#ffffff12;border-radius:3px}`}</style>

      {/* \uD5E4\uB354 */}
      <div style={{ padding: "0 28px", borderBottom: "1px solid #ffffff09", background: "#0a0c15", display: "flex", alignItems: "center", height: 52 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginRight: 32 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: "linear-gradient(135deg, #8b5cf6, #3b82f6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>\u26A1</div>
          <span style={{ fontSize: 14, fontWeight: 900 }}>GRANTIQ</span>
        </div>
        {/* \uD0ED */}
        <div style={{ display: "flex", height: "100%", gap: 2 }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{ padding: "0 18px", border: "none", background: "transparent", color: tab === t.id ? "#e2e8f0" : "#4b5563", fontSize: 13, cursor: "pointer", borderBottom: `2px solid ${tab === t.id ? "#8b5cf6" : "transparent"}`, fontWeight: tab === t.id ? 700 : 400 }}>
              {t.label}
            </button>
          ))}
        </div>
        {/* \uAE30\uC5C5 \uD45C\uC2DC */}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#10b981", animation: "pulse 2s infinite" }}/>
          <span style={{ fontSize: 11, color: "#10b981" }}>\uC2E4\uC2DC\uAC04 \uAC80\uC0C9</span>
          <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 5, background: "#3b82f620", color: "#3b82f6" }}>{UMTR.company}</span>
        </div>
      </div>

      {/* \uCF58\uD150\uCE20 */}
      {tab === "search" && <GrantSearch onSelectGrant={handleSelectGrant}/>}
      {tab === "proposal" && <ProposalGenerator prefillGrant={prefillGrant}/>}
    </div>
  );
}
