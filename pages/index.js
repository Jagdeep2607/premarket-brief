import { useState } from 'react'
import Head from 'next/head'

// ── Color helpers ─────────────────────────────────────────────────────────
const bCol  = b => b==='BULLISH' ? '#15803d' : b==='BEARISH' ? '#dc2626' : '#b45309'
const bBg   = b => b==='BULLISH' ? '#f0fdf4' : b==='BEARISH' ? '#fef2f2' : '#fffbeb'
const bBord = b => b==='BULLISH' ? '#86efac' : b==='BEARISH' ? '#fca5a5' : '#fde68a'
const sCol  = s => s==='bullish' ? '#15803d' : s==='bearish' ? '#dc2626' : '#b45309'
const sBg   = s => s==='bullish' ? '#dcfce7' : s==='bearish' ? '#fee2e2' : '#fef3c7'
const wCol  = p => ['Markup','Accumulation'].includes(p) ? '#15803d' : ['Markdown','Distribution'].includes(p) ? '#dc2626' : '#b45309'
const wBg   = p => ['Markup','Accumulation'].includes(p) ? '#dcfce7' : ['Markdown','Distribution'].includes(p) ? '#fee2e2' : '#fef3c7'
const vCol  = v => v==='Increasing' ? '#15803d' : v==='Decreasing' ? '#dc2626' : '#b45309'

const CHIPS = ['TSLA','NVDA','AMD','PLTR','AAPL','META','MSFT','SPY']

