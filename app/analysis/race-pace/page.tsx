'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import * as d3 from 'd3'
import { CDN_FALLBACKS, AVAILABLE_YEARS, EVENTS_BY_YEAR, TEAM_COLORS } from '@/lib/constants'
import { RefreshCw, TrendingUp } from 'lucide-react'

const enc = (s: string) => encodeURIComponent(s)

// ── types ──────────────────────────────────────────────────────────────────
interface LapRow { lap: number; time: number; compound: string; stint: number; pos: number }

interface DriverStats {
  code: string; team: string; color: string; url: string; fn: string; ln: string
  laps: LapRow[]
  mean: number; median: number; q1: number; q3: number; min: number; max: number
  iqr: number; stddev: number
  smoothed: { lap: number; t: number }[]
}

// ── helpers ────────────────────────────────────────────────────────────────
// Show times in seconds, e.g. 96.472 or 102.1
const fmtSec = (t: number) => t.toFixed(3) + 's'
const fmtSecShort = (t: number) => t.toFixed(1)

async function fetchAllRaceLaps(year: number, event: string): Promise<{ stats: DriverStats[], error?: string }> {
  const base = CDN_FALLBACKS[0]
  const path = `${year}@main/${enc(event)}/Race`

  let driversData: any
  try {
    const r = await fetch(`${base}/${path}/drivers.json?_=${Date.now()}`)
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    driversData = await r.json()
  } catch (e: any) {
    return { stats: [], error: `Could not load drivers for "${event}" Race ${year}. Data published ~30 min after session ends.` }
  }

  const driverList: { driver: string; team: string; tc: string; fn: string; ln: string; url: string }[] = driversData.drivers ?? []
  const colorMap: Record<string, string> = {}
  const infoMap: Record<string, { team: string; color: string; fn: string; ln: string; url: string }> = {}
  driverList.forEach(d => {
    const col = d.tc ? `#${d.tc}` : (TEAM_COLORS[d.team] ?? '#888')
    colorMap[d.driver] = col
    infoMap[d.driver] = { team: d.team, color: col, fn: d.fn ?? '', ln: d.ln ?? '', url: d.url ?? '' }
  })

  // Fetch all drivers in parallel
  const results = await Promise.allSettled(
    driverList.map(async d => {
      const r = await fetch(`${base}/${path}/${d.driver}/laptimes.json?_=${Date.now()}`)
      if (!r.ok) return null
      const raw = await r.json()
      return { code: d.driver, raw }
    })
  )

  const stats: DriverStats[] = []

  results.forEach(res => {
    if (res.status !== 'fulfilled' || !res.value) return
    const { code, raw } = res.value
    const info = infoMap[code]
    const len = raw.lap?.length ?? 0
    const n = (v: any): number | null => (v === 'None' || v == null) ? null : +v
    const b = (v: any) => v === true || v === 'True'

    const laps: LapRow[] = []
    for (let i = 0; i < len; i++) {
      const t = n(raw.time?.[i])
      if (t === null || t <= 0) continue
      if (b(raw.del?.[i])) continue
      if ((raw.lap?.[i] ?? 0) <= 1) continue  // skip lap 1

      // Skip SC/VSC laps (status contains 4,5,6)
      const st = String(raw.status?.[i] ?? '1')
      if (/[456]/.test(st)) continue

      laps.push({
        lap:      raw.lap[i],
        time:     t,                          // already in SECONDS from the API
        compound: String(raw.compound?.[i] ?? 'UNKNOWN').toUpperCase(),
        stint:    raw.stint?.[i] ?? 1,
        pos:      n(raw.pos?.[i]) ?? 0,
      })
    }

    if (laps.length < 4) return

    const times = laps.map(l => l.time).sort(d3.ascending)
    const median  = d3.median(times)!
    // Remove pit laps: > 1.12× median
    const clean = laps.filter(l => l.time <= median * 1.12)
    if (clean.length < 4) return

    const cleanTimes = clean.map(l => l.time).sort(d3.ascending)
    const mean    = d3.mean(cleanTimes)!
    const q1      = d3.quantile(cleanTimes, 0.25)!
    const q3      = d3.quantile(cleanTimes, 0.75)!
    const iqr     = q3 - q1
    const stddev  = d3.deviation(cleanTimes) ?? 0
    const whiskerMin = Math.max(cleanTimes[0],  q1 - 1.5 * iqr)
    const whiskerMax = Math.min(cleanTimes[cleanTimes.length - 1], q3 + 1.5 * iqr)

    // Rolling-3 smoothed trace
    const byLap = [...clean].sort((a, b) => a.lap - b.lap)
    const smoothed: { lap: number; t: number }[] = []
    for (let i = 1; i < byLap.length - 1; i++) {
      smoothed.push({ lap: byLap[i].lap, t: (byLap[i-1].time + byLap[i].time + byLap[i+1].time) / 3 })
    }

    stats.push({
      code, ...info, laps: clean,
      mean, median, q1, q3, iqr, stddev,
      min: whiskerMin, max: whiskerMax,
      smoothed,
    })
  })

  stats.sort((a, b) => a.mean - b.mean)
  return { stats }
}

