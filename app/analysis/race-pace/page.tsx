'use client'
import { Suspense, useEffect, useRef, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import * as d3 from 'd3'
import { CDN_FALLBACKS, AVAILABLE_YEARS, EVENTS_BY_YEAR, TEAM_COLORS } from '@/lib/constants'
import { RefreshCw, TrendingUp } from 'lucide-react'

const enc = (s: string) => encodeURIComponent(s)

// ── Types ──────────────────────────────────────────────────────────────────
interface LapRow {
  lap: number; time: number; compound: string; stint: number; pos: number
}
interface DriverStats {
  code: string; team: string; color: string; url: string; fn: string; ln: string
  laps: LapRow[]
  mean: number; median: number; q1: number; q3: number
  min: number; max: number; iqr: number; stddev: number
  smoothed: { lap: number; t: number }[]
  tyreStrategy: string  // e.g. "M-H" or "H-M-S"
}

// ── Format seconds ─────────────────────────────────────────────────────────
const fmtSec  = (t: number) => t.toFixed(2) + 's'
const fmtSecF = (t: number) => t.toFixed(3) + 's'

// ── Data fetching ──────────────────────────────────────────────────────────
async function fetchAllRaceLaps(year: number, event: string): Promise<{ stats: DriverStats[]; error?: string }> {
  const base = CDN_FALLBACKS[0]
  const path = `${year}@main/${enc(event)}/Race`

  let driverList: { driver: string; team: string; tc: string; fn: string; ln: string; url: string }[] = []
  try {
    const r = await fetch(`${base}/${path}/drivers.json?_=${Date.now()}`)
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    const d = await r.json()
    driverList = d.drivers ?? []
  } catch (e: any) {
    return { stats: [], error: `No race data found for "${event}" ${year}. Data is published ~30 min after the session ends.` }
  }

  const infoMap: Record<string, { team: string; color: string; fn: string; ln: string; url: string }> = {}
  driverList.forEach(d => {
    infoMap[d.driver] = {
      team:  d.team,
      color: d.tc ? `#${d.tc}` : (TEAM_COLORS[d.team] ?? '#888'),
      fn:    d.fn ?? '',
      ln:    d.ln ?? '',
      url:   d.url ?? '',
    }
  })

  const settled = await Promise.allSettled(
    driverList.map(async d => {
      const r = await fetch(`${base}/${path}/${d.driver}/laptimes.json?_=${Date.now()}`)
      if (!r.ok) return null
      const raw = await r.json()
      return { code: d.driver, raw }
    })
  )

  const stats: DriverStats[] = []

  settled.forEach(res => {
    if (res.status !== 'fulfilled' || !res.value) return
    const { code, raw } = res.value
    const info = infoMap[code] ?? { team: 'Unknown', color: '#888', fn: '', ln: '', url: '' }
    const len = raw.lap?.length ?? 0

    const n = (v: any): number | null => (v === 'None' || v == null) ? null : +v
    const b = (v: any) => v === true || v === 'True'

    const laps: LapRow[] = []
    for (let i = 0; i < len; i++) {
      const t = n(raw.time?.[i])
      if (t === null || t <= 0) continue
      if (b(raw.del?.[i])) continue
      if ((raw.lap?.[i] ?? 0) <= 1) continue   // skip formation lap

      // Filter Safety Car / VSC / red flag laps
      const st = String(raw.status?.[i] ?? '1')
      if (/[456]/.test(st)) continue

      laps.push({
        lap:      raw.lap[i],
        time:     t,  // already in seconds from the API
        compound: String(raw.compound?.[i] ?? 'UNKNOWN').toUpperCase().replace('NONE','UNKNOWN'),
        stint:    raw.stint?.[i] ?? 1,
        pos:      n(raw.pos?.[i]) ?? 0,
      })
    }

    if (laps.length < 4) return

    // Remove pit in/out laps: > 1.12× median
    const rawTimes = laps.map(l => l.time).sort(d3.ascending)
    const rawMedian = d3.median(rawTimes)!
    const clean = laps.filter(l => l.time <= rawMedian * 1.12)
    if (clean.length < 4) return

    const times = clean.map(l => l.time).sort(d3.ascending)
    const mean   = d3.mean(times)!
    const median = d3.median(times)!
    const q1     = d3.quantile(times, 0.25)!
    const q3     = d3.quantile(times, 0.75)!
    const iqr    = q3 - q1
    const stddev = d3.deviation(times) ?? 0
    const wMin   = Math.max(times[0], q1 - 1.5 * iqr)
    const wMax   = Math.min(times[times.length - 1], q3 + 1.5 * iqr)

    // Build tyre strategy string (unique compounds in stint order, e.g. "M-H")
    const stintOrder = [...clean].sort((a, b) => a.lap - b.lap)
    const tyreStr = (() => {
      const seen: string[] = []
      stintOrder.forEach(l => {
        const c = l.compound[0]
        if (!seen.length || seen[seen.length - 1] !== c) seen.push(c)
      })
      return seen.join('-')
    })()

    // Smoothed trace: rolling window-3
    const byLap = [...clean].sort((a, b) => a.lap - b.lap)
    const smoothed: { lap: number; t: number }[] = []
    for (let i = 1; i < byLap.length - 1; i++) {
      smoothed.push({ lap: byLap[i].lap, t: (byLap[i-1].time + byLap[i].time + byLap[i+1].time) / 3 })
    }

    stats.push({
      code, ...info,
      laps: clean, mean, median, q1, q3, iqr, stddev,
      min: wMin, max: wMax,
      smoothed, tyreStrategy: tyreStr,
    })
  })

  stats.sort((a, b) => a.mean - b.mean)
  return { stats }
}

// ── EXACT AXIS CONSTANTS (ripped from reference image) ────────────────────
// Y-axis: 95s at BOTTOM → 102s at TOP, integer ticks every 1s
const Y_MIN = 95   // bottom of chart
const Y_MAX = 102  // top of chart
const Y_TICKS = [95, 96, 97, 98, 99, 100, 101, 102]  // exact tick values

// ── Box Plot Chart (exact replica of reference image) ────────────────────
function BoxPlotChart({ stats, year, event }: { stats: DriverStats[]; year: number; event: string }) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const tipRef  = useRef<HTMLDivElement>(null)
  const roRef   = useRef<ResizeObserver | null>(null)

  const draw = useCallback(() => {
    if (!wrapRef.current || !stats.length) return
    wrapRef.current.innerHTML = ''

    const W    = wrapRef.current.clientWidth || 900
    const N    = stats.length
    // Margins matching reference image
    const mL   = 64   // space for Y axis label + ticks
    const mR   = 24
    const mT   = 72   // space for title
    const mB   = 110  // space for driver code, mean, delta, tyre, photos
    // Box width: spread evenly
    const boxW  = Math.max(22, Math.min(52, (W - mL - mR) / N - 8))
    const iW    = Math.max(W - mL - mR, N * (boxW + 10))
    const iH    = 340  // chart height — same aspect as reference

    const svgW  = iW + mL + mR
    const svgH  = iH + mT + mB

    const svg = d3.create('svg')
      .attr('width', svgW).attr('height', svgH)
      .style('font-family', 'monospace, monospace')

    const defs = svg.append('defs')
    const bg = defs.append('linearGradient').attr('id','rpBg').attr('x1','0%').attr('y1','0%').attr('x2','0%').attr('y2','100%')
    bg.append('stop').attr('offset','0%').attr('stop-color','rgba(255,255,255,0.02)')
    bg.append('stop').attr('offset','100%').attr('stop-color','rgba(0,0,0,0)')

    const g = svg.append('g').attr('transform', `translate(${mL},${mT})`)
    g.append('rect').attr('width', iW).attr('height', iH).attr('fill', 'url(#rpBg)').attr('rx', 4)

    // ── Y SCALE: 95 at BOTTOM (iH), 102 at TOP (0) ───────────────────────
    // domain([low,high]).range([bottom,top])  →  low value = bottom of SVG
    const dataMin  = d3.min(stats.flatMap(s => [s.min, ...s.laps.map(l => l.time)])) ?? Y_MIN
    const dataMax  = d3.max(stats.flatMap(s => [s.max, ...s.laps.map(l => l.time)])) ?? Y_MAX
    const yLo      = Math.min(Y_MIN, Math.floor(dataMin) - 0.5)
    const yHi      = Math.max(Y_MAX, Math.ceil(dataMax)  + 0.5)
    // KEY: domain goes from LOW (maps to bottom=iH) to HIGH (maps to top=0)
    const yS = d3.scaleLinear()
      .domain([yLo, yHi])   // yLo=95 → range value iH (bottom), yHi=102 → range value 0 (top)
      .range([iH, 0])        // iH = bottom pixel, 0 = top pixel

    // Build tick values: integers between yLo and yHi
    const yTickVals: number[] = []
    for (let v = Math.ceil(yLo); v <= Math.floor(yHi); v++) yTickVals.push(v)

    // Horizontal grid lines — one per integer tick
    yTickVals.forEach(v => {
      g.append('line')
        .attr('x1', 0).attr('x2', iW)
        .attr('y1', yS(v)).attr('y2', yS(v))
        .attr('stroke', 'rgba(255,255,255,0.07)')
        .attr('stroke-dasharray', v % 1 === 0 ? '4,5' : '2,8')
    })

    // ── Y AXIS (left) ─────────────────────────────────────────────────────
    g.append('g')
      .call(
        d3.axisLeft(yS)
          .tickValues(yTickVals)
          .tickFormat(d => `${+d}`)
          .tickSize(6)
      )
      .call(sel => {
        sel.selectAll('text')
          .attr('fill', 'rgba(255,255,255,0.6)')
          .attr('font-size', 11)
          .attr('font-family', 'monospace')
        sel.selectAll('line').attr('stroke', 'rgba(255,255,255,0.2)')
        sel.select('.domain').attr('stroke', 'rgba(255,255,255,0.25)')
      })

    // Y axis label ("Smoothed Laptime (s)") — vertical, left
    svg.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -(mT + iH / 2))
      .attr('y', 14)
      .attr('text-anchor', 'middle')
      .attr('fill', 'rgba(255,255,255,0.5)')
      .attr('font-size', 11)
      .attr('font-family', 'sans-serif')
      .text('Smoothed Laptime (s)')

    // ── X SCALE: band for each driver ─────────────────────────────────────
    const xS = d3.scaleBand()
      .domain(stats.map(s => s.code))
      .range([0, iW])
      .paddingInner(0.35)
      .paddingOuter(0.1)
    const bw = xS.bandwidth()

    // ── Plot each driver's box ─────────────────────────────────────────────
    const baseline = stats[0].mean
    stats.forEach((s, i) => {
      const x0  = xS(s.code) ?? 0
      const cx  = x0 + bw / 2
      const col = s.color
      const delta = s.mean - baseline

      // --- Outlier dots (open circles, beyond 1.5×IQR) ---
      s.laps.forEach(l => {
        if (l.time < s.q1 - 1.5 * s.iqr || l.time > s.q3 + 1.5 * s.iqr) {
          g.append('circle')
            .attr('cx', cx).attr('cy', yS(l.time)).attr('r', 3.5)
            .attr('fill', 'none').attr('stroke', col)
            .attr('stroke-width', 1.5).attr('opacity', 0.75)
        }
      })

      // --- Whisker lines ---
      // Lower whisker: from Q1 down to whisker min
      g.append('line')
        .attr('x1', cx).attr('x2', cx)
        .attr('y1', yS(s.q1)).attr('y2', yS(s.min))
        .attr('stroke', col).attr('stroke-width', 1.8).attr('opacity', 0.7)
      // Lower cap
      g.append('line')
        .attr('x1', cx - bw * 0.28).attr('x2', cx + bw * 0.28)
        .attr('y1', yS(s.min)).attr('y2', yS(s.min))
        .attr('stroke', col).attr('stroke-width', 1.5).attr('opacity', 0.6)

      // Upper whisker: from Q3 up to whisker max
      g.append('line')
        .attr('x1', cx).attr('x2', cx)
        .attr('y1', yS(s.q3)).attr('y2', yS(s.max))
        .attr('stroke', col).attr('stroke-width', 1.8).attr('opacity', 0.7)
      // Upper cap
      g.append('line')
        .attr('x1', cx - bw * 0.28).attr('x2', cx + bw * 0.28)
        .attr('y1', yS(s.max)).attr('y2', yS(s.max))
        .attr('stroke', col).attr('stroke-width', 1.5).attr('opacity', 0.6)

      // --- IQR Box ---
      // q3 is larger value → yS(q3) is HIGHER UP (smaller y pixel value)
      // q1 is smaller value → yS(q1) is LOWER DOWN (larger y pixel value)
      // box top = yS(q3), box bottom = yS(q1)
      const boxTop  = yS(s.q3)
      const boxBot  = yS(s.q1)
      const boxH    = Math.max(3, boxBot - boxTop)

      g.append('rect')
        .attr('x', x0).attr('width', bw)
        .attr('y', boxTop).attr('height', boxH)
        .attr('rx', 2)
        .attr('fill', col).attr('fill-opacity', 0.20)
        .attr('stroke', col).attr('stroke-width', 2.2)
        .attr('cursor', 'pointer')
        .on('mouseover', function(e) {
          d3.select(this).attr('fill-opacity', 0.45)
          if (!tipRef.current) return
          const rect = wrapRef.current!.getBoundingClientRect()
          tipRef.current.style.display = 'block'
          tipRef.current.style.left = `${Math.min(e.clientX - rect.left + 12, W - 220)}px`
          tipRef.current.style.top  = `${Math.max(0, e.clientY - rect.top - 150)}px`
          tipRef.current.innerHTML = `
            <div style="color:${col}" class="font-black text-sm mb-1">${s.fn} ${s.ln}</div>
            <div class="text-[10px] text-white/50 mb-2">${s.team}</div>
            <table class="text-[11px] font-mono w-full">
              <tr><td class="text-white/40 pr-3">Mean</td><td class="font-bold text-white">${fmtSecF(s.mean)}</td></tr>
              <tr><td class="text-white/40 pr-3">Median</td><td class="text-white/70">${fmtSecF(s.median)}</td></tr>
              <tr><td class="text-white/40 pr-3">Q3 (75%)</td><td class="text-white/60">${fmtSecF(s.q3)}</td></tr>
              <tr><td class="text-white/40 pr-3">Q1 (25%)</td><td class="text-white/60">${fmtSecF(s.q1)}</td></tr>
              <tr><td class="text-white/40 pr-3">IQR</td><td class="text-white/60">${fmtSecF(s.iqr)}</td></tr>
              <tr><td class="text-white/40 pr-3">Δ best</td>
                <td style="color:${delta<=0?'#4ade80':'#f87171'}">${delta<=0?'—':'+'+delta.toFixed(3)+'s'}</td></tr>
              <tr><td class="text-white/40 pr-3">Laps</td><td class="text-white/60">${s.laps.length}</td></tr>
              <tr><td class="text-white/40 pr-3">Tyres</td><td style="color:${col}">${s.tyreStrategy}</td></tr>
            </table>
          `
        })
        .on('mouseout', function() {
          d3.select(this).attr('fill-opacity', 0.20)
          if (tipRef.current) tipRef.current.style.display = 'none'
        })

      // --- Median line (SOLID, thick, colored) ---
      g.append('line')
        .attr('x1', x0).attr('x2', x0 + bw)
        .attr('y1', yS(s.median)).attr('y2', yS(s.median))
        .attr('stroke', col).attr('stroke-width', 3).attr('opacity', 1)

      // --- Mean line (DASHED, thinner) ---
      g.append('line')
        .attr('x1', x0).attr('x2', x0 + bw)
        .attr('y1', yS(s.mean)).attr('y2', yS(s.mean))
        .attr('stroke', '#ffffff').attr('stroke-width', 1.5)
        .attr('stroke-dasharray', '3,2.5').attr('opacity', 0.6)

      // ── X-axis labels: code / mean / delta / tyre ──────────────────────
      const lb = g.append('g').attr('transform', `translate(${cx},${iH + 8})`)

      // Driver code
      lb.append('text').attr('text-anchor', 'middle')
        .attr('fill', col).attr('font-size', 11).attr('font-weight', '900').attr('y', 0)
        .text(s.code)

      // Mean time in seconds
      lb.append('text').attr('text-anchor', 'middle')
        .attr('fill', 'rgba(255,255,255,0.65)').attr('font-size', 9).attr('y', 13)
        .text(s.mean.toFixed(2))

      // Delta
      lb.append('text').attr('text-anchor', 'middle')
        .attr('fill', delta <= 0.01 ? '#4ade80' : 'rgba(248,113,113,0.9)')
        .attr('font-size', 9).attr('y', 25)
        .text(delta <= 0.01 ? '+0.00s' : `+${delta.toFixed(2)}s`)

      // Tyre strategy
      lb.append('text').attr('text-anchor', 'middle')
        .attr('fill', 'rgba(255,255,255,0.35)').attr('font-size', 8.5).attr('y', 36)
        .text(s.tyreStrategy)
    })

    // ── Legend (bottom right, matching reference) ─────────────────────────
    const legX = iW - 250, legY = iH - 70
    const legG = g.append('g').attr('transform', `translate(${legX},${legY})`)
    legG.append('rect').attr('x',-8).attr('y',-4).attr('width',258).attr('height',74)
      .attr('rx',4).attr('fill','rgba(5,10,30,0.7)').attr('stroke','rgba(255,255,255,0.1)')
    const legLines = [
      'Dashed Line: Mean, Solid Line: Median;',
      'Boxes contain 50% of the laps;',
      'Whiskers contain 99.3% of normal distrib.',
      'Dots indicate outliers.',
    ]
    legLines.forEach((txt, i) => {
      legG.append('text').attr('x', 0).attr('y', i * 15 + 10)
        .attr('fill', 'rgba(255,255,255,0.5)').attr('font-size', 9)
        .text(txt)
    })

    // ── Title ─────────────────────────────────────────────────────────────
    svg.append('text').attr('x', mL + iW / 2).attr('y', 22)
      .attr('text-anchor', 'middle').attr('fill', 'rgba(255,255,255,0.9)')
      .attr('font-size', 15).attr('font-weight', '900')
      .text(`${year} ${event} — Race`)
    svg.append('text').attr('x', mL + iW / 2).attr('y', 40)
      .attr('text-anchor', 'middle').attr('fill', 'rgba(255,255,255,0.4)')
      .attr('font-size', 10)
      .text('Global Race Pace (Drivers Sorted by Mean Laptime)')
    svg.append('text').attr('x', mL + iW / 2).attr('y', 57)
      .attr('text-anchor', 'middle').attr('fill', 'rgba(255,200,0,0.9)')
      .attr('font-size', 13).attr('font-weight', '900').attr('letter-spacing','2')
      .text('RACE PACE')

    wrapRef.current.appendChild(svg.node()!)
  }, [stats, year, event])

  useEffect(() => {
    draw()
    roRef.current?.disconnect()
    roRef.current = new ResizeObserver(draw)
    if (wrapRef.current) roRef.current.observe(wrapRef.current)
    return () => roRef.current?.disconnect()
  }, [draw])

  return (
    <div className="relative w-full overflow-x-auto">
      <div ref={wrapRef} className="w-full" style={{ minWidth: Math.max(640, stats.length * 54) }}/>
      <div ref={tipRef} className="chart-tooltip hidden absolute z-50" style={{ maxWidth: 240, pointerEvents: 'none' }}/>
    </div>
  )
}

