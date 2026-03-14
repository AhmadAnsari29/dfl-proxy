import { useState, useEffect, useCallback, useRef } from "react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";

// ─────────────────────────────────────────────────────────────
// CONFIG — update PROXY_URL after deploying server.js to Render
// ─────────────────────────────────────────────────────────────
const CONFIG = {
  PROXY_URL:            "",        // e.g. "https://dfl-proxy.onrender.com"
  FALLBACK_LOCATION_ID: "YTgWCf3WtDxoZw4kKaN1",
  CUSTOM_OBJECT_KEY:    "",        // auto-discovered, or paste manually
  REFRESH_INTERVAL_MS:  5 * 60 * 1000, // auto-refresh every 5 minutes
  LOGO_URL: "https://0fa31a16.delivery.rocketcdn.me/wp-content/uploads/2026/01/Untitled-design-2026-01-09T132206.660-1.png",
};

// ─────────────────────────────────────────────────────────────
// THEME TOKENS
// ─────────────────────────────────────────────────────────────
const DARK = {
  bg:        "#020c1b",
  surface:   "rgba(4,16,36,0.95)",
  card:      "rgba(255,255,255,0.03)",
  cardHover: "rgba(255,255,255,0.055)",
  border:    "rgba(0,163,255,0.14)",
  borderH:   "rgba(0,163,255,0.4)",
  text:      "#ffffff",
  textSub:   "rgba(255,255,255,0.55)",
  textMuted: "rgba(255,255,255,0.35)",
  topbar:    "rgba(2,12,27,0.9)",
  blue:      "#00a3ff",
  blueGlow:  "rgba(0,163,255,0.25)",
  blueDim:   "rgba(0,163,255,0.1)",
  green:     "#00e5a0",
  red:       "#ff4d6a",
  yellow:    "#ffc93c",
  chartGrid: "rgba(255,255,255,0.05)",
  chartAxis: "rgba(255,255,255,0.35)",
  tooltipBg: "rgba(4,16,36,0.97)",
};

const LIGHT = {
  bg:        "#f0f4f8",
  surface:   "#ffffff",
  card:      "#ffffff",
  cardHover: "#f8fafc",
  border:    "rgba(0,120,200,0.15)",
  borderH:   "rgba(0,120,200,0.4)",
  text:      "#0a1628",
  textSub:   "rgba(10,22,40,0.6)",
  textMuted: "rgba(10,22,40,0.4)",
  topbar:    "rgba(255,255,255,0.95)",
  blue:      "#0078c8",
  blueGlow:  "rgba(0,120,200,0.2)",
  blueDim:   "rgba(0,120,200,0.08)",
  green:     "#00a870",
  red:       "#e0344a",
  yellow:    "#d4860a",
  chartGrid: "rgba(0,0,0,0.06)",
  chartAxis: "rgba(10,22,40,0.45)",
  tooltipBg: "#ffffff",
};

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
const fc = v => "$" + Math.round(v).toLocaleString();
const fr = v => v.toFixed(2) + "x";
const fp = v => v.toFixed(1) + "%";
const fn = v => Math.round(v).toLocaleString();
const gf = (f, k) =>
  parseFloat(f[k] ?? f[k.replace(/_([a-z])/g, (_, c) => c.toUpperCase())] ?? 0) || 0;

function getLocId() {
  const p = new URLSearchParams(window.location.search);
  return p.get("locationId") || p.get("location_id") || CONFIG.FALLBACK_LOCATION_ID;
}

async function proxyGet(path) {
  try {
    const res  = await fetch(CONFIG.PROXY_URL + path);
    const text = await res.text();
    let d; try { d = JSON.parse(text); } catch { d = { raw: text }; }
    return { ok: res.ok, status: res.status, data: d };
  } catch (e) {
    return { ok: false, status: 0, data: null, error: e.message };
  }
}

function calcMetrics(record) {
  const f      = record.properties || record.fields || record.fieldValues || record;
  const rev    = gf(f,"monthly_revenue"),    profit = gf(f,"monthly_profit"),
    jobs       = gf(f,"jobs_completed"),     newC   = gf(f,"new_clients_served"),
    existC     = gf(f,"existing_clients_served"),
    tSpend     = gf(f,"total_marketing_spend"),
    mSpend     = gf(f,"meta_ads_spend"),     gSpend = gf(f,"google_ads_spend"),
    revM       = gf(f,"revenue_from_meta_ads"), revG = gf(f,"revenue_from_google_ads"),
    lM         = gf(f,"new_clients_from_facebook"), lG = gf(f,"new_clients_from_google");
  return {
    rev, profit, jobs, newC, existC, tSpend, mSpend, gSpend, revM, revG, lM, lG,
    avgJob:   jobs>0   ? rev/jobs    : 0,
    cac:      newC>0   ? tSpend/newC : 0,
    metaCac:  lM>0     ? mSpend/lM   : 0,
    gCac:     lG>0     ? gSpend/lG   : 0,
    roas:     tSpend>0 ? rev/tSpend  : 0,
    metaRoas: mSpend>0 ? revM/mSpend : 0,
    gRoas:    gSpend>0 ? revG/gSpend : 0,
    margin:   rev>0    ? (profit/rev)*100 : 0,
    month:    f.reporting_month || f.reportingMonth || record.name || "Latest Record",
  };
}

function roasSt(n) {
  if (!n)    return { label:"No Data",      cls:"blue",   color:null };
  if (n>=4)  return { label:"Excellent",    cls:"green",  color:"green" };
  if (n>=2)  return { label:"On Track",     cls:"yellow", color:"yellow" };
  return       { label:"Below Target", cls:"red",    color:"red" };
}
function cacSt(n) {
  if (!n)    return { label:"No Data",   cls:"blue",   color:null,    hint:"Enter data to calculate" };
  if (n<200) return { label:"Efficient", cls:"green",  color:"green", hint:"✅ Under $200 target" };
  if (n<400) return { label:"Average",   cls:"yellow", color:"yellow",hint:"⚠️ $200–$400 range" };
  return       { label:"High Cost",  cls:"red",    color:"red",   hint:"🔴 Above $400 — optimise" };
}

// ─────────────────────────────────────────────────────────────
// DEMO DATA
// ─────────────────────────────────────────────────────────────
const DEMO_RECORD = {
  fields: {
    reporting_month:"February 2026", monthly_revenue:87500, monthly_profit:24200,
    jobs_completed:38, new_clients_served:14, existing_clients_served:24,
    total_marketing_spend:5600, meta_ads_spend:3200, google_ads_spend:2400,
    revenue_from_meta_ads:42000, revenue_from_google_ads:31000,
    new_clients_from_facebook:8, new_clients_from_google:6,
  }
};
const TREND_DEMO = [
  {m:"Sep",rev:52000,spend:3800},{m:"Oct",rev:61000,spend:4200},
  {m:"Nov",rev:58000,spend:4000},{m:"Dec",rev:74000,spend:5100},
  {m:"Jan",rev:79000,spend:5400},{m:"Feb",rev:87500,spend:5600},
];