// ── Box-Plot ───────────────────────────────────────────────────────────────
function BoxPlotChart({ stats, year, event }: { stats: DriverStats[]; year: number; event: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const tipRef       = useRef<HTMLDivElement>(null)
  const roRef        = useRef<ResizeObserver | null>(null)

  const draw = useCallback(() => {
    if (!containerRef.current || !stats.length) return
    containerRef.current.innerHTML = ''

    const W   = containerRef.current.clientWidth || 900
    const N   = stats.length
    const boxW = Math.max(20, Math.min(48, (W - 80) / N - 10))
    const mL  = 60, mR = 24, mT = 60, mB = 84
    const iW  = N * (boxW + 12) + 40
    const iH  = 340
    const svgW = Math.max(W, iW + mL + mR)

    const svg = d3.create('svg')
      .attr('width', svgW).attr('height', iH + mT + mB)
      .style('overflow', 'visible')

    const defs = svg.append('defs')
    // Subtle grid gradient
    const bg = defs.append('linearGradient').attr('id','chartBg').attr('x1','0%').attr('y1','0%').attr('x2','0%').attr('y2','100%')
    bg.append('stop').attr('offset','0%').attr('stop-color','rgba(255,255,255,0.03)')
    bg.append('stop').attr('offset','100%').attr('stop-color','rgba(0,0,0,0)')

    const g = svg.append('g').attr('transform', `translate(${mL},${mT})`)
    g.append('rect').attr('width', iW).attr('height', iH).attr('fill', 'url(#chartBg)').attr('rx', 6)

    // Y domain — fixed 95s to 102s for consistent comparison across races
    // User can see the full field spread without auto-scaling distortion
    const allVals = stats.flatMap(s => [s.min, s.q1, s.median, s.q3, s.max, ...s.laps.map(l => l.time)])
    const dataMin = d3.min(allVals) ?? 95
    const dataMax = d3.max(allVals) ?? 102
    // Clamp to 95–102 but expand if data goes outside
    const yDomainMin = Math.min(95, dataMin - 0.5)
    const yDomainMax = Math.max(102, dataMax + 0.5)
    const yS = d3.scaleLinear().domain([yDomainMin, yDomainMax]).range([iH, 0])

    // X: band scale
    const xS = d3.scaleBand()
      .domain(stats.map(s => s.code))
      .range([0, iW])
      .paddingInner(0.3)
      .paddingOuter(0.15)
    const bw = xS.bandwidth()

    // Grid
    const yTicks = yS.ticks(8)
    yTicks.forEach(v => {
      g.append('line').attr('x1', 0).attr('x2', iW)
        .attr('y1', yS(v)).attr('y2', yS(v))
        .attr('stroke', 'rgba(255,255,255,0.06)').attr('stroke-dasharray', '4,6')
    })

    // Y axis
    g.append('g').call(
      d3.axisLeft(yS).tickValues(yTicks).tickFormat(d => `${(+d).toFixed(1)}s`)
    ).call(s => {
      s.selectAll('text').attr('fill', 'rgba(255,255,255,0.45)').attr('font-size', 10).attr('font-family', 'monospace')
      s.selectAll('line').attr('stroke', 'rgba(255,255,255,0.1)')
      s.select('.domain').attr('stroke', 'rgba(255,255,255,0.15)')
    })

    // Y axis label
    g.append('text').attr('transform', 'rotate(-90)')
      .attr('x', -iH / 2).attr('y', -48)
      .attr('text-anchor', 'middle').attr('fill', 'rgba(255,255,255,0.3)')
      .attr('font-size', 11).text('Lap Time (seconds)')

    // Baseline: fastest driver mean
    const baseline = stats[0].mean
    g.append('line').attr('x1', 0).attr('x2', iW)
      .attr('y1', yS(baseline)).attr('y2', yS(baseline))
      .attr('stroke', stats[0].color).attr('stroke-width', 1)
      .attr('stroke-dasharray', '8,4').attr('stroke-opacity', 0.5)
    g.append('text').attr('x', iW + 4).attr('y', yS(baseline) + 3.5)
      .attr('fill', stats[0].color).attr('font-size', 8).attr('opacity', 0.7)
      .text(stats[0].code)

    stats.forEach((s, i) => {
      const x0  = xS(s.code) ?? 0
      const cx  = x0 + bw / 2
      const col = s.color
      const delta = s.mean - baseline

      // Outliers (beyond 1.5 IQR)
      s.laps.forEach(l => {
        const lim1 = s.q1 - 1.5 * s.iqr, lim2 = s.q3 + 1.5 * s.iqr
        if (l.time < lim1 || l.time > lim2) {
          g.append('circle').attr('cx', cx).attr('cy', yS(l.time)).attr('r', 3)
            .attr('fill', 'none').attr('stroke', col).attr('stroke-width', 1.5).attr('opacity', 0.6)
        }
      })

      // Whiskers
      ;[[s.min, s.q1], [s.q3, s.max]].forEach(([lo, hi]) => {
        g.append('line').attr('x1', cx).attr('x2', cx)
          .attr('y1', yS(lo)).attr('y2', yS(hi))
          .attr('stroke', col).attr('stroke-width', 1.5).attr('opacity', 0.6)
        // Whisker cap
        g.append('line').attr('x1', cx - bw*0.3).attr('x2', cx + bw*0.3)
          .attr('y1', yS(lo)).attr('y2', yS(lo))
          .attr('stroke', col).attr('stroke-width', 1.2).attr('opacity', 0.5)
        g.append('line').attr('x1', cx - bw*0.3).attr('x2', cx + bw*0.3)
          .attr('y1', yS(hi)).attr('y2', yS(hi))
          .attr('stroke', col).attr('stroke-width', 1.2).attr('opacity', 0.5)
      })

      // IQR Box — filled with team color
      const boxH = Math.max(2, yS(s.q1) - yS(s.q3))
      g.append('rect').attr('x', x0).attr('width', bw)
        .attr('y', yS(s.q3)).attr('height', boxH).attr('rx', 3)
        .attr('fill', col).attr('fill-opacity', 0.18)
        .attr('stroke', col).attr('stroke-width', 2).attr('stroke-opacity', 0.9)
        .attr('cursor', 'pointer')
        .on('mouseover', function(e) {
          d3.select(this).attr('fill-opacity', 0.4)
          if (!tipRef.current) return
          const rect = containerRef.current!.getBoundingClientRect()
          tipRef.current.style.display = 'block'
          tipRef.current.style.left = `${e.clientX - rect.left + 12}px`
          tipRef.current.style.top  = `${e.clientY - rect.top - 140}px`
          tipRef.current.innerHTML = `
            <div style="color:${col}" class="font-mono font-black text-sm mb-1">${s.fn} ${s.ln}</div>
            <div class="text-[10px] text-white/50 mb-2 font-bold">${s.team}</div>
            <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] font-mono">
              <span class="text-white/40">Mean</span><span class="font-bold text-white">${fmtSec(s.mean)}</span>
              <span class="text-white/40">Median</span><span class="text-white/80">${fmtSec(s.median)}</span>
              <span class="text-white/40">Q1 (25%)</span><span class="text-white/60">${fmtSec(s.q1)}</span>
              <span class="text-white/40">Q3 (75%)</span><span class="text-white/60">${fmtSec(s.q3)}</span>
              <span class="text-white/40">IQR</span><span class="text-white/60">${fmtSec(s.iqr)}</span>
              <span class="text-white/40">Δ baseline</span>
              <span style="color:${delta<=0?'#4ade80':'#f87171'}">${delta<=0?'—':'+'+delta.toFixed(3)+'s'}</span>
              <span class="text-white/40">Clean laps</span><span class="text-white/60">${s.laps.length}</span>
            </div>
          `
        })
        .on('mouseout', function() {
          d3.select(this).attr('fill-opacity', 0.18)
          if (tipRef.current) tipRef.current.style.display = 'none'
        })

      // Median (solid thick)
      g.append('line').attr('x1', x0).attr('x2', x0 + bw)
        .attr('y1', yS(s.median)).attr('y2', yS(s.median))
        .attr('stroke', col).attr('stroke-width', 3).attr('opacity', 1)

      // Mean (dashed)
      g.append('line').attr('x1', x0).attr('x2', x0 + bw)
        .attr('y1', yS(s.mean)).attr('y2', yS(s.mean))
        .attr('stroke', '#fff').attr('stroke-width', 1.5).attr('stroke-dasharray', '3,2').attr('opacity', 0.55)

      // X-axis labels group
      const lb = g.append('g').attr('transform', `translate(${cx},${iH + 8})`)
      lb.append('text').attr('text-anchor', 'middle').attr('fill', col)
        .attr('font-size', 11).attr('font-weight', '900').attr('font-family', 'monospace')
        .text(s.code)
      lb.append('text').attr('text-anchor', 'middle').attr('fill', 'rgba(255,255,255,0.6)')
        .attr('font-size', 9).attr('font-family', 'monospace').attr('y', 14)
        .text(fmtSecShort(s.mean) + 's')
      lb.append('text').attr('text-anchor', 'middle')
        .attr('fill', delta <= 0.001 ? '#4ade80' : 'rgba(248,113,113,0.9)')
        .attr('font-size', 8.5).attr('font-family', 'monospace').attr('y', 26)
        .text(delta <= 0.001 ? '+0.000s' : `+${delta.toFixed(3)}s`)
    })

    // Title
    svg.append('text').attr('x', svgW / 2).attr('y', 20)
      .attr('text-anchor', 'middle').attr('fill', 'rgba(255,255,255,0.85)')
      .attr('font-size', 15).attr('font-weight', '900')
      .text(`${year} ${event} — Race Pace`)
    svg.append('text').attr('x', svgW / 2).attr('y', 38)
      .attr('text-anchor', 'middle').attr('fill', 'rgba(255,255,255,0.3)')
      .attr('font-size', 10)
      .text('Global Race Pace (Drivers sorted by mean lap time in seconds) · SC/VSC & pit laps excluded')

    // Legend
    const leg = svg.append('g').attr('transform', `translate(${mL + 4},${iH + mT + 52})`)
    leg.append('line').attr('x1',0).attr('x2',20).attr('y1',7).attr('y2',7).attr('stroke','rgba(255,255,255,0.6)').attr('stroke-width',3)
    leg.append('text').attr('x',24).attr('y',11).attr('fill','rgba(255,255,255,0.5)').attr('font-size',9).text('Median')
    leg.append('line').attr('x1',80).attr('x2',100).attr('y1',7).attr('y2',7).attr('stroke','rgba(255,255,255,0.5)').attr('stroke-width',1.5).attr('stroke-dasharray','3,2')
    leg.append('text').attr('x',104).attr('y',11).attr('fill','rgba(255,255,255,0.5)').attr('font-size',9).text('Mean')
    leg.append('rect').attr('x',148).attr('y',2).attr('width',12).attr('height',10).attr('rx',2).attr('fill','rgba(255,255,255,0.12)').attr('stroke','rgba(255,255,255,0.5)').attr('stroke-width',1.5)
    leg.append('text').attr('x',164).attr('y',11).attr('fill','rgba(255,255,255,0.5)').attr('font-size',9).text('IQR box (50% of laps)')
    leg.append('circle').attr('cx',296).attr('cy',7).attr('r',3.5).attr('fill','none').attr('stroke','rgba(255,255,255,0.5)').attr('stroke-width',1.5)
    leg.append('text').attr('x',304).attr('y',11).attr('fill','rgba(255,255,255,0.5)').attr('font-size',9).text('Outliers')

    containerRef.current.appendChild(svg.node()!)
  }, [stats, year, event])

  useEffect(() => {
    draw()
    roRef.current?.disconnect()
    roRef.current = new ResizeObserver(draw)
    if (containerRef.current) roRef.current.observe(containerRef.current)
    return () => roRef.current?.disconnect()
  }, [draw])

  return (
    <div className="relative w-full overflow-x-auto">
      <div ref={containerRef} className="w-full" style={{ minWidth: Math.max(640, stats.length * 56) }}/>
      <div ref={tipRef} className="chart-tooltip hidden absolute z-50" style={{ maxWidth: 240, pointerEvents: 'none' }}/>
    </div>
  )
}

// ── Race Trace ─────────────────────────────────────────────────────────────
function RaceTraceChart({ stats }: { stats: DriverStats[] }) {
  const ref = useRef<SVGSVGElement>(null)
  const roRef = useRef<ResizeObserver | null>(null)
  const tipRef = useRef<HTMLDivElement>(null)

  function draw() {
    if (!ref.current || !stats.length) return
    const svg = d3.select(ref.current)
    svg.selectAll('*').remove()
    const W = ref.current.parentElement!.clientWidth || 900
    const m = { t: 16, r: 80, b: 48, l: 64 }
    const iW = W - m.l - m.r, iH = 280
    svg.attr('width', W).attr('height', iH + m.t + m.b)
    const g = svg.append('g').attr('transform', `translate(${m.l},${m.t})`)

    const allPts = stats.flatMap(s => s.smoothed)
    if (!allPts.length) return
    const maxLap = d3.max(allPts, p => p.lap)!
    const minLap = d3.min(allPts, p => p.lap)!
    const dataMinT = d3.min(allPts, p => p.t) ?? 95
    const dataMaxT = d3.max(allPts, p => p.t) ?? 102
    // Fixed Y axis: 95s bottom → 102s top (expand if data goes outside)
    const yDomMin = Math.min(95, dataMinT - 0.5)
    const yDomMax = Math.max(102, dataMaxT + 0.5)

    const xS = d3.scaleLinear().domain([minLap, maxLap]).range([0, iW])
    const yS = d3.scaleLinear().domain([yDomMin, yDomMax]).range([iH, 0])

    // Grid
    yS.ticks(6).forEach(v => {
      g.append('line').attr('x1', 0).attr('x2', iW).attr('y1', yS(v)).attr('y2', yS(v))
        .attr('stroke', 'rgba(255,255,255,0.05)').attr('stroke-dasharray', '4,6')
    })
    xS.ticks(10).forEach(v => {
      g.append('line').attr('x1', xS(v)).attr('x2', xS(v)).attr('y1', 0).attr('y2', iH)
        .attr('stroke', 'rgba(255,255,255,0.03)')
    })

    // Axes
    g.append('g').attr('transform', `translate(0,${iH})`).call(
      d3.axisBottom(xS).ticks(Math.min(maxLap - minLap, 12)).tickFormat(d3.format('d'))
    ).call(s => { s.selectAll('text').attr('fill', 'rgba(255,255,255,0.35)').attr('font-size', 9).attr('font-family', 'monospace'); s.selectAll('line,path').attr('stroke', 'rgba(255,255,255,0.1)') })
    g.append('g').call(
      d3.axisLeft(yS).ticks(6).tickFormat(d => `${(+d).toFixed(1)}s`)
    ).call(s => { s.selectAll('text').attr('fill', 'rgba(255,255,255,0.35)').attr('font-size', 9).attr('font-family', 'monospace'); s.selectAll('line,path').attr('stroke', 'rgba(255,255,255,0.1)') })

    g.append('text').attr('x', iW / 2).attr('y', iH + 40).attr('text-anchor', 'middle').attr('fill', 'rgba(255,255,255,0.2)').attr('font-size', 10).text('Lap')
    g.append('text').attr('transform', 'rotate(-90)').attr('x', -iH / 2).attr('y', -52).attr('text-anchor', 'middle').attr('fill', 'rgba(255,255,255,0.2)').attr('font-size', 10).text('Lap Time (seconds)')

    const line = d3.line<{ lap: number; t: number }>().x(p => xS(p.lap)).y(p => yS(p.t)).curve(d3.curveBasis)

    stats.forEach(s => {
      if (!s.smoothed.length) return
      // Shadow
      g.append('path').datum(s.smoothed).attr('fill', 'none')
        .attr('stroke', '#000').attr('stroke-width', 4).attr('opacity', 0.2)
        .attr('d', line as any)
      // Line
      g.append('path').datum(s.smoothed).attr('fill', 'none')
        .attr('stroke', s.color).attr('stroke-width', 2.2).attr('opacity', 0.9)
        .attr('d', line as any)
      // End label
      const last = s.smoothed[s.smoothed.length - 1]
      if (last) {
        g.append('rect').attr('x', xS(last.lap) + 5).attr('y', yS(last.t) - 7)
          .attr('width', s.code.length * 7 + 4).attr('height', 13).attr('rx', 3)
          .attr('fill', 'rgba(5,10,30,0.85)')
        g.append('text').attr('x', xS(last.lap) + 7).attr('y', yS(last.t) + 3.5)
          .attr('fill', s.color).attr('font-size', 9).attr('font-weight', 'bold').attr('font-family', 'monospace')
          .text(s.code)
      }
    })
  }

  useEffect(() => {
    draw()
    roRef.current?.disconnect()
    roRef.current = new ResizeObserver(draw)
    if (ref.current?.parentElement) roRef.current.observe(ref.current.parentElement)
    return () => roRef.current?.disconnect()
  }, [stats])

  return <div className="relative"><svg ref={ref} className="w-full"/><div ref={tipRef} className="chart-tooltip hidden absolute" style={{ pointerEvents: 'none' }}/></div>
}

// ── Violin / Distribution strip ────────────────────────────────────────────
function DistributionChart({ stats }: { stats: DriverStats[] }) {
  const ref = useRef<SVGSVGElement>(null)
  const roRef = useRef<ResizeObserver | null>(null)

  function draw() {
    if (!ref.current || !stats.length) return
    const svg = d3.select(ref.current)
    svg.selectAll('*').remove()
    const W = ref.current.parentElement!.clientWidth || 900
    const N = stats.length
    const m = { t: 12, r: 24, b: 40, l: 64 }
    const iW = W - m.l - m.r, iH = 120
    const colW = iW / N
    svg.attr('width', W).attr('height', iH + m.t + m.b)
    const g = svg.append('g').attr('transform', `translate(${m.l},${m.t})`)

    const allTimes = stats.flatMap(s => s.laps.map(l => l.time))
    const dataMin2 = d3.min(allTimes) ?? 95
    const dataMax2 = d3.max(allTimes) ?? 102
    const yS = d3.scaleLinear()
      .domain([Math.min(95, dataMin2 - 0.5), Math.max(102, dataMax2 + 0.5)])
      .range([iH, 0])

    g.append('g').call(d3.axisLeft(yS).ticks(4).tickFormat(d => `${(+d).toFixed(1)}s`))
      .call(s => { s.selectAll('text').attr('fill', 'rgba(255,255,255,0.35)').attr('font-size', 8).attr('font-family', 'monospace'); s.selectAll('line,path').attr('stroke', 'rgba(255,255,255,0.08)') })

    stats.forEach((s, i) => {
      const cx = i * colW + colW / 2
      // Strip of dots (jittered)
      const seed = i * 1234
      s.laps.forEach((l, j) => {
        const jitter = (((seed + j * 7919) % 100) / 100 - 0.5) * (colW * 0.4)
        g.append('circle').attr('cx', cx + jitter).attr('cy', yS(l.time)).attr('r', 2)
          .attr('fill', s.color).attr('opacity', 0.35)
      })
      // Mean dot (big)
      g.append('circle').attr('cx', cx).attr('cy', yS(s.mean)).attr('r', 5)
        .attr('fill', s.color).attr('stroke', '#fff').attr('stroke-width', 1.5).attr('opacity', 0.95)

      g.append('text').attr('x', cx).attr('y', iH + 14)
        .attr('text-anchor', 'middle').attr('fill', s.color)
        .attr('font-size', 9).attr('font-family', 'monospace').attr('font-weight', 'bold')
        .text(s.code)
    })
  }

  useEffect(() => {
    draw()
    roRef.current?.disconnect()
    roRef.current = new ResizeObserver(draw)
    if (ref.current?.parentElement) roRef.current.observe(ref.current.parentElement)
    return () => roRef.current?.disconnect()
  }, [stats])

  return <svg ref={ref} className="w-full" style={{ minWidth: Math.max(600, stats.length * 44) }}/>
}

// ── Constructor Bars ──────────────────────────────────────────────────────
function ConstructorBars({ stats }: { stats: DriverStats[] }) {
  const byTeam = new Map<string, DriverStats[]>()
  stats.forEach(s => { const a = byTeam.get(s.team) ?? []; a.push(s); byTeam.set(s.team, a) })
  const teams = Array.from(byTeam.entries())
    .map(([team, drivers]) => ({ team, color: drivers[0].color, drivers, avg: d3.mean(drivers, d => d.mean)! }))
    .sort((a, b) => a.avg - b.avg)
  const base = teams[0]?.avg ?? 0
  const maxDelta = teams[teams.length - 1]?.avg - base || 1
  const colorScale = d3.scaleLinear<string>().domain([0, maxDelta]).range(['#4ade80', '#ef4444']).interpolate(d3.interpolateRgb)

  return (
    <div className="space-y-2.5">
      {teams.map((t, i) => {
        const delta = t.avg - base
        const pct = delta / maxDelta
        return (
          <div key={t.team} className="flex items-center gap-3">
            <div className="w-5 text-xs font-mono text-white/30 text-right shrink-0">{i + 1}</div>
            <div className="w-28 shrink-0">
              <div className="font-bold text-sm" style={{ color: t.color }}>{t.team}</div>
              <div className="text-[9px] text-white/35 font-mono">{t.drivers.map(d => d.code).join(' · ')}</div>
            </div>
            <div className="flex-1 h-7 rounded-lg overflow-hidden bg-white/5 relative">
              <div className="h-full rounded-lg transition-all duration-700"
                style={{ width: `${Math.max(2, 100 - pct * 85)}%`, background: `linear-gradient(90deg, ${t.color}aa, ${t.color}66)` }}/>
              <div className="absolute inset-0 flex items-center px-2.5">
                <span className="font-mono font-bold text-xs text-white/80">{fmtSec(t.avg)}</span>
              </div>
            </div>
            <div className="w-20 text-right shrink-0">
              <span className="font-mono font-bold text-xs" style={{ color: colorScale(delta) }}>
                {delta < 0.01 ? '—' : `+${delta.toFixed(3)}s`}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function RacePacePage() {
  const [year,    setYear]    = useState(2026)
  const [event,   setEvent]   = useState('Chinese Grand Prix')
  const [stats,   setStats]   = useState<DriverStats[]>([])
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  const raceEvents = (EVENTS_BY_YEAR[year] ?? []).filter(e => !e.startsWith('Pre-Season'))

  const load = useCallback(async () => {
    if (!event) return
    setLoading(true); setError(null); setStats([])
    const { stats: s, error: e } = await fetchAllRaceLaps(year, event)
    if (e) setError(e)
    else setStats(s)
    setLoading(false)
  }, [year, event])

  useEffect(() => { load() }, [])

  const fastest  = stats[0]
  const slowest  = stats[stats.length - 1]
  const spread   = stats.length > 1 ? slowest.mean - fastest.mean : 0

  return (
    <div className="container mx-auto max-w-screen-2xl px-2 sm:px-4 py-4">

      {/* ── Header ── */}
      <div className="rounded-2xl border border-white/[0.08] p-4 sm:p-6 mb-4"
        style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(12px)' }}>
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-primary flex items-center gap-3">
              <TrendingUp size={26}/> Race Pace
            </h1>
            <p className="text-sm text-base-content/40 mt-1">
              Times in <strong className="text-primary">seconds</strong> · All laps sorted by mean · SC/VSC & pit laps excluded · Lap 1 excluded
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
                className="select select-bordered select-sm select-primary bg-base-200/50 w-60">
                {raceEvents.map(ev => <option key={ev} value={ev}>{ev}</option>)}
              </select>
            </div>
            <button onClick={load} disabled={loading}
              className="btn btn-primary btn-sm gap-2 font-bold">
              {loading ? <RefreshCw size={13} className="animate-spin"/> : <TrendingUp size={13}/>}
              {loading ? 'Loading…' : 'Load Race Pace'}
            </button>
          </div>
        </div>
      </div>

      {error && <div className="alert alert-warning rounded-xl mb-4 whitespace-pre-wrap text-sm"><span>{error}</span></div>}

      {loading && (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <RefreshCw size={32} className="animate-spin text-primary"/>
          <div className="text-base-content/40">Fetching race laps for all drivers…</div>
          <div className="text-base-content/25 text-sm">This fetches {Math.round((EVENTS_BY_YEAR[year]?.length ?? 20))} drivers in parallel</div>
        </div>
      )}

      {!loading && stats.length > 0 && (<>

        {/* ── Summary Cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          {[
            { label: 'Fastest Mean', val: fmtSec(fastest.mean), sub: fastest.code, color: fastest.color },
            { label: 'Slowest Mean', val: fmtSec(slowest.mean), sub: slowest.code, color: slowest.color },
            { label: 'Field Spread', val: `${spread.toFixed(3)}s`, sub: `${fastest.code} → ${slowest.code}`, color: '#a78bfa' },
            { label: 'Valid Drivers', val: String(stats.length), sub: 'with ≥4 clean laps', color: '#60a5fa' },
          ].map(item => (
            <div key={item.label} className="rounded-xl p-3.5 border border-white/[0.06]"
              style={{ background: 'rgba(255,255,255,0.03)' }}>
              <div className="text-[9px] text-base-content/35 font-bold uppercase tracking-widest">{item.label}</div>
              <div className="font-mono font-black text-xl mt-1" style={{ color: item.color }}>{item.val}</div>
              <div className="text-[10px] text-base-content/30 mt-0.5 font-mono">{item.sub}</div>
            </div>
          ))}
        </div>

        {/* ── Box Plots ── */}
        <div className="rounded-2xl border border-white/[0.06] p-4 sm:p-6 mb-4 overflow-hidden"
          style={{ background: 'rgba(255,255,255,0.025)', backdropFilter: 'blur(8px)' }}>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div>
              <h2 className="font-black text-primary uppercase tracking-widest text-sm">Global Race Pace — Box Plots</h2>
              <p className="text-[10px] text-base-content/35 mt-0.5">Y-axis in seconds · Hover boxes for full statistics</p>
            </div>
          </div>
          <BoxPlotChart stats={stats} year={year} event={event}/>
        </div>

        {/* ── Strip / Distribution ── */}
        <div className="rounded-2xl border border-white/[0.06] p-4 sm:p-6 mb-4 overflow-x-auto"
          style={{ background: 'rgba(255,255,255,0.025)', backdropFilter: 'blur(8px)' }}>
          <h2 className="font-black text-primary uppercase tracking-widest text-sm mb-1">Lap Time Distribution (dot strip)</h2>
          <p className="text-[10px] text-base-content/35 mb-3">Each dot = one lap · Large dot = mean · Y-axis in seconds</p>
          <DistributionChart stats={stats}/>
        </div>

        {/* ── Driver Cards ── */}
        <div className="rounded-2xl border border-white/[0.06] p-4 sm:p-6 mb-4"
          style={{ background: 'rgba(255,255,255,0.025)', backdropFilter: 'blur(8px)' }}>
          <h2 className="font-black text-primary uppercase tracking-widest text-sm mb-3">Driver Rankings</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5">
            {stats.map((s, i) => (
              <div key={s.code} className="rounded-xl border overflow-hidden"
                style={{ borderColor: `${s.color}30`, background: `linear-gradient(135deg, ${s.color}12 0%, rgba(5,10,25,0.9) 60%)` }}>
                <div className="h-0.5" style={{ background: s.color }}/>
                <div className="p-2.5 flex items-start gap-2">
                  <div className="relative shrink-0">
                    {s.url ? (
                      <img src={`/api/driver-img?url=${encodeURIComponent(s.url)}`} alt={s.code}
                        className="w-9 h-9 rounded-full object-cover object-top"
                        style={{ border: `2px solid ${s.color}66` }}
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}/>
                    ) : (
                      <div className="w-9 h-9 rounded-full flex items-center justify-center font-black text-sm"
                        style={{ background: `${s.color}25`, color: s.color, border: `2px solid ${s.color}55` }}>{s.code[0]}</div>
                    )}
                    <div className="absolute -top-1 -left-1 w-4 h-4 rounded-full flex items-center justify-center text-[7px] font-black shadow"
                      style={{ background: i < 3 ? '#fbbf24' : i < 8 ? s.color : 'rgba(255,255,255,0.15)', color: i < 8 ? '#000' : '#fff' }}>
                      {i + 1}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <div className="font-mono font-black text-xs" style={{ color: s.color }}>{s.code}</div>
                    <div className="text-[8px] text-white/35 truncate">{s.team.split(' ')[0]}</div>
                    <div className="font-mono font-bold text-[11px] text-white/80 mt-0.5">{fmtSec(s.mean)}</div>
                    <div className="font-mono text-[9px]" style={{ color: i === 0 ? '#4ade80' : 'rgba(248,113,113,0.8)' }}>
                      {i === 0 ? 'FASTEST' : `+${(s.mean - fastest.mean).toFixed(3)}s`}
                    </div>
                  </div>
                </div>
                <div className="px-2.5 pb-2 grid grid-cols-2 gap-0.5">
                  <div className="text-[7px] text-white/25">Median</div>
                  <div className="text-[8px] font-mono text-white/55 text-right">{fmtSec(s.median)}</div>
                  <div className="text-[7px] text-white/25">IQR</div>
                  <div className="text-[8px] font-mono text-white/55 text-right">{fmtSec(s.iqr)}</div>
                  <div className="text-[7px] text-white/25">Laps</div>
                  <div className="text-[8px] font-mono text-white/55 text-right">{s.laps.length}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Smoothed Trace ── */}
        <div className="rounded-2xl border border-white/[0.06] p-4 sm:p-6 mb-4"
          style={{ background: 'rgba(255,255,255,0.025)', backdropFilter: 'blur(8px)' }}>
          <h2 className="font-black text-primary uppercase tracking-widest text-sm mb-1">Smoothed Lap-by-Lap Race Pace</h2>
          <p className="text-[10px] text-base-content/35 mb-3">Rolling window-3 smoothed · Y-axis in seconds</p>
          <RaceTraceChart stats={stats}/>
        </div>

        {/* ── Constructor Comparison ── */}
        <div className="rounded-2xl border border-white/[0.06] p-4 sm:p-6 mb-4"
          style={{ background: 'rgba(255,255,255,0.025)', backdropFilter: 'blur(8px)' }}>
          <h2 className="font-black text-primary uppercase tracking-widest text-sm mb-4">Constructor Race Pace</h2>
          <ConstructorBars stats={stats}/>
        </div>

        {/* ── Data Table ── */}
        <div className="rounded-2xl border border-white/[0.06] mb-4 overflow-hidden"
          style={{ background: 'rgba(255,255,255,0.025)', backdropFilter: 'blur(8px)' }}>
          <div className="px-5 py-3 border-b border-white/[0.06]">
            <h2 className="font-black text-primary uppercase tracking-widest text-sm">Full Statistics Table (all times in seconds)</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="table table-sm w-full font-mono">
              <thead>
                <tr className="text-primary/60 text-[10px] bg-base-300/20">
                  <th>P</th><th>Code</th><th>Driver</th><th>Team</th>
                  <th>Mean (s)</th><th>Median (s)</th><th>Q1 (s)</th><th>Q3 (s)</th>
                  <th>IQR (s)</th><th>Min (s)</th><th>Max (s)</th><th>Laps</th><th>Δ Best</th>
                </tr>
              </thead>
              <tbody>
                {stats.map((s, i) => (
                  <tr key={s.code} className="border-white/[0.04] hover:bg-white/[0.03] transition-colors">
                    <td className="text-white/30">{i + 1}</td>
                    <td className="font-black" style={{ color: s.color }}>{s.code}</td>
                    <td className="text-white/60 text-[10px]">{s.fn} {s.ln}</td>
                    <td className="text-white/40 text-[9px]">{s.team}</td>
                    <td className="font-bold text-white/90">{s.mean.toFixed(3)}</td>
                    <td className="text-white/60">{s.median.toFixed(3)}</td>
                    <td className="text-white/40">{s.q1.toFixed(3)}</td>
                    <td className="text-white/40">{s.q3.toFixed(3)}</td>
                    <td className="text-white/40">{s.iqr.toFixed(3)}</td>
                    <td className="text-white/30">{s.min.toFixed(3)}</td>
                    <td className="text-white/30">{s.max.toFixed(3)}</td>
                    <td className="text-white/40">{s.laps.length}</td>
                    <td style={{ color: i === 0 ? '#4ade80' : '#f87171' }}>
                      {i === 0 ? '—' : `+${(s.mean - fastest.mean).toFixed(3)}s`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </>)}

      {!loading && !stats.length && !error && (
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-base-content/20">
          <TrendingUp size={56} className="opacity-20"/>
          <p className="text-xl font-black">Select a race event and click Load Race Pace</p>
          <p className="text-sm opacity-60">Requires Race session data from TracingInsights CDN</p>
        </div>
      )}
    </div>
  )
}