export default function Home() {
  const [ticker,  setTicker]  = useState('')
  const [step,    setStep]    = useState('idle')
  const [data,    setData]    = useState(null)
  const [err,     setErr]     = useState('')
  const [msg,     setMsg]     = useState('')

  const MSGS = [
    'Pulling 1 year of price data from Polygon...',
    'Calculating Wyckoff structure...',
    'Analysing CAM levels and volume...',
    'Reading today\'s news...',
    'Building your brief...'
  ]

  async function go(sym) {
    const t = (sym || ticker).trim().toUpperCase()
    if (!t) return
    setStep('loading'); setErr(''); setData(null); setMsg(MSGS[0])
    let i = 0
    const iv = setInterval(() => { i = Math.min(i+1, MSGS.length-1); setMsg(MSGS[i]) }, 4000)
    try {
      const res = await fetch('/api/brief', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ ticker: t })
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'Request failed')
      setData(d); setStep('done')
    } catch(e) {
      setErr(e.message); setStep('error')
    } finally {
      clearInterval(iv)
    }
  }

  // ── LOADING ───────────────────────────────────────────────────────────────
  if (step === 'loading') return (
    <Page>
      <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:16,padding:40}}>
        <div style={{fontSize:30,fontWeight:700,color:'#111827',letterSpacing:5,fontFamily:'JetBrains Mono,monospace'}}>
          {ticker.toUpperCase()}
        </div>
        <div style={{display:'flex',gap:5}}>
          {[0,.12,.24,.36,.48].map((d,i) => (
            <div key={i} style={{width:4,height:22,background:'#111827',borderRadius:3,
              animation:'bl 1s ease-in-out infinite',animationDelay:`${d}s`}}/>
          ))}
        </div>
        <div style={{fontSize:13,color:'#6b7280',fontWeight:500,textAlign:'center',maxWidth:300}}>{msg}</div>
        <style>{`@keyframes bl{0%,100%{opacity:.1;transform:scaleY(.3)}50%{opacity:1;transform:scaleY(1)}}`}</style>
      </div>
    </Page>
  )

  // ── BRIEF ─────────────────────────────────────────────────────────────────
  if (step === 'done' && data) {
    const bias = data.bias || 'NEUTRAL'
    const tech = data.technical || {}
    const bc = bCol(bias), wc = wCol(tech.wyPhase)
    const today = new Date().toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})

    return (
      <div style={{background:'#f7f7f3',minHeight:'100vh',fontFamily:'Inter,sans-serif'}}>
        <Head><title>{data.ticker} — Pre-Market Brief</title></Head>
        <Fonts/>

        {/* ── Header ── */}
        <div style={{background:'#fff',borderBottom:'2px solid #e5e7eb',padding:'13px 22px',
          display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:10}}>
          <div style={{display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'}}>
            <div style={{width:10,height:10,borderRadius:'50%',background:bc,
              boxShadow:`0 0 0 3px ${bc}40`}}/>
            <span style={{fontSize:22,fontWeight:700,color:'#111827',letterSpacing:3,
              fontFamily:'JetBrains Mono,monospace'}}>{data.ticker}</span>
            <span style={{fontSize:15,fontWeight:600,color:'#374151',
              fontFamily:'JetBrains Mono,monospace'}}>${(+data.currentPrice).toFixed(2)}</span>
            <span style={{fontSize:11,color:'#6b7280',background:'#f3f4f6',
              padding:'3px 10px',borderRadius:4,fontWeight:600}}>{today}</span>
          </div>
          <div style={{display:'flex',gap:10,alignItems:'center'}}>
            <span style={{background:bc,color:'#fff',borderRadius:6,padding:'5px 16px',
              fontSize:12,fontWeight:700,letterSpacing:2}}>{bias}</span>
            <button onClick={()=>setStep('idle')} style={S.backBtn}>← NEW</button>
          </div>
        </div>

        {/* ── Body grid ── */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr'}}>

          {/* LEFT — News + Events + Bias */}
          <div style={{padding:20,borderRight:'2px solid #e5e7eb'}}>
            <SLabel color='#3b82f6'>News · past 24–48 hours</SLabel>
            {(data.news||[]).map((n,i) => {
              const c=sCol(n.sentiment), cbg=sBg(n.sentiment)
              const sc=n.starColor==='green'?'#15803d':n.starColor==='red'?'#dc2626':'#b45309'
              const stars=Math.min(5,Math.max(1,+(n.stars)||3))
              return (
                <div key={i} style={{borderLeft:`4px solid ${c}`,borderRadius:'0 8px 8px 0',
                  padding:'11px 13px',marginBottom:9,background:'#fff',
                  boxShadow:'0 1px 2px rgba(0,0,0,.05)'}}>
                  <div style={{display:'flex',alignItems:'flex-start',gap:8,marginBottom:5}}>
                    <span style={{fontSize:10,fontWeight:700,padding:'2px 7px',borderRadius:12,
                      color:c,background:cbg,flexShrink:0,marginTop:2}}>
                      {n.sentiment==='bullish'?'▲ BULL':n.sentiment==='bearish'?'▼ BEAR':'● NEUT'}
                    </span>
                    <span style={{fontSize:13,fontWeight:600,color:'#111827',lineHeight:1.4}}>
                      {n.headline}
                    </span>
                  </div>
                  <div style={{fontSize:12,color:'#374151',paddingLeft:36,
                    lineHeight:1.5,marginBottom:6,fontWeight:500}}>{n.impact}</div>
                  <div style={{display:'flex',alignItems:'center',paddingLeft:36}}>
                    <span style={{color:sc,fontSize:16}}>{'★'.repeat(stars)}</span>
                    <span style={{color:'#d1d5db',fontSize:16}}>{'★'.repeat(5-stars)}</span>
                    <span style={{fontSize:10,fontWeight:700,color:sc,marginLeft:6}}>
                      {n.impactLabel}
                    </span>
                  </div>
                </div>
              )
            })}

            <SLabel color='#7c3aed' mt={6}>Upcoming · next 24 hours</SLabel>
            {data.upcomingEvents && data.upcomingEvents.length
              ? data.upcomingEvents.map((ev,i) => {
                  const c = ev.color || '#7c3aed'
                  return (
                    <div key={i} style={{background:'#fff',border:`1px solid #e5e7eb`,
                      borderLeft:`4px solid ${c}`,borderRadius:'0 8px 8px 0',
                      padding:'10px 13px',marginBottom:9}}>
                      <div style={{fontSize:10,fontWeight:700,color:c,letterSpacing:1,marginBottom:3}}>
                        📅 {ev.type}
                      </div>
                      <div style={{fontSize:13,color:'#111827',fontWeight:600,marginBottom:2}}>
                        {ev.title} · {ev.timing}
                      </div>
                      <div style={{fontSize:11,color:'#374151',lineHeight:1.5,fontWeight:500}}>
                        {ev.note}
                      </div>
                    </div>
                  )
                })
              : <div style={{fontSize:11,color:'#9ca3af',padding:'5px 0',fontWeight:500}}>
                  No major events in next 24 hours
                </div>
            }

            {/* Bias */}
            <div style={{borderRadius:8,padding:'13px 15px',marginTop:8,
              border:`2px solid ${bBord(bias)}`,background:bBg(bias)}}>
              <div style={{fontSize:10,fontWeight:700,color:'#6b7280',
                letterSpacing:'1.5px',textTransform:'uppercase',marginBottom:6}}>Overall bias</div>
              <div style={{fontSize:15,fontWeight:700,color:bc,marginBottom:6}}>{bias}</div>
              <div style={{fontSize:12,color:'#374151',lineHeight:1.7,fontWeight:500}}>
                {data.biasReason}
              </div>
            </div>
          </div>

          {/* RIGHT — Wyckoff + Closes + Stats */}
          <div style={{padding:20}}>
            <SLabel color='#d97706'>Wyckoff · {tech.totalBars} days real data</SLabel>
            <div style={{borderLeft:`4px solid ${wc}`,borderRadius:'0 8px 8px 0',
              padding:'13px 15px',marginBottom:12,background:'#fff',
              border:`1px solid #e5e7eb`,borderLeftWidth:4,borderLeftColor:wc}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',
                marginBottom:7,gap:8,flexWrap:'wrap'}}>
                <span style={{fontSize:14,fontWeight:700,color:wc}}>{tech.wyPhase}</span>
                <span style={{fontSize:11,padding:'3px 10px',borderRadius:12,
                  fontWeight:700,color:wc,background:wBg(tech.wyPhase)}}>{tech.wyDetail}</span>
              </div>
              <div style={{fontSize:12,color:'#374151',lineHeight:1.75,
                marginBottom:7,fontWeight:500}}>{tech.wyNote}</div>
              {tech.keyEvent && (
                <div style={{fontSize:11,color:'#6b7280',borderTop:'1px solid #e5e7eb',
                  paddingTop:7,lineHeight:1.6,fontWeight:600}}>
                  Key event · <span style={{color:'#2563eb'}}>{tech.keyEvent}</span>
                </div>
              )}
            </div>

            <SLabel color='#6b7280'>Last 5 closes</SLabel>
            <div style={{display:'flex',gap:5,flexWrap:'wrap',marginBottom:7}}>
              {(tech.last5closes||[]).map((c,i) => (
                <span key={i} style={{fontSize:11,padding:'3px 9px',borderRadius:5,
                  border:`1px solid ${c.up?'#059669':'#dc2626'}`,
                  color:c.up?'#059669':'#dc2626',
                  background:c.up?'#f0fdf4':'#fef2f2',
                  fontFamily:'JetBrains Mono,monospace',fontWeight:600}}>
                  {c.date} · ${c.close} {c.up?'▲':'▼'}
                </span>
              ))}
            </div>
            <div style={{fontSize:11,color:'#6b7280',marginBottom:14,fontWeight:500}}>
              Volume: {tech.volTrend} · 5d avg {tech.v5}M vs 20d avg {tech.v20}M
            </div>

            {/* Stats grid */}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:12}}>
              {[
                {l:'ATR (14)',       v:`$${tech.atr}`, n:`${tech.atrPct}% daily range`,         c:'#111827'},
                {l:'CAM Position',  v:tech.camPos,     n:tech.camNote,                          c:'#1d4ed8'},
                {l:'Volume Trend',  v:`${tech.volTrend} ${tech.volTrend==='Increasing'?'↑':tech.volTrend==='Decreasing'?'↓':'→'}`, n:`5d ${tech.v5}M vs 20d ${tech.v20}M avg`, c:vCol(tech.volTrend)},
                {l:'CP Level',      v:`$${tech.camLevels?.CP?.toFixed(2)||'—'}`, n:'Central Pivot — key intraday reference', c:'#7c3aed'},
              ].map((s,i) => (
                <div key={i} style={{background:'#fff',border:'1px solid #e5e7eb',
                  borderRadius:8,padding:'11px 13px'}}>
                  <div style={{fontSize:10,fontWeight:700,color:'#6b7280',
                    letterSpacing:'1.5px',textTransform:'uppercase',marginBottom:4}}>{s.l}</div>
                  <div style={{fontSize:14,fontWeight:700,marginBottom:2,
                    fontFamily:'JetBrains Mono,monospace',color:s.c}}>{s.v}</div>
                  <div style={{fontSize:11,color:'#374151',lineHeight:1.5,fontWeight:500}}>{s.n}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Footer S/R ── */}
        <div style={{borderTop:'2px solid #e5e7eb',padding:'12px 22px',
          display:'flex',gap:24,flexWrap:'wrap',background:'#fff',alignItems:'flex-start'}}>
          <FootSection label='Resistance' items={tech.resistance||[]} pill='res'/>
          <FootSection label='Support'    items={tech.support||[]}    pill='sup'/>
          {tech.keyEvent && (
            <div>
              <div style={S.footLbl}>Wyckoff level</div>
              <span style={S.wPill}>{tech.keyEvent}</span>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── SEARCH / ERROR ────────────────────────────────────────────────────────
  return (
    <Page>
      <Fonts/>
      <div style={{display:'flex',flexDirection:'column',alignItems:'center',padding:'32px 20px'}}>
        <div style={{fontSize:10,fontWeight:700,color:'#9ca3af',letterSpacing:'4px',
          textTransform:'uppercase',marginBottom:8}}>Pre-Market Brief</div>
        <div style={{fontSize:24,fontWeight:700,color:'#111827',marginBottom:4}}>
          What's moving today?
        </div>
        <div style={{fontSize:13,color:'#6b7280',marginBottom:28}}>
          Polygon data · Wyckoff · News · S/R · CAM · Events
        </div>
        <div style={{display:'flex',marginBottom:14}}>
          <input
            value={ticker}
            onChange={e => setTicker(e.target.value.toUpperCase())}
            onKeyDown={e => e.key==='Enter' && go()}
            placeholder="NVDA"
            maxLength={6}
            autoFocus
            style={S.tickerInput}
          />
          <button
            onClick={() => go()}
            disabled={!ticker.trim()}
            style={{...S.goBtn, opacity: ticker.trim() ? 1 : 0.5}}
          >
            GET BRIEF →
          </button>
        </div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap',justifyContent:'center',marginBottom:16}}>
          {CHIPS.map(t => (
            <button key={t} onClick={() => go(t)} style={S.chip}>{t}</button>
          ))}
        </div>
        {step==='error' && (
          <div style={{color:'#dc2626',fontSize:12,marginTop:8,textAlign:'center',
            fontWeight:500,maxWidth:380,lineHeight:1.6,background:'#fef2f2',
            border:'1px solid #fca5a5',borderRadius:8,padding:'10px 14px'}}>
            {err}
          </div>
        )}
        <div style={{fontSize:11,color:'#d1d5db',marginTop:20,textAlign:'center'}}>
          Powered by Polygon.io + Claude AI
        </div>
      </div>
    </Page>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────
function Page({children}) {
  return (
    <div style={{background:'#f7f7f3',minHeight:'100vh',display:'flex',
      alignItems:'center',justifyContent:'center',fontFamily:'Inter,sans-serif'}}>
      {children}
    </div>
  )
}

function Fonts() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600;700&display=swap');
      *{box-sizing:border-box;margin:0;padding:0}
      body{background:#f7f7f3}
      button{cursor:pointer;font-family:inherit}
    `}</style>
  )
}

function SLabel({color, children, mt=0}) {
  return (
    <div style={{fontSize:10,fontWeight:700,color:'#6b7280',letterSpacing:'2px',
      textTransform:'uppercase',marginBottom:11,marginTop:mt,
      display:'flex',alignItems:'center',gap:6}}>
      <div style={{width:3,height:12,borderRadius:2,background:color,flexShrink:0}}/>
      {children}
    </div>
  )
}

function FootSection({label, items, pill}) {
  const isPill = pill === 'res'
    ? {fontSize:12,color:'#c2410c',background:'#fff7ed',padding:'4px 10px',borderRadius:5,fontFamily:'JetBrains Mono,monospace',fontWeight:700,border:'1px solid #fed7aa'}
    : {fontSize:12,color:'#15803d',background:'#f0fdf4',padding:'4px 10px',borderRadius:5,fontFamily:'JetBrains Mono,monospace',fontWeight:700,border:'1px solid #bbf7d0'}
  return (
    <div>
      <div style={S.footLbl}>{label}</div>
      <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
        {items.map((v,i) => <span key={i} style={isPill}>${v}</span>)}
      </div>
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────
const S = {
  tickerInput: {
    background:'#fff',border:'2px solid #e5e7eb',borderRight:'none',
    borderRadius:'8px 0 0 8px',color:'#111827',padding:'13px 18px',
    fontSize:22,fontWeight:700,letterSpacing:5,width:155,outline:'none',
    textTransform:'uppercase',fontFamily:'JetBrains Mono,monospace'
  },
  goBtn: {
    background:'#111827',border:'2px solid #111827',borderRadius:'0 8px 8px 0',
    color:'#fff',padding:'13px 22px',fontSize:12,fontWeight:700,
    letterSpacing:2,fontFamily:'JetBrains Mono,monospace'
  },
  chip: {
    background:'#fff',border:'1px solid #e5e7eb',borderRadius:20,
    padding:'5px 14px',fontSize:12,fontWeight:700,color:'#374151',
    fontFamily:'JetBrains Mono,monospace',letterSpacing:1
  },
  backBtn: {
    background:'transparent',border:'1px solid #d1d5db',color:'#6b7280',
    padding:'5px 12px',borderRadius:5,fontSize:11,fontWeight:600
  },
  footLbl: {
    fontSize:10,fontWeight:700,color:'#6b7280',letterSpacing:'2px',
    textTransform:'uppercase',marginBottom:7
  },
  wPill: {
    fontSize:11,color:'#1d4ed8',background:'#eff6ff',
    padding:'4px 9px',borderRadius:5,border:'1px solid #bfdbfe',fontWeight:600
  }
}