// ── Smoothed Lap-by-Lap Race Trace (bottom chart from reference) ──────────
function RaceTraceChart({ stats }: { stats: DriverStats[] }) {
  const ref   = useRef<SVGSVGElement>(null)
  const roRef = useRef<ResizeObserver | null>(null)

  function draw() {
    if (!ref.current || !stats.length) return
    const svg = d3.select(ref.current)
    svg.selectAll('*').remove()

    const W  = ref.current.parentElement!.clientWidth || 900
    const mL = 64, mR = 120, mT = 16, mB = 52
    const iW = W - mL - mR, iH = 260

    svg.attr('width', W).attr('height', iH + mT + mB)
    const g = svg.append('g').attr('transform', `translate(${mL},${mT})`)

    const allPts = stats.flatMap(s => s.smoothed)
    if (!allPts.length) return

    const minLap = d3.min(allPts, p => p.lap)!
    const maxLap = d3.max(allPts, p => p.lap)!
    const dataMinT = d3.min(allPts, p => p.t)!
    const dataMaxT = d3.max(allPts, p => p.t)!

    // ── Y SCALE: same 95→102 convention ──────────────────────────────────
    const yLo = Math.min(Y_MIN, Math.floor(dataMinT) - 0.5)
    const yHi = Math.max(Y_MAX, Math.ceil(dataMaxT)  + 0.5)
    // 95 at BOTTOM (iH), 102 at TOP (0)
    const yS = d3.scaleLinear().domain([yLo, yHi]).range([iH, 0])

    const yTickVals2: number[] = []
    for (let v = Math.ceil(yLo); v <= Math.floor(yHi); v++) yTickVals2.push(v)

    // ── X SCALE: lap numbers ──────────────────────────────────────────────
    const xS = d3.scaleLinear().domain([minLap, maxLap]).range([0, iW])

    // Grid lines
    yTickVals2.forEach(v => {
      g.append('line').attr('x1', 0).attr('x2', iW).attr('y1', yS(v)).attr('y2', yS(v))
        .attr('stroke', 'rgba(255,255,255,0.06)').attr('stroke-dasharray', '4,5')
    })
    // Vertical grid every 6 laps
    const lapRange = maxLap - minLap
    const lapStep  = lapRange <= 30 ? 3 : lapRange <= 50 ? 6 : 9
    d3.range(Math.ceil(minLap / lapStep) * lapStep, maxLap, lapStep).forEach(v => {
      g.append('line').attr('x1', xS(v)).attr('x2', xS(v)).attr('y1', 0).attr('y2', iH)
        .attr('stroke', 'rgba(255,255,255,0.04)')
    })

    // ── Y Axis ────────────────────────────────────────────────────────────
    g.append('g')
      .call(d3.axisLeft(yS).tickValues(yTickVals2).tickFormat(d => `${+d}`).tickSize(5))
      .call(sel => {
        sel.selectAll('text').attr('fill', 'rgba(255,255,255,0.5)').attr('font-size', 10).attr('font-family', 'monospace')
        sel.selectAll('line').attr('stroke', 'rgba(255,255,255,0.15)')
        sel.select('.domain').attr('stroke', 'rgba(255,255,255,0.2)')
      })

    svg.append('text').attr('transform', 'rotate(-90)')
      .attr('x', -(mT + iH / 2)).attr('y', 14)
      .attr('text-anchor', 'middle').attr('fill', 'rgba(255,255,255,0.4)')
      .attr('font-size', 10).attr('font-family', 'sans-serif')
      .text('Laptime (s)')

    // ── X Axis ────────────────────────────────────────────────────────────
    g.append('g').attr('transform', `translate(0,${iH})`)
      .call(
        d3.axisBottom(xS)
          .ticks(Math.min(Math.floor(lapRange / lapStep), 12))
          .tickFormat(d3.format('d'))
          .tickSize(5)
      )
      .call(sel => {
        sel.selectAll('text').attr('fill', 'rgba(255,255,255,0.5)').attr('font-size', 10).attr('font-family', 'monospace')
        sel.selectAll('line').attr('stroke', 'rgba(255,255,255,0.15)')
        sel.select('.domain').attr('stroke', 'rgba(255,255,255,0.2)')
      })

    g.append('text').attr('x', iW / 2).attr('y', iH + 40)
      .attr('text-anchor', 'middle').attr('fill', 'rgba(255,255,255,0.35)')
      .attr('font-size', 11).text('Lap')

    // ── Lines per driver ──────────────────────────────────────────────────
    const lineGen = d3.line<{ lap: number; t: number }>()
      .x(p => xS(p.lap)).y(p => yS(p.t))
      .curve(d3.curveBasis)

    stats.forEach(s => {
      if (!s.smoothed.length) return
      // Shadow for depth
      g.append('path').datum(s.smoothed).attr('fill', 'none')
        .attr('stroke', '#000').attr('stroke-width', 4).attr('opacity', 0.15)
        .attr('d', lineGen as any)
      g.append('path').datum(s.smoothed).attr('fill', 'none')
        .attr('stroke', s.color).attr('stroke-width', 2.0).attr('opacity', 0.9)
        .attr('d', lineGen as any)
    })

    // End labels (right side)
    const endPts = stats
      .map(s => ({ code: s.code, color: s.color, last: s.smoothed[s.smoothed.length - 1] }))
      .filter(d => d.last)
      .sort((a, b) => (a.last?.t ?? 0) - (b.last?.t ?? 0))

    endPts.forEach((d, i) => {
      if (!d.last) return
      const lx = xS(d.last.lap) + 6
      const ly = yS(d.last.t) + 3.5
      g.append('text').attr('x', lx).attr('y', ly)
        .attr('fill', d.color).attr('font-size', 9).attr('font-weight', 'bold').attr('font-family', 'monospace')
        .text(d.code)
    })
  }

  useEffect(() => {
    draw()
    roRef.current?.disconnect()
    roRef.current = new ResizeObserver(draw)
    if (ref.current?.parentElement) roRef.current.observe(ref.current.parentElement)
    return () => roRef.current?.disconnect()
  }, [stats])

  return <svg ref={ref} className="w-full"/>
}