// ─────────────────────────────────────────────────────────────
// STYLES HELPER
// ─────────────────────────────────────────────────────────────
const injectGlobalCSS = (dark) => {
  const id = "dfl-global-css";
  let el = document.getElementById(id);
  if (!el) { el = document.createElement("style"); el.id = id; document.head.appendChild(el); }
  el.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800;900&display=swap');
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
    html,body,#root{min-height:100%;font-family:'Poppins',sans-serif;transition:background .3s;}
    body{background:${dark ? DARK.bg : LIGHT.bg};overflow-x:hidden;}
    ::-webkit-scrollbar{width:4px;}
    ::-webkit-scrollbar-thumb{background:${dark ? "rgba(0,163,255,0.5)" : "rgba(0,120,200,0.3)"};border-radius:2px;}
    @keyframes fadeUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}
    @keyframes countIn{from{opacity:0;transform:scale(.88)}to{opacity:1;transform:scale(1)}}
    @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
    @keyframes spin{to{transform:rotate(360deg)}}
    @keyframes scan{0%{top:0}100%{top:100%}}
    .fade-up{animation:fadeUp .5s ease both;}
    .count-in{animation:countIn .45s ease both;}
    .pulse{animation:pulse 2s ease-in-out infinite;}
    .spin{animation:spin .8s linear infinite;}
  `;
};

// ─────────────────────────────────────────────────────────────
// REUSABLE COMPONENTS
// ─────────────────────────────────────────────────────────────
function Tag({ label, type = "blue", t }) {
  const colors = {
    green:  { bg: `${t.green}18`,  color: t.green,  border: `${t.green}30`  },
    red:    { bg: `${t.red}18`,    color: t.red,    border: `${t.red}30`    },
    yellow: { bg: `${t.yellow}18`, color: t.yellow, border: `${t.yellow}30` },
    blue:   { bg: t.blueDim,       color: t.blue,   border: t.border        },
  };
  const s = colors[type] || colors.blue;
  return (
    <span style={{
      display:"inline-flex", alignItems:"center",
      padding:"3px 9px", borderRadius:20,
      fontSize:9, fontWeight:700, textTransform:"uppercase", letterSpacing:".07em",
      background:s.bg, color:s.color, border:`1px solid ${s.border}`,
    }}>{label}</span>
  );
}

function Card({ children, style, className, t }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      className={className}
      style={{
        background: hov ? t.cardHover : t.card,
        border: `1px solid ${hov ? t.borderH : t.border}`,
        borderRadius:16, padding:"20px 22px",
        position:"relative", overflow:"hidden",
        transition:"all .22s ease",
        boxShadow: hov ? `0 0 28px ${t.blueGlow}, 0 8px 24px rgba(0,0,0,.15)` : "none",
        transform: hov ? "translateY(-2px)" : "none",
        backdropFilter:"blur(10px)",
        ...style,
      }}
    >
      {hov && (
        <div style={{
          position:"absolute", top:0, left:0, right:0, height:1,
          background:`linear-gradient(90deg,transparent,${t.blue},transparent)`,
          opacity:.6,
        }}/>
      )}
      {children}
    </div>
  );
}

function KpiCard({ icon, label, value, sub, accent, t, delay = 0 }) {
  return (
    <Card t={t} style={{ animationDelay:`${delay}ms` }} className="fade-up">
      <div style={{
        width:42, height:42, borderRadius:11,
        display:"flex", alignItems:"center", justifyContent:"center",
        fontSize:19, marginBottom:14,
        background:t.blueDim, border:`1px solid ${t.border}`,
        boxShadow:`0 0 12px ${t.blueGlow}`,
      }}>{icon}</div>
      <div style={{ fontSize:10, fontWeight:600, color:t.textMuted, textTransform:"uppercase", letterSpacing:".08em", marginBottom:6 }}>{label}</div>
      <div className="count-in" style={{
        fontSize:26, fontWeight:800, lineHeight:1,
        color: accent ? t.blue : t.text,
        textShadow: accent ? `0 0 16px ${t.blueGlow}` : "none",
      }}>{value}</div>
      {sub && <div style={{ fontSize:11, color:t.textMuted, marginTop:7 }}>{sub}</div>}
    </Card>
  );
}

function MetricCard({ label, platform, value, barW, status, hint, t, delay = 0 }) {
  const s = status;
  const col = s.color ? t[s.color] : t.textMuted;
  return (
    <Card t={t} style={{ animationDelay:`${delay}ms` }} className="fade-up">
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
        <div>
          <div style={{ fontSize:10, fontWeight:700, color:t.textMuted, textTransform:"uppercase", letterSpacing:".08em" }}>{label}</div>
          {platform && <div style={{ fontSize:9, color:t.textMuted, opacity:.7, marginTop:2 }}>{platform}</div>}
        </div>
        <Tag label={s.label} type={s.cls} t={t} />
      </div>
      <div className="count-in" style={{
        fontSize:36, fontWeight:800, lineHeight:1,
        color: col, textShadow: s.color==="green" ? `0 0 16px ${t.green}40` : "none",
      }}>{value}</div>
      {hint && <div style={{ fontSize:10, color:t.textMuted, marginTop:8 }}>{hint}</div>}
      {barW !== undefined && (
        <>
          <div style={{ height:4, background:t.border, borderRadius:2, marginTop:10, overflow:"hidden" }}>
            <div style={{
              height:"100%", borderRadius:2, width:`${barW}%`,
              background: s.color ? `linear-gradient(90deg,${t[s.color]},${t[s.color]}80)` : t.border,
              transition:"width 1s ease", boxShadow: s.color ? `0 0 8px ${t[s.color]}60` : "none",
            }}/>
          </div>
          <div style={{ display:"flex", justifyContent:"space-between", marginTop:6, fontSize:9, color:t.textMuted }}>
            <span>0x</span><span>Target 4x</span><span>6x+</span>
          </div>
        </>
      )}
    </Card>
  );
}

// Custom Tooltip
function CustomTooltip({ active, payload, label, t }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background:t.tooltipBg, border:`1px solid ${t.border}`,
      borderRadius:10, padding:"10px 14px", fontFamily:"Poppins,sans-serif",
      boxShadow:`0 8px 24px rgba(0,0,0,.2)`,
    }}>
      <div style={{ fontSize:10, color:t.textMuted, marginBottom:6 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ fontSize:13, fontWeight:700, color:p.color }}>{fc(p.value)}</div>
      ))}
    </div>
  );
}

// Section Label
function SectionLabel({ children, t }) {
  return (
    <div style={{
      display:"flex", alignItems:"center", gap:9,
      fontSize:10, fontWeight:700, textTransform:"uppercase",
      letterSpacing:".14em", color:t.blue,
      margin:"32px 0 14px",
    }}>
      {children}
      <div style={{ flex:1, height:1, background:`linear-gradient(90deg,${t.border},transparent)` }}/>
    </div>
  );
}

// Toggle Switch
function ThemeToggle({ dark, onToggle, t }) {
  return (
    <button
      onClick={onToggle}
      style={{
        display:"flex", alignItems:"center", gap:8,
        background:t.blueDim, border:`1px solid ${t.border}`,
        borderRadius:30, padding:"6px 14px", cursor:"pointer",
        transition:"all .2s", color:t.text,
        fontSize:11, fontWeight:600,
      }}
    >
      <span style={{ fontSize:14 }}>{dark ? "☀️" : "🌙"}</span>
      <span style={{ color:t.textSub }}>{dark ? "Light Mode" : "Dark Mode"}</span>
    </button>
  );
}

// Perf Row
function PerfRow({ label, ok, value, t }) {
  return (
    <div style={{
      display:"flex", alignItems:"center", justifyContent:"space-between",
      padding:"10px 0", borderBottom:`1px solid ${t.border}`,
    }}>
      <span style={{ fontSize:12, color:t.textSub }}>{label}</span>
      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
        <span style={{ fontSize:13, fontWeight:700, color:ok ? t.green : t.red }}>{value}</span>
        <span style={{ fontSize:14 }}>{ok ? "✅" : "❌"}</span>
      </div>
    </div>
  );
}

// Debug Panel
function DebugPanel({ log, t }) {
  const [open, setOpen] = useState(false);
  if (!log.length) return null;
  return (
    <div style={{
      background:t.card, border:`1px solid ${t.border}`,
      borderRadius:12, overflow:"hidden", marginTop:16,
    }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          display:"flex", alignItems:"center", justifyContent:"space-between",
          padding:"9px 16px", cursor:"pointer",
          background:t.blueDim, borderBottom:`1px solid ${t.border}`,
        }}
      >
        <span style={{ fontSize:10, fontWeight:700, color:t.blue, textTransform:"uppercase", letterSpacing:".1em" }}>
          🔧 API Debug Log {open ? "▲" : "▼"}
        </span>
        <span style={{ fontSize:10, color:t.textMuted }}>{log.length} entries</span>
      </div>
      {open && (
        <div style={{ padding:"12px 16px", fontFamily:"monospace", fontSize:10.5, color:t.textSub, maxHeight:280, overflowY:"auto" }}>
          {log.map((e, i) => (
            <div key={i}>
              {e.section && (
                <div style={{ fontSize:9, fontWeight:700, textTransform:"uppercase", letterSpacing:".1em", color:t.blue, padding:"6px 0 3px", marginTop:4, borderTop:`1px solid ${t.border}` }}>
                  {e.section}
                </div>
              )}
              <div style={{ display:"flex", gap:10, padding:"3px 0", borderBottom:`1px solid ${t.border}20` }}>
                <span style={{ color:t.blue, minWidth:200, flexShrink:0 }}>{e.key}</span>
                <span style={{ wordBreak:"break-all", color: e.ok===true ? t.green : e.ok===false ? t.red : t.textSub }}>{e.val}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────────────────────────
export default function App() {
  const [dark,       setDark]       = useState(true);
  const [records,    setRecords]    = useState([]);
  const [selIdx,     setSelIdx]     = useState(0);
  const [loading,    setLoading]    = useState(true);
  const [loadStep,   setLoadStep]   = useState("Connecting...");
  const [locName,    setLocName]    = useState("Digital Fastlane");
  const [isDemo,     setIsDemo]     = useState(false);
  const [debugLog,   setDebugLog]   = useState([]);
  const [logoOk,     setLogoOk]     = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [objKey,     setObjKey]     = useState("");
  const intervalRef  = useRef(null);

  const t = dark ? DARK : LIGHT;

  useEffect(() => { injectGlobalCSS(dark); }, [dark]);

  const dlog = useCallback((key, val, ok, section) => {
    setDebugLog(p => [...p, {
      key, val: typeof val === "object" ? JSON.stringify(val).slice(0, 220) : String(val), ok, section,
    }]);
  }, []);

  const loadData = useCallback(async (isRefresh = false) => {
    if (!isRefresh) { setLoading(true); setDebugLog([]); }
    const lid = getLocId();

    if (!CONFIG.PROXY_URL) {
      dlog("PROXY_URL", "NOT SET — add your Render URL to CONFIG.PROXY_URL", false, "⚙️ Setup");
      setIsDemo(true); setRecords([DEMO_RECORD]);
      setLoading(false); return;
    }

    // Ping proxy
    const ping = await proxyGet("/");
    if (!ping.ok) {
      dlog("Proxy", "OFFLINE — check Render deployment", false, "🏓 Proxy");
      setIsDemo(true); setRecords([DEMO_RECORD]);
      setLoading(false); return;
    }
    dlog("Proxy", "✅ Online", true, "🏓 Proxy");

    // Location
    const locR = await proxyGet(`/api/location/${lid}`);
    if (locR.ok && locR.data) {
      const name = locR.data.name || locR.data.location?.name || "Digital Fastlane";
      setLocName(name);
      dlog("Location", name, true, "🏢 Location");
    } else {
      dlog("Location", `HTTP ${locR.status} — check API key permissions`, false, "🏢 Location");
    }

    // Objects
    let foundKey = CONFIG.CUSTOM_OBJECT_KEY || objKey;
    if (!foundKey) {
      const objR = await proxyGet(`/api/objects?locationId=${lid}`);
      if (objR.ok && objR.data) {
        const list = objR.data.objects || objR.data.customObjects || objR.data.schemas || objR.data.data || [];
        dlog("Objects found", Array.isArray(list) ? list.length : "unexpected", null, "📦 Objects");
        if (Array.isArray(list)) {
          list.forEach((o, i) => dlog(`Object [${i+1}]`, `key:"${o.key||o.objectKey||o.id||"?"}"  name:"${o.name||o.label||"?"}"`, null));
          const kw = ["scorecard","business_score","monthly","performance"];
          const found = list.find(o => kw.some(k => (o.key||o.objectKey||o.id||o.name||"").toLowerCase().includes(k))) || list[0];
          foundKey = found?.key || found?.objectKey || found?.id || "";
          if (foundKey) { setObjKey(foundKey); dlog("Auto-detected key", foundKey, true); }
          else dlog("Key not found", "Set CONFIG.CUSTOM_OBJECT_KEY manually", false);
        }
      }
    }

    // Records
    let liveRecs = [];
    if (foundKey) {
      const recR = await proxyGet(`/api/objects/${foundKey}/records?locationId=${lid}`);
      dlog("Records", recR.status, recR.ok, "📊 Records");
      if (recR.ok && recR.data) {
        liveRecs = recR.data.records || recR.data.data || recR.data.objects || [];
        dlog("Count", liveRecs.length, liveRecs.length > 0);
      }
    }

    if (liveRecs.length > 0) {
      setIsDemo(false); setRecords(liveRecs);
      if (!isRefresh) setSelIdx(0);
      dlog("✅ Result", "LIVE DATA", true, "🏁 Result");
    } else {
      setIsDemo(true); setRecords([DEMO_RECORD]);
      dlog("Result", "DEMO — no live records found", null, "🏁 Result");
    }

    setLastUpdate(new Date());
    setLoading(false);
  }, [dlog, objKey]);

  useEffect(() => {
    loadData();
    if (CONFIG.REFRESH_INTERVAL_MS > 0) {
      intervalRef.current = setInterval(() => loadData(true), CONFIG.REFRESH_INTERVAL_MS);
    }
    return () => clearInterval(intervalRef.current);
  }, []);

  const m = records[selIdx] ? calcMetrics(records[selIdx]) : null;
  const months = records.map((r, i) => {
    const f = r.properties || r.fields || r.fieldValues || r;
    return f.reporting_month || f.reportingMonth || `Record ${i+1}`;
  });

  const trendData = isDemo ? TREND_DEMO : [{ m: m?.month || "Now", rev: m?.rev || 0, spend: m?.tSpend || 0 }];

  // Common chart props
  const chartProps = {
    style: { fontFamily: "Poppins,sans-serif" },
  };

  if (loading) return (
    <div style={{
      display:"flex", flexDirection:"column", alignItems:"center",
      justifyContent:"center", minHeight:"100vh",
      background:t.bg, gap:16, fontFamily:"Poppins,sans-serif",
    }}>
      <div style={{
        width:44, height:44, borderRadius:"50%",
        border:`3px solid ${t.border}`, borderTopColor:t.blue,
        boxShadow:`0 0 14px ${t.blueGlow}`,
      }} className="spin"/>
      <div style={{ color:t.textSub, fontSize:13 }}>{loadStep}</div>
    </div>
  );

  return (
    <div style={{ background:t.bg, minHeight:"100vh", color:t.text, transition:"background .3s, color .3s" }}>

      {/* ── TOPBAR ── */}
      <div style={{
        position:"sticky", top:0, zIndex:100,
        background:t.topbar, backdropFilter:"blur(20px)",
        borderBottom:`1px solid ${t.border}`,
        display:"flex", alignItems:"center", justifyContent:"space-between",
        padding:"0 24px", height:64,
      }}>
        <div style={{ display:"flex", alignItems:"center", gap:14 }}>
          {logoOk
            ? <img src={CONFIG.LOGO_URL} alt="DFL"
                onError={() => setLogoOk(false)}
                style={{ height:36, width:36, borderRadius:10, objectFit:"contain", filter:`drop-shadow(0 0 10px ${t.blue})` }}/>
            : <div style={{ height:36, width:36, borderRadius:10, background:t.blueDim, border:`1px solid ${t.border}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:900, color:t.blue }}>DFL</div>
          }
          <div style={{ width:1, height:28, background:t.border }}/>
          <div>
            <div style={{ fontSize:16, fontWeight:700, color:t.text }}>{locName}</div>
            <div style={{ fontSize:10, color:t.textMuted }}>Monthly Business Scorecard</div>
          </div>
        </div>

        <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
          {/* Last updated */}
          {lastUpdate && (
            <div style={{ fontSize:10, color:t.textMuted, display:"flex", alignItems:"center", gap:5 }}>
              <span>🔄</span>
              <span>Updated {lastUpdate.toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}</span>
              <button onClick={() => loadData(true)} style={{
                background:t.blueDim, border:`1px solid ${t.border}`,
                borderRadius:6, padding:"2px 8px", cursor:"pointer",
                color:t.blue, fontSize:10, fontFamily:"Poppins,sans-serif",
              }}>Refresh</button>
            </div>
          )}

          {/* Month selector */}
          {months.length > 1 && (
            <div style={{
              display:"flex", alignItems:"center", gap:7,
              background:t.blueDim, border:`1px solid ${t.border}`,
              borderRadius:30, padding:"5px 14px",
            }}>
              <span style={{ color:t.blue, fontSize:13 }}>📅</span>
              <select
                value={selIdx}
                onChange={e => setSelIdx(parseInt(e.target.value))}
                style={{
                  background:"transparent", border:"none",
                  color:t.blue, fontFamily:"Poppins,sans-serif",
                  fontSize:12, fontWeight:600, outline:"none", cursor:"pointer",
                }}
              >
                {months.map((mo, i) => <option key={i} value={i} style={{ background:t.bg }}>{mo}</option>)}
              </select>
              <span style={{ color:t.blue, fontSize:11 }}>▾</span>
            </div>
          )}

          {/* Dark/Light toggle */}
          <ThemeToggle dark={dark} onToggle={() => setDark(d => !d)} t={t}/>

          {/* Live badge */}
          <span style={{
            display:"flex", alignItems:"center", gap:5,
            padding:"5px 12px", borderRadius:30,
            fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:".08em",
            background: isDemo ? `${t.yellow}18` : `${t.green}18`,
            color: isDemo ? t.yellow : t.green,
            border: `1px solid ${isDemo ? t.yellow : t.green}30`,
          }}>
            <span className="pulse" style={{
              width:6, height:6, borderRadius:"50%",
              background: isDemo ? t.yellow : t.green,
              boxShadow:`0 0 6px ${isDemo ? t.yellow : t.green}`,
            }}/>
            {isDemo ? "Demo" : "Live"}
          </span>
        </div>
      </div>

      {/* ── CONTENT ── */}
      <div style={{ maxWidth:1400, margin:"0 auto", padding:"0 24px 60px" }}>

        {/* Status banner */}
        <div style={{
          marginTop:16, padding:"10px 16px", borderRadius:10, fontSize:12,
          display:"flex", alignItems:"center", gap:8,
          background: isDemo ? `${t.yellow}12` : `${t.green}12`,
          border: `1px solid ${isDemo ? t.yellow : t.green}30`,
          color: isDemo ? t.yellow : t.green,
        }}>
          {isDemo
            ? "⚠️ Showing demo data — configure PROXY_URL in CONFIG to connect live GHL data"
            : `✅ Live GHL data connected for ${locName}`}
        </div>

        {/* Debug panel */}
        <DebugPanel log={debugLog} t={t}/>

        {!m ? (
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", minHeight:"50vh", gap:16 }}>
            <div style={{ fontSize:46 }}>📊</div>
            <div style={{ fontWeight:700, fontSize:18, color:t.text }}>No Records Found</div>
            <div style={{ color:t.textMuted, textAlign:"center", maxWidth:340, lineHeight:1.7, fontSize:13 }}>
              Submit the client + agency forms in GHL to populate the dashboard.
            </div>
          </div>
        ) : (<>

          {/* ── S1: OVERVIEW ── */}
          <SectionLabel t={t}>Business Performance — {m.month}</SectionLabel>

          <div style={{
            display:"grid",
            gridTemplateColumns:"repeat(3,1fr)",
            gap:16,
          }}>
            {/* HERO */}
            <div className="fade-up" style={{
              background:`linear-gradient(135deg,${t.blueDim},${t.card})`,
              border:`1px solid ${t.borderH}`,
              borderRadius:16, padding:26, position:"relative", overflow:"hidden",
            }}>
              <div style={{
                position:"absolute", left:0, right:0, height:2,
                background:`linear-gradient(90deg,transparent,${t.blue},transparent)`,
                opacity:.3, animation:"scan 7s linear infinite",
              }}/>
              <div style={{ position:"relative", zIndex:1 }}>
                <div style={{ fontSize:10, fontWeight:600, color:t.textMuted, textTransform:"uppercase", letterSpacing:".1em", marginBottom:10 }}>Monthly Revenue</div>
                <div className="count-in" style={{
                  fontSize:42, fontWeight:900, color:t.blue, lineHeight:1,
                  textShadow:`0 0 20px ${t.blueGlow}`,
                }}>{fc(m.rev)}</div>
                <div style={{ marginTop:10, fontSize:13, color:t.textMuted }}>
                  Profit: <span style={{ color:t.green, fontWeight:700 }}>{fc(m.profit)}</span>
                </div>
                <div style={{ display:"flex", gap:7, marginTop:14 }}>
                  <Tag label="↑ Active Month" type="green" t={t}/>
                  <Tag label={m.month} type="blue" t={t}/>
                </div>
                <div style={{ height:1, background:`linear-gradient(90deg,${t.blue},transparent)`, margin:"14px 0" }}/>
                <div style={{ display:"flex", gap:22 }}>
                  <div>
                    <div style={{ fontSize:9, color:t.textMuted, textTransform:"uppercase", letterSpacing:".08em" }}>Margin</div>
                    <div style={{ fontSize:19, fontWeight:800, marginTop:3, color:m.margin>=25?t.green:m.margin>=12?t.yellow:t.red }}>{fp(m.margin)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize:9, color:t.textMuted, textTransform:"uppercase", letterSpacing:".08em" }}>Avg Job</div>
                    <div style={{ fontSize:19, fontWeight:800, marginTop:3, color:t.blue }}>{fc(m.avgJob)}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* 4 KPIs */}
            <div style={{ gridColumn:"span 2", display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
              <KpiCard icon="🔨" label="Jobs Completed" value={fn(m.jobs)} sub={`Avg: ${fc(m.avgJob)}`} t={t} delay={50}/>
              <KpiCard icon="👥" label="New Clients" value={fn(m.newC)} sub={`${m.existC} existing`} accent t={t} delay={100}/>
              <KpiCard icon="💸" label="Total Ad Spend" value={fc(m.tSpend)} sub={`Meta ${fc(m.mSpend)} · G ${fc(m.gSpend)}`} t={t} delay={150}/>
              <KpiCard icon="⚡" label="Overall ROAS" value={fr(m.roas)} sub="Revenue per $1 spent" accent t={t} delay={200}/>
            </div>
          </div>

          {/* ── S2: ROAS ── */}
          <SectionLabel t={t}>Return On Ad Spend (ROAS)</SectionLabel>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:16 }}>
            {[
              { label:"Overall ROAS", platform:"All Channels",          val:m.roas },
              { label:"Meta ROAS",    platform:"Facebook / Instagram",   val:m.metaRoas },
              { label:"Google ROAS",  platform:"Google Ads",             val:m.gRoas },
            ].map((item, i) => (
              <MetricCard key={i} label={item.label} platform={item.platform}
                value={item.val > 0 ? fr(item.val) : "—"}
                barW={Math.min((item.val/6)*100,100)}
                status={roasSt(item.val)} t={t} delay={i*60}/>
            ))}
          </div>

          {/* ── S3: CAC ── */}
          <SectionLabel t={t}>Customer Acquisition Cost (CAC)</SectionLabel>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:16 }}>
            {[
              { label:"Overall CAC", platform:"All Channels",         val:m.cac },
              { label:"Meta CAC",    platform:"Facebook / Instagram",  val:m.metaCac },
              { label:"Google CAC",  platform:"Google Ads",            val:m.gCac },
            ].map((item, i) => {
              const s = cacSt(item.val);
              return <MetricCard key={i} label={item.label} platform={item.platform}
                value={item.val > 0 ? fc(item.val) : "—"}
                status={s} hint={s.hint} t={t} delay={i*60}/>;
            })}
          </div>

          {/* ── S4: AD SPEND ── */}
          <SectionLabel t={t}>Ad Spend & Attribution</SectionLabel>
          <div style={{ display:"grid", gridTemplateColumns:"1.6fr 1fr", gap:16 }}>
            {/* Pie chart */}
            <Card t={t} className="fade-up">
              <div style={{ fontSize:14, fontWeight:700, marginBottom:3, color:t.text }}>Ad Spend Breakdown</div>
              <div style={{ fontSize:11, color:t.textMuted, marginBottom:16 }}>Total: {fc(m.mSpend+m.gSpend)} this month</div>
              <div style={{ display:"flex", gap:20, alignItems:"center" }}>
                <ResponsiveContainer width={170} height={170}>
                  <PieChart>
                    <Pie data={[
                      { name:"Meta Ads",   value:m.mSpend, fill:"#5b9bd5" },
                      { name:"Google Ads", value:m.gSpend, fill:"#34A853" },
                    ]} cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                    paddingAngle={4} dataKey="value" strokeWidth={0}>
                      <Cell fill="#5b9bd5" style={{ filter:"drop-shadow(0 0 8px #5b9bd550)" }}/>
                      <Cell fill="#34A853" style={{ filter:"drop-shadow(0 0 8px #34A85350)" }}/>
                    </Pie>
                    <Tooltip content={p => p.active && p.payload?.length ? (
                      <div style={{ background:t.tooltipBg, border:`1px solid ${t.border}`, borderRadius:8, padding:"8px 12px", fontSize:12, fontFamily:"Poppins,sans-serif", color:t.text }}>
                        {p.payload[0].name}: {fc(p.payload[0].value)}
                      </div>
                    ) : null}/>
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ display:"flex", flexDirection:"column", gap:14, flex:1 }}>
                  {[
                    { name:"Meta Ads",   val:m.mSpend, col:"#5b9bd5" },
                    { name:"Google Ads", val:m.gSpend, col:"#34A853" },
                  ].map(d => (
                    <div key={d.name} style={{ display:"flex", alignItems:"center", gap:9 }}>
                      <div style={{ width:9, height:9, borderRadius:3, background:d.col, boxShadow:`0 0 5px ${d.col}` }}/>
                      <div style={{ fontSize:12, color:t.textSub, flex:1 }}>{d.name}</div>
                      <div>
                        <div style={{ fontSize:14, fontWeight:700, color:d.col }}>{fc(d.val)}</div>
                        <div style={{ fontSize:10, color:t.textMuted }}>
                          {(m.mSpend+m.gSpend)>0 ? fp((d.val/(m.mSpend+m.gSpend))*100) : "0%"}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div style={{ marginTop:4, paddingTop:10, borderTop:`1px solid ${t.border}` }}>
                    <div style={{ fontSize:9, color:t.textMuted, textTransform:"uppercase", letterSpacing:".07em" }}>Total</div>
                    <div style={{ fontSize:17, fontWeight:800, color:t.blue, marginTop:3, textShadow:`0 0 12px ${t.blueGlow}` }}>{fc(m.mSpend+m.gSpend)}</div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Platform pills */}
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
              {[
                { icon:"📘", label:"Meta Ads",   spend:m.mSpend, rev:m.revM, bar:m.tSpend>0?(m.mSpend/m.tSpend)*100:0, col:"#5b9bd5", revCol:"#7ab8f5", bg:"rgba(0,101,214,0.09)", border:"rgba(0,101,214,0.18)" },
                { icon:"🔍", label:"Google Ads", spend:m.gSpend, rev:m.revG, bar:m.tSpend>0?(m.gSpend/m.tSpend)*100:0, col:"#34A853", revCol:"#56c97a", bg:"rgba(52,168,83,0.09)",  border:"rgba(52,168,83,0.18)" },
              ].map(p => (
                <div key={p.label} className="fade-up" style={{ padding:"14px 16px", borderRadius:12, background:p.bg, border:`1px solid ${p.border}` }}>
                  <div style={{ fontSize:9, fontWeight:700, textTransform:"uppercase", letterSpacing:".08em", color:p.col, marginBottom:4 }}>{p.icon} {p.label}</div>
                  <div style={{ fontSize:20, fontWeight:800, color:p.revCol, marginBottom:4 }}>{fc(p.spend)}</div>
                  <div style={{ fontSize:10, color:t.textMuted }}>Revenue: <strong style={{ color:p.revCol }}>{fc(p.rev)}</strong></div>
                  <div style={{ height:4, background:t.border, borderRadius:2, marginTop:8, overflow:"hidden" }}>
                    <div style={{ height:"100%", width:`${p.bar}%`, background:p.col, borderRadius:2 }}/>
                  </div>
                </div>
              ))}
              <KpiCard icon="💰" label="Avg Job Value" value={fc(m.avgJob)} sub="Revenue ÷ Jobs" accent t={t}/>
            </div>
          </div>

          {/* ── S5: ATTRIBUTION ── */}
          <SectionLabel t={t}>Revenue & Lead Attribution</SectionLabel>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
            {/* Bar chart */}
            <Card t={t} className="fade-up">
              <div style={{ fontSize:14, fontWeight:700, marginBottom:3, color:t.text }}>Revenue Attribution</div>
              <div style={{ fontSize:11, color:t.textMuted, marginBottom:14 }}>Where your revenue is coming from</div>
              <ResponsiveContainer width="100%" height={185}>
                <BarChart data={[
                  { name:"Meta",   value:m.revM,  fill:"#5b9bd5" },
                  { name:"Google", value:m.revG,  fill:"#34A853" },
                  { name:"Other",  value:Math.max(m.rev-m.revM-m.revG,0), fill:dark?"rgba(255,255,255,0.1)":"rgba(0,0,0,0.1)" },
                ]} barCategoryGap="40%">
                  <CartesianGrid strokeDasharray="3 3" stroke={t.chartGrid} vertical={false}/>
                  <XAxis dataKey="name" stroke="transparent" tick={{ fontSize:11, fill:t.chartAxis, fontFamily:"Poppins" }}/>
                  <YAxis stroke="transparent" tick={{ fontSize:10, fill:t.chartAxis, fontFamily:"Poppins" }} tickFormatter={v=>`$${(v/1000).toFixed(0)}k`}/>
                  <Tooltip content={p => p.active && p.payload?.length ? (
                    <div style={{ background:t.tooltipBg, border:`1px solid ${t.border}`, borderRadius:8, padding:"8px 12px", fontSize:12, fontFamily:"Poppins,sans-serif", color:t.text }}>
                      {p.payload[0].name}: {fc(p.payload[0].value)}
                    </div>
                  ) : null}/>
                  <Bar dataKey="value" radius={[7,7,0,0]}>
                    {[
                      { fill:"#5b9bd5" },
                      { fill:"#34A853" },
                      { fill:dark?"rgba(255,255,255,0.1)":"rgba(0,0,0,0.1)" },
                    ].map((d,i) => <Cell key={i} fill={d.fill} style={{ filter:i<2?`drop-shadow(0 0 7px ${d.fill}70)`:""}}/>)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>

            {/* Lead sources */}
            <Card t={t} className="fade-up">
              <div style={{ fontSize:14, fontWeight:700, marginBottom:3, color:t.text }}>New Clients by Source</div>
              <div style={{ fontSize:11, color:t.textMuted, marginBottom:16 }}>Total: {m.lM+m.lG} new clients this month</div>
              <div style={{ display:"flex", gap:12 }}>
                {[
                  { icon:"📘", num:m.lM,  label:"Facebook / Meta", col:"#5b9bd5", bg:"rgba(91,155,213,0.1)", border:"rgba(91,155,213,0.2)" },
                  { icon:"🔍", num:m.lG,  label:"Google Ads",      col:"#34A853", bg:"rgba(52,168,83,0.1)",  border:"rgba(52,168,83,0.2)"  },
                ].map(s => (
                  <div key={s.label} style={{ flex:1, padding:"16px 14px", borderRadius:12, textAlign:"center", background:s.bg, border:`1px solid ${s.border}` }}>
                    <div style={{ fontSize:20, marginBottom:8 }}>{s.icon}</div>
                    <div className="count-in" style={{ fontSize:40, fontWeight:900, color:s.col, textShadow:`0 0 18px ${s.col}60`, lineHeight:1 }}>{s.num}</div>
                    <div style={{ fontSize:10, color:t.textMuted, marginTop:8 }}>{s.label}</div>
                    <div style={{ fontSize:11, fontWeight:600, color:s.col, marginTop:4 }}>
                      {(m.lM+m.lG)>0 ? fp((s.num/(m.lM+m.lG))*100)+' of total' : "—"}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* ── S6: TREND ── */}
          <SectionLabel t={t}>Revenue Trend</SectionLabel>
          <Card t={t} className="fade-up">
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:18 }}>
              <div>
                <div style={{ fontSize:14, fontWeight:700, color:t.text }}>Revenue & Ad Spend Over Time</div>
                <div style={{ fontSize:11, color:t.textMuted }}>6-month performance history</div>
              </div>
              <div style={{ display:"flex", gap:14, fontSize:10, color:t.textMuted }}>
                <span style={{ display:"flex", alignItems:"center", gap:5 }}>
                  <span style={{ width:10, height:3, background:t.blue, borderRadius:2, display:"inline-block", boxShadow:`0 0 5px ${t.blue}` }}/>Revenue
                </span>
                <span style={{ display:"flex", alignItems:"center", gap:5 }}>
                  <span style={{ width:10, height:3, background:t.green, borderRadius:2, display:"inline-block" }}/>Spend
                </span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={175}>
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={t.blue}  stopOpacity={0.2}/>
                    <stop offset="95%" stopColor={t.blue}  stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="gSpend" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={t.green} stopOpacity={0.15}/>
                    <stop offset="95%" stopColor={t.green} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={t.chartGrid} vertical={false}/>
                <XAxis dataKey="m" stroke="transparent" tick={{ fontSize:10, fill:t.chartAxis, fontFamily:"Poppins" }}/>
                <YAxis stroke="transparent" tick={{ fontSize:9, fill:t.chartAxis, fontFamily:"Poppins" }} tickFormatter={v=>`$${(v/1000).toFixed(0)}k`}/>
                <Tooltip content={<CustomTooltip t={t}/>}/>
                <Area type="monotone" dataKey="rev" stroke={t.blue} strokeWidth={2} fill="url(#gRev)" dot={{ fill:t.blue, strokeWidth:0, r:4 }} activeDot={{ r:6, fill:t.blue, stroke:"#fff", strokeWidth:2 }}/>
                <Area type="monotone" dataKey="spend" stroke={t.green} strokeWidth={2} fill="url(#gSpend)" dot={{ fill:t.green, strokeWidth:0, r:3 }}/>
              </AreaChart>
            </ResponsiveContainer>
          </Card>

          {/* ── S7: SCORECARD WIDGETS ── */}
          <SectionLabel t={t}>Full Scorecard & Performance</SectionLabel>

          {/* ── PERFORMANCE SCORE BANNER ── */}
          {(() => {
            const checks = [
              ["Overall ROAS ≥ 4x", m.roas>=4,          fr(m.roas),      "⚡"],
              ["CAC under $200",     m.cac<200&&m.cac>0, fc(m.cac),       "🎯"],
              ["Margin ≥ 25%",       m.margin>=25,       fp(m.margin),    "💎"],
              ["Meta ROAS ≥ 4x",     m.metaRoas>=4,      fr(m.metaRoas),  "📘"],
              ["Google ROAS ≥ 4x",   m.gRoas>=4,         fr(m.gRoas),     "🔍"],
            ];
            const score = checks.filter(c=>c[1]).length;
            const scoreCol = score>=4?t.green:score>=3?t.yellow:t.red;
            const pct = Math.round((score/checks.length)*100);
            return (
              <div className="fade-up" style={{
                background:`linear-gradient(135deg, ${scoreCol}14, ${t.card})`,
                border:`1px solid ${scoreCol}35`,
                borderRadius:18, padding:26, marginBottom:16,
              }}>
                {/* Header row */}
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:22 }}>
                  <div>
                    <div style={{ fontSize:16, fontWeight:700, color:t.text }}>🚦 Performance Snapshot</div>
                    <div style={{ fontSize:12, color:t.textMuted, marginTop:3 }}>How you're tracking against your KPI targets</div>
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:16 }}>
                    {/* Score circle */}
                    <div style={{ textAlign:"center" }}>
                      <div style={{
                        width:72, height:72, borderRadius:"50%",
                        background:`conic-gradient(${scoreCol} ${pct}%, ${t.border} 0%)`,
                        display:"flex", alignItems:"center", justifyContent:"center",
                        position:"relative",
                      }}>
                        <div style={{
                          width:54, height:54, borderRadius:"50%",
                          background:t.bg, display:"flex", flexDirection:"column",
                          alignItems:"center", justifyContent:"center",
                        }}>
                          <div style={{ fontSize:18, fontWeight:900, color:scoreCol, lineHeight:1 }}>{score}/{checks.length}</div>
                          <div style={{ fontSize:8, color:t.textMuted, marginTop:1 }}>targets</div>
                        </div>
                      </div>
                    </div>
                    <Tag label={score>=4?"On Fire 🔥":score>=3?"Good Track":"Needs Work"} type={score>=4?"green":score>=3?"yellow":"red"} t={t}/>
                  </div>
                </div>
                {/* KPI check widgets */}
                <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:10 }}>
                  {checks.map(([lbl, ok, val, icon], i) => (
                    <div key={i} style={{
                      background: ok ? `${t.green}0f` : `${t.red}0f`,
                      border:`1px solid ${ok ? t.green : t.red}28`,
                      borderRadius:12, padding:"14px 12px",
                      display:"flex", flexDirection:"column", alignItems:"center",
                      gap:6, textAlign:"center",
                      transition:"transform .2s",
                    }}>
                      <div style={{ fontSize:20 }}>{icon}</div>
                      <div style={{
                        fontSize:18, fontWeight:800,
                        color: ok ? t.green : t.red,
                        textShadow: ok ? `0 0 12px ${t.green}50` : "none",
                      }}>{val}</div>
                      <div style={{ fontSize:9, color:t.textMuted, lineHeight:1.4 }}>{lbl}</div>
                      <div style={{ fontSize:16 }}>{ok ? "✅" : "❌"}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* ── METRIC WIDGETS GRID ── */}
          {/* Row 1: Money metrics */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14, marginBottom:14 }}>
            {[
              { icon:"💰", label:"Monthly Revenue",  value:fc(m.rev),    color:t.green,  sub:"Total earned this month",     glow:true },
              { icon:"📈", label:"Monthly Profit",   value:fc(m.profit), color:t.green,  sub:`${fp(m.margin)} profit margin`, glow:true },
              { icon:"🔨", label:"Jobs Completed",   value:fn(m.jobs),   color:t.blue,   sub:`Avg ${fc(m.avgJob)} per job`  },
              { icon:"💸", label:"Total Ad Spend",   value:fc(m.tSpend), color:t.text,   sub:"Across all platforms"         },
            ].map((w, i) => (
              <Card key={i} t={t} className="fade-up" style={{ animationDelay:`${i*40}ms` }}>
                <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:12 }}>
                  <div style={{
                    width:38, height:38, borderRadius:10, fontSize:17,
                    display:"flex", alignItems:"center", justifyContent:"center",
                    background:t.blueDim, border:`1px solid ${t.border}`,
                  }}>{w.icon}</div>
                  <div style={{
                    width:8, height:8, borderRadius:"50%",
                    background: w.color === t.green ? t.green : w.color === t.blue ? t.blue : t.border,
                    boxShadow: w.glow ? `0 0 8px ${t.green}` : "none",
                    marginTop:6,
                  }}/>
                </div>
                <div style={{ fontSize:10, fontWeight:600, color:t.textMuted, textTransform:"uppercase", letterSpacing:".08em", marginBottom:5 }}>{w.label}</div>
                <div className="count-in" style={{
                  fontSize:22, fontWeight:800, color:w.color,
                  textShadow: w.glow ? `0 0 16px ${w.color}50` : "none",
                  lineHeight:1, marginBottom:6,
                }}>{w.value}</div>
                <div style={{ fontSize:10, color:t.textMuted }}>{w.sub}</div>
              </Card>
            ))}
          </div>

          {/* Row 2: ROAS widgets */}
          <div style={{ marginBottom:8 }}>
            <div style={{ fontSize:10, fontWeight:700, color:t.textMuted, textTransform:"uppercase", letterSpacing:".1em", marginBottom:10 }}>Return On Ad Spend</div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:14 }}>
              {[
                { label:"Overall ROAS",  val:m.roas,     icon:"⚡", platform:"All Channels" },
                { label:"Meta ROAS",     val:m.metaRoas, icon:"📘", platform:"Facebook / Instagram" },
                { label:"Google ROAS",   val:m.gRoas,    icon:"🔍", platform:"Google Ads" },
              ].map((w, i) => {
                const s = roasSt(w.val);
                const col = s.color ? t[s.color] : t.textMuted;
                const barPct = Math.min((w.val/6)*100, 100);
                return (
                  <Card key={i} t={t} className="fade-up" style={{ animationDelay:`${i*50}ms` }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                        <span style={{ fontSize:16 }}>{w.icon}</span>
                        <div>
                          <div style={{ fontSize:10, fontWeight:700, color:t.textMuted, textTransform:"uppercase", letterSpacing:".07em" }}>{w.label}</div>
                          <div style={{ fontSize:9, color:t.textMuted, opacity:.7 }}>{w.platform}</div>
                        </div>
                      </div>
                      <Tag label={s.label} type={s.cls} t={t}/>
                    </div>
                    <div style={{ fontSize:32, fontWeight:900, color:col, lineHeight:1, marginBottom:10, textShadow: s.color==="green"?`0 0 16px ${t.green}40`:"" }}>
                      {w.val>0 ? fr(w.val) : "—"}
                    </div>
                    {/* Progress toward 6x */}
                    <div style={{ height:6, background:t.border, borderRadius:3, overflow:"hidden", position:"relative" }}>
                      <div style={{
                        height:"100%", borderRadius:3,
                        width:`${barPct}%`,
                        background:`linear-gradient(90deg,${col},${col}80)`,
                        boxShadow: s.color ? `0 0 8px ${col}60` : "none",
                        transition:"width 1s ease",
                      }}/>
                      {/* 4x target marker */}
                      <div style={{
                        position:"absolute", top:0, bottom:0,
                        left:`${(4/6)*100}%`, width:2,
                        background:t.yellow, opacity:.6,
                      }}/>
                    </div>
                    <div style={{ display:"flex", justifyContent:"space-between", marginTop:5, fontSize:9, color:t.textMuted }}>
                      <span>0x</span><span style={{ color:t.yellow }}>4x target</span><span>6x+</span>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Row 3: CAC + Client widgets */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr) 1fr 1fr", gap:14, marginTop:14 }}>
            {/* CAC cards */}
            {[
              { label:"Overall CAC",  val:m.cac,      icon:"🎯", platform:"All Channels" },
              { label:"Meta CAC",     val:m.metaCac,  icon:"📘", platform:"Facebook" },
              { label:"Google CAC",   val:m.gCac,     icon:"🔍", platform:"Google Ads" },
            ].map((w, i) => {
              const s = cacSt(w.val);
              const col = s.color ? t[s.color] : t.textMuted;
              return (
                <Card key={i} t={t} className="fade-up" style={{ animationDelay:`${i*40}ms` }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
                    <div style={{ fontSize:16 }}>{w.icon}</div>
                    <Tag label={s.label} type={s.cls} t={t}/>
                  </div>
                  <div style={{ fontSize:9, fontWeight:700, color:t.textMuted, textTransform:"uppercase", letterSpacing:".07em", marginBottom:4 }}>{w.label}</div>
                  <div style={{ fontSize:9, color:t.textMuted, opacity:.7, marginBottom:8 }}>{w.platform}</div>
                  <div className="count-in" style={{ fontSize:26, fontWeight:800, color:col, lineHeight:1, marginBottom:6 }}>
                    {w.val>0 ? fc(w.val) : "—"}
                  </div>
                  <div style={{ fontSize:9, color:t.textMuted }}>{s.hint}</div>
                </Card>
              );
            })}
            {/* New clients */}
            <Card t={t} className="fade-up">
              <div style={{ fontSize:16, marginBottom:8 }}>👥</div>
              <div style={{ fontSize:9, fontWeight:700, color:t.textMuted, textTransform:"uppercase", letterSpacing:".07em", marginBottom:4 }}>New Clients</div>
              <div className="count-in" style={{ fontSize:26, fontWeight:800, color:t.blue, lineHeight:1, marginBottom:6 }}>{fn(m.newC)}</div>
              <div style={{ height:1, background:t.border, margin:"8px 0" }}/>
              <div style={{ fontSize:10, color:t.textMuted }}>Existing: <span style={{ color:t.text, fontWeight:600 }}>{fn(m.existC)}</span></div>
            </Card>
            {/* Platform revenue split */}
            <Card t={t} className="fade-up">
              <div style={{ fontSize:16, marginBottom:8 }}>📊</div>
              <div style={{ fontSize:9, fontWeight:700, color:t.textMuted, textTransform:"uppercase", letterSpacing:".07em", marginBottom:10 }}>Revenue Split</div>
              {[
                { label:"Meta",   val:m.revM, col:"#7ab8f5" },
                { label:"Google", val:m.revG, col:"#56c97a" },
              ].map(r => (
                <div key={r.label} style={{ marginBottom:8 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", fontSize:10, marginBottom:3 }}>
                    <span style={{ color:t.textMuted }}>{r.label}</span>
                    <span style={{ fontWeight:700, color:r.col }}>{fc(r.val)}</span>
                  </div>
                  <div style={{ height:4, background:t.border, borderRadius:2, overflow:"hidden" }}>
                    <div style={{ height:"100%", width:`${m.rev>0?(r.val/m.rev)*100:0}%`, background:r.col, borderRadius:2 }}/>
                  </div>
                </div>
              ))}
            </Card>
          </div>

        </>)}

        {/* Footer */}
        <div style={{
          textAlign:"center", padding:"20px 0",
          borderTop:`1px solid ${t.border}`,
          fontSize:10, color:t.textMuted, marginTop:40,
        }}>
          Digital Fastlane · Monthly Business Scorecard · {new Date().getFullYear()}
          {lastUpdate && ` · Last updated: ${lastUpdate.toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}`}
        </div>
      </div>
    </div>
  );
}
