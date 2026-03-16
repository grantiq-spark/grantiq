// pages/api/board-meeting.js
// ë§¤ì£¼ ìžë™ ì‹¤í–‰: ê³µê³  íƒìƒ‰ â†’ 4ì¸ ìž„ì› í† ë¡  â†’ ëŒ€í‘œ ë³´ê³ 

const UMTR = {
  company: "ãˆœì›€í‹€",
  mainBiz: "ë°”ì´ì˜¤ì‚°ì—…ìš© NC/PES ë©¤ë¸Œë ˆì¸Â·í•„í„° ì—°êµ¬ê°œë°œÂ·ì œì¡°",
  currentRevenue: "ì—° 15ì–µì›",
  rdBudget: "ì—°ê°„ 10ì–µ+",
  cashFlow: "ì˜ì—…ì†ì‹¤ êµ¬ê°„, ëŒ€ì¶œ ì—¬ë ¥ ì•½ 16ì–µ",
  strengths: "ISO 13485, íŠ¹í—ˆ 8ê±´, ì‚¼ì„±ë°”ì´ì˜¤ë¡œì§ìŠ¤ ê³µë™ì‹¤ì¦, ì˜¤ì†¡ ë¶€ì§€ í™•ë³´",
  keywords: ["ë°”ì´ì˜¤ ë©¤ë¸Œë ˆì¸", "ì†Œë¶€ìž¥ êµ­ì‚°í™”", "PES ë©¤ë¸Œë ˆì¸", "NC ë©¤ë¸Œë ˆì¸", "TFF ëª¨ë“ˆ", "ì œê· í•„í„°", "GMP", "ì²´ì™¸ì§„ë‹¨ê¸°ê¸°"],
};

const EXECUTIVES = {
  tech: {
    name: "ë°•ê¸°ìˆ ",
    title: "ê¸°ìˆ ì´ì‚¬",
    emoji: "ðŸ”´",
    focus: "ê¸°ìˆ  ì‹¤í˜„ê°€ëŠ¥ì„±, ê°œë°œ ë‚œì´ë„, ê¸°ì¡´ IPì™€ì˜ ì—°ê³„ì„±, ì¸ë ¥/ìž¥ë¹„ ì¤€ë¹„ë„",
    style: "ëƒ‰ì² í•˜ê³  êµ¬ì²´ì . ìˆ˜ì¹˜ ê¸°ë°˜. ë¶ˆê°€ëŠ¥í•œ ê±´ ë¶ˆê°€ëŠ¥í•˜ë‹¤ê³  ì§ì–¸.",
  },
  finance: {
    name: "ì´ìž¬ë¬´",
    title: "ìž¬ë¬´ì´ì‚¬",
    emoji: "ðŸŸ¢",
    focus: "ìžê¸°ë¶€ë‹´ê¸ˆ, í˜„ê¸ˆíë¦„ ì˜í–¥, ì •ë¶€ì§€ì› ë¹„ìœ¨, ë§¤ì¶œ ì‹¤í˜„ê¹Œì§€ ì†ìµ ì‹œë®¬ë ˆì´ì…˜",
    style: "ë³´ìˆ˜ì . ë¦¬ìŠ¤í¬ ë¨¼ì €. ìˆ«ìžê°€ ì•ˆ ë§žìœ¼ë©´ ë°˜ëŒ€.",
  },
  strategy: {
    name: "ê¹€ì „ëžµ",
    title: "ì „ëžµì´ì‚¬",
    emoji: "ðŸ”µ",
    focus: "ì‹œìž¥ íƒ€ì´ë°, ê²½ìŸì‚¬ ë™í–¥, ì •ë¶€ ì •ì±… íë¦„, ì „ëžµì  í¬ì§€ì…”ë‹",
    style: "í° ê·¸ë¦¼. ì§€ê¸ˆ ì´ ê³µê³ ë¥¼ ì™œ ìž¡ì•„ì•¼ í•˜ëŠ”ì§€ í˜¹ì€ ì™œ íŒ¨ìŠ¤í•´ì•¼ í•˜ëŠ”ì§€.",
  },
  biz: {
    name: "ìµœì‚¬ì—…",
    title: "ì‚¬ì—…í™”ì´ì‚¬",
    emoji: "ðŸŸ¡",
    focus: "ì£¼ìš” ê³ ê°ì‚¬ ì—°ê²° ê°€ëŠ¥ì„±, ë§¤ì¶œ ì „í™˜ ê²½ë¡œ, ë ˆí¼ëŸ°ìŠ¤ í™œìš©, ë‚©í’ˆ íƒ€ìž„ë¼ì¸",
    style: "ì‹¤ìš©ì . ê³µê³ ê°€ ëë‚œ í›„ ì‹¤ì œ ëˆì´ ë˜ëŠ”ì§€ë§Œ ê´€ì‹¬.",
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
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/claude`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tools: [{ type: "web_search_20250305", name: "web_search" }], max_tokens: 1200, messages: [{ role: "user", content: `R&D ê³µê³  íƒì‚Šê°€ìƒ‰: GMP ë©¤ë¸Œë ˆì¸ ì˜ì•½í’ˆ RŒ$Rê¸°ì—…: ${UMTR.company} json: {"grants":[{"title":"","agency":"","budget":"","deadline":"","summary":"","url":"","matchScore":0}]}` }] })
  });
  const data = await res.json();
  const text = data.content?.find(b => b.type === "text")?.text || "{}";
  const m = text.match(/\{[\s\S]*\}/);
  try { return (JSON.parse(m[0]).grants || []).sort((a,b)=>(b.matchScore||0)-(a.matchScore||0)).slice(0,3); } catch { return []; }
}

async function execDebate(grant) {
  const opinions = {};
  for (const [key, exec] of Object.entries(EXECUTIVES)) {
    opinions[key] = (await callClaude([{ role: "user", content: `${exec.title} ì˜ê²¬: ${grant.title} / ${grant.summary}` }], `${UMTR.company} ${exec.title} ${exec.name}. ${exec.focus}`)).trim();
  }
  const verdict = await callClaude([{ role: "user", content: `${Object.entries(EXECUTIVES).map(([k,e])=>`${e.name}: ${opinions[k]}`).join('\n')}\níŠ¹ì„± 200ì˜ë‹‰: ${grant.title}` }], "íŠ¹ì„±ëŒ€í‘œ", 300);
  return { opinions, verdict: verdict.trim() };
}

async function postToSlack(report) {
  const W = process.env.SLACK_WEBHOOK_URL; if (!W) return;
  await fetch(W, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: report.grants.map(i=>`${i.grant.title}: ${i.debate.verdict}`).join('\n') }) });
}

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") return res.status(405).end();
  const auth = req.headers.authorization;
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) return res.status(401).json({ error: "Unauthorized" });
  try {
    console.log("[BoardMeeting] íƒìƒ‰");
    const grants = await searchGrants();
    if (!grants.length) return res.status(200).json({ message: "no grants" });
    const results = [];
    for (const g of grants) { results.push({ grant: g, debate: await execDebate(g) }); }
    await postToSlack({ grants: results });
    return res.status(200).json({ success: true, grantsReviewed: results.length });
  } catch (err) {
    console.error("[BoardMeeting] error:", err);
    return res.status(500).json({ error: err.message });
  }
}