// ── Dot strip (distribution) ───────────────────────────────────────────────
function StripChart({ stats }: { stats: DriverStats[] }) {
  const ref   = useRef<SVGSVGElement>(null)
  const roRef = useRef<ResizeObserver | null>(null)

  function draw() {
    if (!ref.current || !stats.length) return
    const svg = d3.select(ref.current)
    svg.selectAll('*').remove()
    const W = ref.current.parentElement!.clientWidth || 900
    const N = stats.length
    const m = { t: 8, r: 24, b: 36, l: 64 }
    const iW = W - m.l - m.r, iH = 110
    const colW = iW / N
    svg.attr('width', W).attr('height', iH + m.t + m.b)
    const g = svg.append('g').attr('transform', `translate(${m.l},${m.t})`)

    const allTimes = stats.flatMap(s => s.laps.map(l => l.time))
    const dataMin  = d3.min(allTimes)!
    const dataMax  = d3.max(allTimes)!
    const yLo = Math.min(Y_MIN, Math.floor(dataMin) - 0.5)
    const yHi = Math.max(Y_MAX, Math.ceil(dataMax)  + 0.5)
    // 95 at bottom, 102 at top — same convention
    const yS = d3.scaleLinear().domain([yLo, yHi]).range([iH, 0])

    const yTicks3: number[] = []
    for (let v = Math.ceil(yLo); v <= Math.floor(yHi); v++) yTicks3.push(v)

    g.append('g')
      .call(d3.axisLeft(yS).tickValues(yTicks3).tickFormat(d => `${+d}`).tickSize(4))
      .call(sel => {
        sel.selectAll('text').attr('fill','rgba(255,255,255,0.4)').attr('font-size',8).attr('font-family','monospace')
        sel.selectAll('line').attr('stroke','rgba(255,255,255,0.1)')
        sel.select('.domain').attr('stroke','rgba(255,255,255,0.1)')
      })

    yTicks3.forEach(v => {
      g.append('line').attr('x1',0).attr('x2',iW).attr('y1',yS(v)).attr('y2',yS(v))
        .attr('stroke','rgba(255,255,255,0.05)').attr('stroke-dasharray','3,5')
    })

    stats.forEach((s, i) => {
      const cx = i * colW + colW / 2
      s.laps.forEach((l, j) => {
        const jitter = (((i * 1234 + j * 7919) % 100) / 100 - 0.5) * colW * 0.44
        g.append('circle').attr('cx', cx + jitter).attr('cy', yS(l.time)).attr('r', 2)
          .attr('fill', s.color).attr('opacity', 0.32)
      })
      // Mean marker
      g.append('circle').attr('cx', cx).attr('cy', yS(s.mean)).attr('r', 5.5)
        .attr('fill', s.color).attr('stroke', '#fff').attr('stroke-width', 1.8).attr('opacity', 1)
      // Median line
      g.append('line').attr('x1', cx - colW*0.3).attr('x2', cx + colW*0.3)
        .attr('y1', yS(s.median)).attr('y2', yS(s.median))
        .attr('stroke', s.color).attr('stroke-width', 2.5).attr('opacity', 0.9)
    })
  }

  useEffect(() => {
    draw()
    roRef.current?.disconnect()
    roRef.current = new ResizeObserver(draw)
    if (ref.current?.parentElement) roRef.current.observe(ref.current.parentElement)
    return () => roRef.current?.disconnect()
  }, [stats])

  return <svg ref={ref} className="w-full"/>
}

