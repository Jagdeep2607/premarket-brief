export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { ticker } = req.body
  if (!ticker) return res.status(400).json({ error: 'Ticker required' })

  const POLY = process.env.POLYGON_KEY
  const ANT  = process.env.ANTHROPIC_KEY

  if (!POLY || !ANT) {
    return res.status(500).json({
      error: 'API keys not set. Go to Vercel → your project → Settings → Environment Variables and add POLYGON_KEY and ANTHROPIC_KEY'
    })
  }

  try {
    // ── Polygon: 1 year daily bars ──────────────────────────────────
    const end   = new Date().toISOString().split('T')[0]
    const start = new Date(Date.now() - 400 * 86400000).toISOString().split('T')[0]

    const [aggsRes, newsRes] = await Promise.all([
      fetch(`https://api.polygon.io/v2/aggs/ticker/${ticker}/range/1/day/${start}/${end}?adjusted=true&sort=asc&limit=400&apiKey=${POLY}`),
      fetch(`https://api.polygon.io/v2/reference/news?ticker=${ticker}&limit=8&order=desc&sort=published_utc&apiKey=${POLY}`)
    ])

    const [aggsData, newsData] = await Promise.all([aggsRes.json(), newsRes.json()])

    const bars = (aggsData.results || []).map(r => ({
      date: new Date(r.t).toISOString().split('T')[0],
      op: r.o, hi: r.h, lo: r.l, cl: r.c, vo: r.v
    }))

    if (bars.length < 20) {
      return res.status(404).json({ error: `No price data found for ${ticker}. Check the ticker symbol.` })
    }

    // ── ATR 14 ───────────────────────────────────────────────────────
    const trs = []
    for (let i = 1; i < bars.length; i++) {
      trs.push(Math.max(
        bars[i].hi - bars[i].lo,
        Math.abs(bars[i].hi - bars[i-1].cl),
        Math.abs(bars[i].lo - bars[i-1].cl)
      ))
    }
    const atr14 = trs.slice(-14).reduce((a,b) => a+b, 0) / 14

    const last   = bars[bars.length - 1]
    const last5  = bars.slice(-5)
    const last20 = bars.slice(-20)
    const avgVol = bars.reduce((a,r) => a+r.vo, 0) / bars.length

    // ── Volume trend ─────────────────────────────────────────────────
    const v5  = last5.reduce((a,r) => a+r.vo, 0) / 5
    const v20 = last20.reduce((a,r) => a+r.vo, 0) / 20
    const volTrend = v5 > v20*1.1 ? 'Increasing' : v5 < v20*0.9 ? 'Decreasing' : 'Neutral'

    // ── S/R from last 20 days ────────────────────────────────────────
    const res20 = [...last20].sort((a,b) => b.hi - a.hi).slice(0,3).map(r => +r.hi.toFixed(2))
    const sup20 = [...last20].sort((a,b) => a.lo - b.lo).slice(0,3).map(r => +r.lo.toFixed(2))

    // ── CAM levels ───────────────────────────────────────────────────
    const H = last.hi, L = last.lo, C = last.cl
    const rng = H - L
    const CP = C
    const R3 = CP + rng*1.1/4
    const R4 = CP + rng*1.1/2
    const R6 = CP * H / L
    const S3 = CP - rng*1.1/4
    const S4 = CP - rng*1.1/2
    const S6 = CP - (R6 - CP)

    let camPos, camNote
    if      (C > R6) { camPos = 'Above R6';  camNote = 'Extended breakout — exhaustion risk high' }
    else if (C > R4) { camPos = 'R4 — R6';   camNote = 'Breakout zone — strong demand, R6 is next target' }
    else if (C > R3) { camPos = 'R3 — R4';   camNote = 'Above resistance — bullish open, watch R4 next' }
    else if (C > CP) { camPos = 'CP — R3';   camNote = 'Above pivot — bulls in control intraday' }
    else if (C > S3) { camPos = 'S3 — CP';   camNote = 'Below pivot — watch for CP reclaim to shift bias' }
    else if (C > S4) { camPos = 'S4 — S3';   camNote = 'Support zone — demand needs to step in here' }
    else             { camPos = 'Below S4';  camNote = 'Extended breakdown — supply fully in control' }

    // ── Wyckoff ──────────────────────────────────────────────────────
    const h5 = last5.map(r => r.hi)
    const l5 = last5.map(r => r.lo)
    const hh = h5[4] > h5[0], hl = l5[4] > l5[0]
    const lh = h5[4] < h5[0], ll = l5[4] < l5[0]
    const t20up = last20[19].cl > last20[0].cl

    let scBar = null, sosBar = null, sowBar = null
    for (const r of bars.slice(-120)) {
      const vr = r.vo / avgVol
      const rng_ = r.hi - r.lo
      const chg = r.cl - r.op
      if (chg < 0 && vr > 1.5 && (!scBar  || r.vo > scBar.vo))  scBar  = r
      if (chg > 0 && rng_ > atr14*1.3 && vr > 1.3 && (!sosBar || r.vo > sosBar.vo)) sosBar = r
      if (chg < 0 && rng_ > atr14*1.3 && vr > 1.3 && (!sowBar || r.vo > sowBar.vo)) sowBar = r
    }

    let wyPhase, wyDetail, wyNote, keyEvent = ''
    if (hh && hl && t20up) {
      wyPhase = 'Markup'; wyDetail = 'Higher highs + higher lows'
      wyNote = `Price making higher highs and higher lows across both 5 and 20-day windows. Volume ${volTrend.toLowerCase()} on up moves confirms demand. This is a healthy markup — pullbacks to support are buying opportunities while the structure holds.`
      if (sosBar) keyEvent = `SOS ${sosBar.date} · $${sosBar.cl.toFixed(2)} · ${(sosBar.vo/1e6).toFixed(0)}M vol`
    } else if (lh && ll && !t20up) {
      wyPhase = 'Markdown'; wyDetail = 'Lower highs + lower lows'
      wyNote = `Price making lower highs and lower lows — supply fully in control. Volume ${volTrend.toLowerCase()} on down moves. Avoid longs until a Sign of Strength (wide range up day on heavy volume) appears.`
      if (sowBar) keyEvent = `SOW ${sowBar.date} · $${sowBar.cl.toFixed(2)} · ${(sowBar.vo/1e6).toFixed(0)}M vol`
    } else if (scBar && t20up && last.cl > scBar.cl) {
      wyPhase = 'Accumulation'; wyDetail = 'Phase C / LPS area'
      wyNote = `Selling climax detected. Price held above the SC low and is building higher lows on shrinking volume. Watch for a Sign of Strength (wide range up bar on heavy volume) to confirm Phase D markup has begun.`
      keyEvent = `SC ${scBar.date} · $${scBar.cl.toFixed(2)} · ${(scBar.vo/1e6).toFixed(0)}M vol`
    } else if (sowBar && !t20up) {
      wyPhase = 'Distribution'; wyDetail = 'Topping — supply entering'
      wyNote = `Sign of Weakness detected near highs — supply absorbing demand on rallies. Volume ${volTrend.toLowerCase()} on up moves. Watch for Last Point of Supply (LPSY) to confirm markdown has started.`
      keyEvent = `SOW ${sowBar.date} · $${sowBar.cl.toFixed(2)} · ${(sowBar.vo/1e6).toFixed(0)}M vol`
    } else {
      wyPhase = 'Neutral'; wyDetail = 'Re-accumulation / Consolidation'
      wyNote = `Mixed signals — price in a trading range with no clear directional structure. Volume ${volTrend.toLowerCase()}. Wait for a wide range day on expanding volume to signal the next directional move.`
    }

    const last5closes = last5.map((r,i) => ({
      date: r.date.slice(5),
      close: +r.cl.toFixed(2),
      up: i === 0 ? true : r.cl >= last5[i-1].cl
    }))

    // ── News from Polygon ────────────────────────────────────────────
    const recentNews = (newsData.results || []).slice(0, 6)
    const newsText = recentNews.map((n,i) =>
      `${i+1}. [${new Date(n.published_utc).toLocaleDateString()}] ${n.title}: ${(n.description||'').slice(0,150)}`
    ).join('\n')

    // ── Claude analysis ──────────────────────────────────────────────
    const today = new Date().toLocaleDateString('en-US', { month:'long', day:'numeric', year:'numeric' })

    const prompt = `You are a pre-market day trading analyst. Today is ${today}.

REAL TECHNICAL DATA for ${ticker} (calculated from ${bars.length} days of Polygon data):
- Last close: $${last.cl.toFixed(2)}
- ATR(14): $${atr14.toFixed(2)} (${(atr14/last.cl*100).toFixed(2)}%)
- Wyckoff Phase: ${wyPhase} — ${wyDetail}
- Wyckoff Note: ${wyNote}
- Key Event: ${keyEvent || 'None'}
- CAM Position: ${camPos} — ${camNote}
- CAM Levels: R6:$${R6.toFixed(2)} R4:$${R4.toFixed(2)} R3:$${R3.toFixed(2)} CP:$${CP.toFixed(2)} S3:$${S3.toFixed(2)} S4:$${S4.toFixed(2)} S6:$${S6.toFixed(2)}
- Volume: ${volTrend} (5d avg ${(v5/1e6).toFixed(1)}M vs 20d avg ${(v20/1e6).toFixed(1)}M)
- Last 5 closes: ${last5closes.map(c => c.date+' $'+c.close).join(', ')}
- Resistance: $${res20.join(', $')}
- Support: $${sup20.join(', $')}

NEWS FROM POLYGON:
${newsText || 'No recent news found'}

Based on ALL the above, return ONLY a JSON object. No markdown. No text outside JSON. All string values single line no newlines:
{"news":[{"headline":"max 8 words","sentiment":"bullish|bearish|neutral","impact":"one line why matters today","stars":4,"starColor":"green|red|yellow","impactLabel":"Very High|High|Moderate|Low"}],"upcomingEvents":[{"type":"EARNINGS|MACRO|FED","title":"name","timing":"when","note":"price impact","color":"#7c3aed"}],"bias":"BULLISH|BEARISH|NEUTRAL","biasReason":"Two sentences combining Wyckoff phase and news into one clear daily bias."}

Rules: max 4 news, max 2 events, stars 1-5, no trailing commas.`

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANT,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }]
      })
    })

    const claudeData = await claudeRes.json()
    const txt = (claudeData.content || []).map(b => b.type === 'text' ? b.text : '').join('')

    // Robust JSON parsing with fallback
    const fallbackBias = hh && hl && t20up ? 'BULLISH' : lh && ll && !t20up ? 'BEARISH' : 'NEUTRAL'
    let claudeResult = {
      news: [{ headline: 'News unavailable', sentiment: 'neutral', impact: 'Technical data loaded successfully', stars: 1, starColor: 'yellow', impactLabel: 'Info' }],
      upcomingEvents: [],
      bias: fallbackBias,
      biasReason: `${wyPhase} structure detected. ${wyNote}`
    }

    const jsonMatch = txt.replace(/```json|```/g, '').match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      let s = jsonMatch[0]
        .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, ' ')
        .replace(/,(\s*[}\]])/g, '$1')
      s = s.replace(/"([^"\\]*(\\.[^"\\]*)*)"/g, m => m.replace(/\n|\r|\t/g, ' '))
      try { claudeResult = JSON.parse(s) } catch(e) { /* keep fallback */ }
    }

    // ── Final response ───────────────────────────────────────────────
    return res.status(200).json({
      ticker,
      currentPrice: +last.cl.toFixed(2),
      ...claudeResult,
      technical: {
        atr:     +atr14.toFixed(2),
        atrPct:  +(atr14/last.cl*100).toFixed(2),
        wyPhase, wyDetail, wyNote, keyEvent,
        camPos,  camNote,
        camLevels: {
          R6: +R6.toFixed(2), R4: +R4.toFixed(2), R3: +R3.toFixed(2),
          CP: +CP.toFixed(2), S3: +S3.toFixed(2), S4: +S4.toFixed(2), S6: +S6.toFixed(2)
        },
        volTrend,
        v5:  +(v5/1e6).toFixed(1),
        v20: +(v20/1e6).toFixed(1),
        last5closes,
        resistance: res20,
        support:    sup20,
        totalBars:  bars.length
      }
    })

  } catch (err) {
    console.error('Brief error:', err)
    return res.status(500).json({ error: err.message || 'Something went wrong — try again' })
  }
}