// ── Constructor Bars ───────────────────────────────────────────────────────
function ConstructorBars({ stats }: { stats: DriverStats[] }) {
  const byTeam = new Map<string, DriverStats[]>()
  stats.forEach(s => { const a = byTeam.get(s.team) ?? []; a.push(s); byTeam.set(s.team, a) })
  const teams = Array.from(byTeam.entries())
    .map(([team, drivers]) => ({ team, color: drivers[0].color, drivers, avg: d3.mean(drivers, d => d.mean)! }))
    .sort((a, b) => a.avg - b.avg)
  const base = teams[0]?.avg ?? 0
  const maxD = (teams[teams.length-1]?.avg ?? base) - base || 1
  const cScale = d3.scaleLinear<string>().domain([0, maxD]).range(['#4ade80','#ef4444']).interpolate(d3.interpolateRgb)

  return (
    <div className="space-y-2">
      {teams.map((t, i) => {
        const delta = t.avg - base
        return (
          <div key={t.team} className="flex items-center gap-3">
            <div className="w-5 text-xs font-mono text-white/30 text-right shrink-0">{i+1}</div>
            <div className="w-32 shrink-0">
              <div className="font-bold text-sm" style={{color:t.color}}>{t.team}</div>
              <div className="text-[9px] font-mono text-white/35">{t.drivers.map(d=>d.code).join(' · ')}</div>
            </div>
            <div className="flex-1 h-7 rounded-lg overflow-hidden bg-white/5 relative">
              <div className="h-full rounded-lg" style={{
                width:`${Math.max(3, 100 - (delta/maxD)*88)}%`,
                background:`linear-gradient(90deg,${t.color}cc,${t.color}66)`
              }}/>
              <div className="absolute inset-0 flex items-center px-2.5">
                <span className="font-mono font-bold text-xs text-white/90">{fmtSec(t.avg)}</span>
              </div>
            </div>
            <div className="w-20 text-right shrink-0 font-mono font-bold text-xs" style={{color:cScale(delta)}}>
              {delta < 0.01 ? '—' : `+${delta.toFixed(3)}s`}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────
function RacePaceInner() {
  const sp = useSearchParams()
  
  // Read URL params — supports ?y=2026&e=Chinese+Grand+Prix&autoload=1
  const urlYear  = sp.get('y') ? +sp.get('y')! : 2026
  const urlEvent = sp.get('e') ? decodeURIComponent(sp.get('e')!) : 'Chinese Grand Prix'
  const autoLoad = sp.get('autoload') === '1'

  const [year,    setYear]    = useState(urlYear)
  const [event,   setEvent]   = useState(() => {
    // Match partial event name to full event in our list
    const evts = EVENTS_BY_YEAR[urlYear] ?? []
    return evts.find(ev => ev === urlEvent || ev.toLowerCase().includes(urlEvent.toLowerCase()) || ev.replace(' Grand Prix','').toLowerCase() === urlEvent.toLowerCase()) ?? urlEvent
  })
  const [stats,   setStats]   = useState<DriverStats[]>([])
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const [ran,     setRan]     = useState(false)

  const raceEvents = (EVENTS_BY_YEAR[year] ?? []).filter(e => !e.startsWith('Pre-Season'))

  const load = useCallback(async () => {
    if (!event) return
    setLoading(true); setError(null); setStats([])
    const { stats: s, error: e } = await fetchAllRaceLaps(year, event)
    if (e) setError(e)
    else setStats(s)
    setLoading(false)
    setRan(true)
  }, [year, event])

  // Auto-run when ?autoload=1 is in URL (e.g. from main dashboard button)
  useEffect(() => {
    if (autoLoad && !ran) { load() }
  }, [autoLoad, ran])

  const fastest = stats[0]
  const slowest = stats[stats.length - 1]
  const spread  = stats.length > 1 ? slowest.mean - fastest.mean : 0

  return (
    <div className="container mx-auto max-w-screen-2xl px-2 sm:px-4 py-4">

      {/* Header */}
      <div className="rounded-2xl border border-white/[0.08] p-4 sm:p-6 mb-4"
        style={{background:'rgba(255,255,255,0.03)',backdropFilter:'blur(12px)'}}>
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-primary flex items-center gap-3">
              <TrendingUp size={26}/> Race Pace
            </h1>
            <p className="text-sm text-base-content/40 mt-1">
              Y-axis in <strong className="text-primary">seconds</strong> · <strong className="text-primary">95s = bottom</strong>, 102s = top · SC/VSC & pit laps excluded
            </p>
          </div>
          <div className="flex flex-wrap gap-2 items-end">
            <div>
              <label className="block text-[10px] text-base-content/40 uppercase font-bold mb-1">Year</label>
              <select value={year}
                onChange={e => { const y = +e.target.value; setYear(y); setEvent((EVENTS_BY_YEAR[y]?.find(ev => !ev.startsWith('Pre-Season'))) ?? '') }}
                className="select select-bordered select-sm select-primary bg-base-200/50 w-24">
                {AVAILABLE_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-base-content/40 uppercase font-bold mb-1">Race Event</label>
              <select value={event} onChange={e => setEvent(e.target.value)}
                className="select select-bordered select-sm select-primary bg-base-200/50 w-64">
                {raceEvents.map(ev => <option key={ev} value={ev}>{ev}</option>)}
              </select>
            </div>
            <button onClick={load} disabled={loading} className="btn btn-primary btn-sm gap-2 font-bold">
              {loading ? <RefreshCw size={13} className="animate-spin"/> : <TrendingUp size={13}/>}
              {loading ? 'Loading…' : 'Load Race Pace'}
            </button>
          </div>
        </div>
      </div>

      {error && <div className="alert alert-warning rounded-xl mb-4 text-sm whitespace-pre-wrap"><span>{error}</span></div>}

      {loading && (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <RefreshCw size={32} className="animate-spin text-primary"/>
          <div className="text-base-content/40">Loading race laps for all drivers…</div>
        </div>
      )}

      {!loading && stats.length > 0 && (<>

        {/* Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          {[
            { label:'Fastest Mean', val: fmtSecF(fastest.mean), sub: fastest.code, color: fastest.color },
            { label:'Slowest Mean', val: fmtSecF(slowest.mean), sub: slowest.code, color: slowest.color },
            { label:'Field Spread', val: `${spread.toFixed(3)}s`, sub:`${fastest.code} → ${slowest.code}`, color:'#a78bfa' },
            { label:'Drivers',      val: String(stats.length),    sub:'with ≥4 clean laps',                color:'#60a5fa' },
          ].map(item => (
            <div key={item.label} className="rounded-xl p-3.5 border border-white/[0.06]"
              style={{background:'rgba(255,255,255,0.03)'}}>
              <div className="text-[9px] text-base-content/35 font-bold uppercase tracking-widest">{item.label}</div>
              <div className="font-mono font-black text-xl mt-1" style={{color:item.color}}>{item.val}</div>
              <div className="text-[10px] text-base-content/30 mt-0.5 font-mono">{item.sub}</div>
            </div>
          ))}
        </div>

        {/* Box Plots */}
        <div className="rounded-2xl border border-white/[0.06] p-4 sm:p-5 mb-4 overflow-x-auto"
          style={{background:'rgba(255,255,255,0.025)',backdropFilter:'blur(8px)'}}>
          <div className="mb-2">
            <h2 className="font-black text-primary uppercase tracking-widest text-sm">Box Plot — Race Pace</h2>
            <p className="text-[10px] text-base-content/35 mt-0.5">
              Y-axis: seconds (95s bottom → 102s top) · Solid = Median · Dashed = Mean · Hover for full stats
            </p>
          </div>
          <BoxPlotChart stats={stats} year={year} event={event}/>
        </div>

        {/* Driver cards */}
        <div className="rounded-2xl border border-white/[0.06] p-4 sm:p-5 mb-4"
          style={{background:'rgba(255,255,255,0.025)',backdropFilter:'blur(8px)'}}>
          <h2 className="font-black text-primary uppercase tracking-widest text-sm mb-3">Driver Rankings</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-2">
            {stats.map((s, i) => (
              <div key={s.code} className="rounded-xl border overflow-hidden"
                style={{borderColor:`${s.color}30`,background:`linear-gradient(135deg,${s.color}12 0%,rgba(5,10,25,0.9) 60%)`}}>
                <div className="h-0.5" style={{background:s.color}}/>
                <div className="p-2 flex items-start gap-2">
                  <div className="relative shrink-0">
                    {s.url ? (
                      <img src={`/api/driver-img?url=${encodeURIComponent(s.url)}`} alt={s.code}
                        className="w-9 h-9 rounded-full object-cover object-top"
                        style={{border:`2px solid ${s.color}66`}}
                        onError={e=>{(e.target as HTMLImageElement).style.display='none'}}/>
                    ) : (
                      <div className="w-9 h-9 rounded-full flex items-center justify-center font-black text-sm"
                        style={{background:`${s.color}25`,color:s.color,border:`2px solid ${s.color}55`}}>{s.code[0]}</div>
                    )}
                    <div className="absolute -top-1 -left-1 w-4 h-4 rounded-full flex items-center justify-center text-[7px] font-black shadow"
                      style={{background:i<3?'#fbbf24':i<10?s.color:'rgba(255,255,255,0.15)',color:i<8?'#000':'#fff'}}>
                      {i+1}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <div className="font-mono font-black text-xs" style={{color:s.color}}>{s.code}</div>
                    <div className="text-[8px] text-white/35 truncate">{s.team.split(' ')[0]}</div>
                    <div className="font-mono font-bold text-[11px] text-white/80 mt-0.5">{fmtSec(s.mean)}</div>
                    <div className="font-mono text-[9px]" style={{color:i===0?'#4ade80':'rgba(248,113,113,0.8)'}}>
                      {i===0?'FASTEST':`+${(s.mean-fastest.mean).toFixed(3)}s`}
                    </div>
                    <div className="font-mono text-[8px] text-white/30 mt-0.5">{s.tyreStrategy}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Dot strip distribution */}
        <div className="rounded-2xl border border-white/[0.06] p-4 sm:p-5 mb-4 overflow-x-auto"
          style={{background:'rgba(255,255,255,0.025)',backdropFilter:'blur(8px)'}}>
          <h2 className="font-black text-primary uppercase tracking-widest text-sm mb-1">Lap Distribution Strip</h2>
          <p className="text-[10px] text-base-content/35 mb-3">Each dot = 1 lap · Large dot = mean · Dash = median · Y-axis 95s→102s</p>
          <StripChart stats={stats}/>
        </div>

        {/* Smoothed trace */}
        <div className="rounded-2xl border border-white/[0.06] p-4 sm:p-5 mb-4"
          style={{background:'rgba(255,255,255,0.025)',backdropFilter:'blur(8px)'}}>
          <h2 className="font-black text-primary uppercase tracking-widest text-sm mb-1">Smoothed Lap-by-Lap Race Pace</h2>
          <p className="text-[10px] text-base-content/35 mb-3">Rolling window-3 smoothed · Y-axis in seconds (95→102)</p>
          <RaceTraceChart stats={stats}/>
        </div>

        {/* Constructor */}
        <div className="rounded-2xl border border-white/[0.06] p-4 sm:p-5 mb-4"
          style={{background:'rgba(255,255,255,0.025)',backdropFilter:'blur(8px)'}}>
          <h2 className="font-black text-primary uppercase tracking-widest text-sm mb-4">Constructor Race Pace</h2>
          <ConstructorBars stats={stats}/>
        </div>

        {/* Table */}
        <div className="rounded-2xl border border-white/[0.06] mb-4 overflow-hidden"
          style={{background:'rgba(255,255,255,0.025)',backdropFilter:'blur(8px)'}}>
          <div className="px-5 py-3 border-b border-white/[0.06]">
            <h2 className="font-black text-primary uppercase tracking-widest text-sm">Full Statistics (seconds)</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="table table-sm w-full font-mono">
              <thead><tr className="text-primary/60 text-[10px] bg-base-300/20">
                <th>P</th><th>Code</th><th>Driver</th><th>Team</th>
                <th>Mean (s)</th><th>Median (s)</th><th>Q1 (s)</th><th>Q3 (s)</th>
                <th>IQR (s)</th><th>Laps</th><th>Tyres</th><th>Δ Best</th>
              </tr></thead>
              <tbody>
                {stats.map((s,i) => (
                  <tr key={s.code} className="border-white/[0.04] hover:bg-white/[0.03]">
                    <td className="text-white/30">{i+1}</td>
                    <td className="font-black" style={{color:s.color}}>{s.code}</td>
                    <td className="text-white/60 text-[10px]">{s.fn} {s.ln}</td>
                    <td className="text-white/40 text-[9px]">{s.team}</td>
                    <td className="font-bold text-white/90">{s.mean.toFixed(3)}</td>
                    <td className="text-white/60">{s.median.toFixed(3)}</td>
                    <td className="text-white/40">{s.q1.toFixed(3)}</td>
                    <td className="text-white/40">{s.q3.toFixed(3)}</td>
                    <td className="text-white/40">{s.iqr.toFixed(3)}</td>
                    <td className="text-white/40">{s.laps.length}</td>
                    <td className="text-white/50">{s.tyreStrategy}</td>
                    <td style={{color:i===0?'#4ade80':'#f87171'}}>
                      {i===0?'—':`+${(s.mean-fastest.mean).toFixed(3)}s`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </>)}

      {!loading && !stats.length && !error && (
        <div className="flex flex-col items-center justify-center py-20 gap-6">
          <div className="text-6xl opacity-30">🏎️</div>
          <div className="text-center">
            <p className="text-xl font-black text-base-content/50">Ready to analyse race pace</p>
            <p className="text-sm text-base-content/25 mt-1">{year} {event}</p>
          </div>
          <button onClick={load}
            className="btn btn-primary btn-lg gap-3 font-black text-lg shadow-2xl"
            style={{boxShadow:'0 0 32px hsl(var(--p)/0.4)', minWidth: 240}}>
            <TrendingUp size={22}/> Run Race Pace ▶
          </button>
          <p className="text-xs text-base-content/25">Fetches all {raceEvents.length} driver lap times in parallel</p>
        </div>
      )}
    </div>
  )
}

export default function RacePacePage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-24">
        <span className="loading loading-spinner loading-lg text-primary"/>
      </div>
    }>
      <RacePaceInner/>
    </Suspense>
  )
}
