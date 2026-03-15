'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import * as d3 from 'd3'
import { CDN_FALLBACKS, AVAILABLE_YEARS, EVENTS_BY_YEAR, TEAM_COLORS } from '@/lib/constants'
import { RefreshCw, TrendingUp } from 'lucide-react'

// ── helpers ──────────────────────────────────────────────────────────────────
const enc = (s: string) => encodeURIComponent(s)

async function loadRaceLaps(year: number, event: string): Promise<Map<string, LapRow[]>> {
  // 1. Get drivers list
  const base = CDN_FALLBACKS[0]
  const path = `${year}@main/${enc(event)}/Race`
  const dr = await fetch(`${base}/${path}/drivers.json?_=${Date.now()}`).then(r => r.json())
  const drivers: { driver: string; team: string; tc: string; fn: string; ln: string; url: string }[] = dr.drivers

  // 2. Fetch all driver lap times in parallel
  const results = new Map<string, LapRow[]>()
  await Promise.all(drivers.map(async d => {
    try {
      const r = await fetch(`${base}/${path}/${d.driver}/laptimes.json?_=${Date.now()}`)
      if (!r.ok) return
      const raw = await r.json()
      const len = raw.lap?.length ?? 0
      const n = (v: any) => (v === 'None' || v == null) ? null : +v
      const b = (v: any) => v === true || v === 'True'

      const laps: LapRow[] = []
      for (let i = 0; i < len; i++) {
        const t = n(raw.time[i])
        if (t === null || t <= 0) continue
        if (b(raw.del?.[i])) continue          // deleted
        if (raw.lap[i] <= 1) continue          // formation / lap 1 mess

        // Filter Safety Car laps (status 4=SC, 6=VSC, 7=VSC ending)
        const st = String(raw.status?.[i] ?? '1')
        if (st.includes('4') || st.includes('6') || st.includes('5')) continue

        // Filter obvious pit in/out laps (more than 20% slower than median)
        laps.push({
          lap:      raw.lap[i],
          time:     t,
          compound: (raw.compound?.[i] ?? 'UNKNOWN').toUpperCase(),
          stint:    raw.stint?.[i] ?? 1,
          life:     n(raw.life?.[i]) ?? 0,
          pos:      n(raw.pos?.[i]) ?? 0,
          status:   st,
        })
      }

      // Remove pit laps (> 1.15× median)
      if (laps.length > 3) {
        const med = d3.median(laps, l => l.time)!
        results.set(d.driver, laps.filter(l => l.time <= med * 1.15))
      } else {
        results.set(d.driver, laps)
      }
    } catch {}
  }))

  return results
}

interface LapRow { lap: number; time: number; compound: string; stint: number; life: number; pos: number; status: string }
interface DriverStats {
  code: string; team: string; color: string; url: string; fn: string; ln: string
  laps: LapRow[]; mean: number; median: number; q1: number; q3: number
  min: number; max: number; stddev: number
  smoothed: { lap: number; t: number }[]
}

function fmtT(t: number) {
  const m = Math.floor(t / 60), s = (t % 60).toFixed(3).padStart(6, '0')
  return m > 0 ? `${m}:${s}` : (t % 60).toFixed(3)
}

// ── Box Plot Chart ──────────────────────────────────────────────────────────
function BoxPlotChart({ stats, year }: { stats: DriverStats[]; year: number }) {
  const svgRef = useRef<SVGSVGElement>(null)
  const tipRef = useRef<HTMLDivElement>(null)
  const roRef  = useRef<ResizeObserver | null>(null)

  function draw() {
    if (!svgRef.current || !stats.length) return
    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const W   = svgRef.current.parentElement!.clientWidth || 900
    const mT  = 52, mB = 100, mL = 48, mR = 16
    const boxW = Math.max(24, Math.min(44, (W - mL - mR) / stats.length - 6))
    const iW  = stats.length * (boxW + 8) + 20
    const iH  = 280

    svg.attr('width', Math.max(W, iW + mL + mR)).attr('height', iH + mT + mB)
    const g = svg.append('g').attr('transform', `translate(${mL},${mT})`)

    // Y scale — pad a bit
    const allTimes = stats.flatMap(s => [...s.laps.map(l => l.time), s.min, s.max])
    const [yMin, yMax] = d3.extent(allTimes) as [number, number]
    const yPad = (yMax - yMin) * 0.12
    const yS = d3.scaleLinear().domain([yMax + yPad, yMin - yPad]).range([iH, 0])

    // X scale
    const xS = d3.scaleBand()
      .domain(stats.map(s => s.code))
      .range([0, iW])
      .paddingInner(0.25)
      .paddingOuter(0.1)
    const bw = xS.bandwidth()

    // Faint grid
    g.append('g').call(d3.axisLeft(yS).ticks(6).tickSize(-iW).tickFormat(() => ''))
      .selectAll('line').attr('stroke', 'rgba(255,255,255,0.05)').attr('stroke-dasharray', '3,5')
    g.selectAll('.domain').remove()

    // Y axis
    g.append('g').call(
      d3.axisLeft(yS).ticks(6).tickFormat(d => fmtT(+d))
    ).selectAll('text').attr('fill', 'rgba(255,255,255,0.4)').attr('font-size', 9).attr('font-family', 'monospace')

    // Reference line (fastest mean)
    const baseline = stats[0].mean
    g.append('line').attr('x1', 0).attr('x2', iW)
      .attr('y1', yS(baseline)).attr('y2', yS(baseline))
      .attr('stroke', stats[0].color).attr('stroke-opacity', 0.3).attr('stroke-dasharray', '6,4')

    stats.forEach((s, i) => {
      const cx = (xS(s.code) ?? 0) + bw / 2
      const col = s.color
      const delta = s.mean - baseline

      // Outlier dots
      s.laps.forEach(l => {
        if (l.time < s.q1 - 1.5*(s.q3-s.q1) || l.time > s.q3 + 1.5*(s.q3-s.q1)) {
          g.append('circle').attr('cx', cx).attr('cy', yS(l.time)).attr('r', 2.5)
            .attr('fill', 'none').attr('stroke', col).attr('stroke-opacity', 0.6).attr('stroke-width', 1)
        }
      })

      // Whiskers
      const whiskerMin = Math.max(s.min, s.q1 - 1.5*(s.q3-s.q1))
      const whiskerMax = Math.min(s.max, s.q3 + 1.5*(s.q3-s.q1))
      ;[[whiskerMin, s.q1],[s.q3, whiskerMax]].forEach(([a,b]) => {
        g.append('line').attr('x1', cx).attr('x2', cx)
          .attr('y1', yS(a)).attr('y2', yS(b))
          .attr('stroke', col).attr('stroke-width', 1.5).attr('stroke-opacity', 0.6)
        g.append('line').attr('x1', cx - bw*0.3).attr('x2', cx + bw*0.3)
          .attr('y1', yS(a)).attr('y2', yS(a))
          .attr('stroke', col).attr('stroke-width', 1.2).attr('stroke-opacity', 0.5)
      })

      // IQR Box
      g.append('rect')
        .attr('x', xS(s.code) ?? 0)
        .attr('width', bw)
        .attr('y', yS(s.q3))
        .attr('height', Math.max(2, yS(s.q1) - yS(s.q3)))
        .attr('fill', col)
        .attr('fill-opacity', 0.22)
        .attr('stroke', col)
        .attr('stroke-width', 1.8)
        .attr('rx', 2)
        .attr('cursor', 'pointer')
        .on('mouseover', function(e) {
          d3.select(this).attr('fill-opacity', 0.4)
          if (tipRef.current) {
            const rect = svgRef.current!.getBoundingClientRect()
            tipRef.current.style.display = 'block'
            tipRef.current.style.left = `${e.clientX - rect.left + 12}px`
            tipRef.current.style.top  = `${e.clientY - rect.top - 120}px`
            tipRef.current.innerHTML = `
              <div style="color:${col}" class="font-mono font-black text-xs mb-1">${s.fn} ${s.ln}</div>
              <div class="text-[10px] text-white/50 mb-1.5">${s.team}</div>
              <div class="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px] font-mono">
                <span class="text-white/40">Mean</span><span class="font-bold text-white">${fmtT(s.mean)}</span>
                <span class="text-white/40">Median</span><span>${fmtT(s.median)}</span>
                <span class="text-white/40">Q1</span><span>${fmtT(s.q1)}</span>
                <span class="text-white/40">Q3</span><span>${fmtT(s.q3)}</span>
                <span class="text-white/40">Delta</span><span style="color:${delta===0?'#22c55e':'#f87171'}">+${delta.toFixed(3)}s</span>
                <span class="text-white/40">Laps</span><span>${s.laps.length}</span>
              </div>
            `
          }
        })
        .on('mouseout', function() {
          d3.select(this).attr('fill-opacity', 0.22)
          if (tipRef.current) tipRef.current.style.display = 'none'
        })

      // Median line (solid, thick)
      g.append('line')
        .attr('x1', xS(s.code) ?? 0).attr('x2', (xS(s.code) ?? 0) + bw)
        .attr('y1', yS(s.median)).attr('y2', yS(s.median))
        .attr('stroke', col).attr('stroke-width', 2.5).attr('stroke-opacity', 0.95)

      // Mean line (dashed)
      g.append('line')
        .attr('x1', xS(s.code) ?? 0).attr('x2', (xS(s.code) ?? 0) + bw)
        .attr('y1', yS(s.mean)).attr('y2', yS(s.mean))
        .attr('stroke', col).attr('stroke-width', 1.5).attr('stroke-dasharray', '3,2').attr('stroke-opacity', 0.8)

      // X axis labels
      const labG = g.append('g').attr('transform', `translate(${cx}, ${iH + 8})`)

      labG.append('text').attr('text-anchor', 'middle').attr('fill', col)
        .attr('font-size', 10).attr('font-weight', 'bold').attr('font-family', 'monospace')
        .text(s.code)

      labG.append('text').attr('text-anchor', 'middle').attr('fill', 'rgba(255,255,255,0.5)')
        .attr('font-size', 8.5).attr('font-family', 'monospace').attr('y', 13)
        .text(fmtT(s.mean))

      labG.append('text').attr('text-anchor', 'middle')
        .attr('fill', delta === 0 ? '#22c55e' : 'rgba(255,100,100,0.8)')
        .attr('font-size', 8).attr('font-family', 'monospace').attr('y', 24)
        .text(delta === 0 ? '+0.000' : `+${delta.toFixed(3)}`)
    })

    // Legend
    const legG = g.append('g').attr('transform', `translate(${iW - 160}, ${iH + 68})`)
    legG.append('line').attr('x1',0).attr('x2',18).attr('stroke','rgba(255,255,255,0.4)').attr('stroke-width',2.5)
    legG.append('text').attr('x',22).attr('y',4).attr('fill','rgba(255,255,255,0.4)').attr('font-size',8).text('Median')
    legG.append('line').attr('x1',80).attr('x2',98).attr('stroke','rgba(255,255,255,0.4)').attr('stroke-width',1.5).attr('stroke-dasharray','3,2')
    legG.append('text').attr('x',102).attr('y',4).attr('fill','rgba(255,255,255,0.4)').attr('font-size',8).text('Mean')

    // Title
    svg.append('text').attr('x', (iW + mL) / 2).attr('y', 20)
      .attr('text-anchor', 'middle').attr('fill', 'rgba(255,255,255,0.7)')
      .attr('font-size', 14).attr('font-weight', 'bold')
      .text(`${year} Race Pace — Drivers sorted by mean lap time`)

    svg.append('text').attr('x', (iW + mL) / 2).attr('y', 36)
      .attr('text-anchor', 'middle').attr('fill', 'rgba(255,255,255,0.3)')
      .attr('font-size', 10)
      .text('SC/VSC laps removed · Pit in/out laps removed · Boxes contain 50% of laps')
  }

  useEffect(() => {
    draw()
    roRef.current?.disconnect()
    roRef.current = new ResizeObserver(draw)
    if (svgRef.current?.parentElement) roRef.current.observe(svgRef.current.parentElement)
    return () => roRef.current?.disconnect()
  }, [stats, year])

  return (
    <div className="relative w-full overflow-x-auto">
      <svg ref={svgRef} className="w-full min-w-[640px]" style={{ minWidth: Math.max(640, stats.length * 52) }}/>
      <div ref={tipRef} className="chart-tooltip hidden" style={{ maxWidth: 220, pointerEvents: 'none' }}/>
    </div>
  )
}

// ── Smoothed Race Trace ─────────────────────────────────────────────────────
function RaceTraceChart({ stats }: { stats: DriverStats[] }) {
  const svgRef = useRef<SVGSVGElement>(null)
  const tipRef = useRef<HTMLDivElement>(null)
  const roRef  = useRef<ResizeObserver | null>(null)

  function draw() {
    if (!svgRef.current || !stats.length) return
    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const W  = svgRef.current.parentElement!.clientWidth || 900
    const m  = { t: 16, r: 80, b: 44, l: 60 }
    const iW = W - m.l - m.r, iH = 260

    svg.attr('width', W).attr('height', iH + m.t + m.b)
    const g = svg.append('g').attr('transform', `translate(${m.l},${m.t})`)

    // Use smoothed data
    const allPts = stats.flatMap(s => s.smoothed)
    if (!allPts.length) return

    const maxLap = d3.max(allPts, p => p.lap)!
    const [yMin, yMax] = d3.extent(allPts, p => p.t) as [number, number]
    const yPad = (yMax - yMin) * 0.1

    const xS = d3.scaleLinear().domain([d3.min(allPts, p=>p.lap)!, maxLap]).range([0, iW])
    const yS = d3.scaleLinear().domain([yMax + yPad, yMin - yPad]).range([iH, 0])

    // Grid
    g.append('g').call(d3.axisLeft(yS).ticks(5).tickSize(-iW).tickFormat(()=>'')).selectAll('line')
      .attr('stroke','rgba(255,255,255,0.04)').attr('stroke-dasharray','3,5')
    g.selectAll('.domain').remove()

    // Axes
    g.append('g').attr('transform',`translate(0,${iH})`).call(
      d3.axisBottom(xS).ticks(Math.min(maxLap, 14)).tickFormat(d3.format('d'))
    ).selectAll('text').attr('fill','rgba(255,255,255,0.3)').attr('font-size',9).attr('font-family','monospace')
    g.append('g').call(
      d3.axisLeft(yS).ticks(5).tickFormat(d => fmtT(+d))
    ).selectAll('text').attr('fill','rgba(255,255,255,0.3)').attr('font-size',8).attr('font-family','monospace')
    g.append('text').attr('x', iW/2).attr('y', iH+38).attr('text-anchor','middle')
      .attr('fill','rgba(255,255,255,0.2)').attr('font-size',9).text('Lap')
    g.append('text').attr('transform','rotate(-90)').attr('x',-iH/2).attr('y',-50)
      .attr('text-anchor','middle').attr('fill','rgba(255,255,255,0.2)').attr('font-size',9).text('Lap Time (s)')

    const line = d3.line<{lap:number;t:number}>()
      .x(p => xS(p.lap)).y(p => yS(p.t))
      .curve(d3.curveBasis)

    stats.forEach(s => {
      if (!s.smoothed.length) return
      g.append('path').datum(s.smoothed).attr('fill','none')
        .attr('stroke', s.color).attr('stroke-width', 2.2).attr('opacity', 0.85)
        .attr('d', line as any)

      // End label
      const last = s.smoothed[s.smoothed.length - 1]
      if (last) {
        g.append('text').attr('x', xS(last.lap) + 5).attr('y', yS(last.t) + 3.5)
          .attr('fill', s.color).attr('font-size', 9).attr('font-family','monospace').attr('font-weight','bold')
          .text(s.code)
      }
    })
  }

  useEffect(() => {
    draw()
    roRef.current?.disconnect()
    roRef.current = new ResizeObserver(draw)
    if (svgRef.current?.parentElement) roRef.current.observe(svgRef.current.parentElement)
    return () => roRef.current?.disconnect()
  }, [stats])

  return (
    <div className="relative w-full">
      <svg ref={svgRef} className="w-full"/>
      <div ref={tipRef} className="chart-tooltip hidden" style={{pointerEvents:'none'}}/>
    </div>
  )
}

// ── Constructor Comparison ─────────────────────────────────────────────────
function ConstructorTable({ stats }: { stats: DriverStats[] }) {
  const byTeam = new Map<string, DriverStats[]>()
  stats.forEach(s => {
    const arr = byTeam.get(s.team) ?? []
    arr.push(s)
    byTeam.set(s.team, arr)
  })

  const teams: { team: string; avgMean: number; color: string; drivers: DriverStats[]; delta: number }[] = []
  byTeam.forEach((drivers, team) => {
    const avgMean = d3.mean(drivers, d => d.mean) ?? 0
    teams.push({ team, avgMean, color: drivers[0].color, drivers, delta: 0 })
  })
  teams.sort((a, b) => a.avgMean - b.avgMean)
  const baseline = teams[0]?.avgMean ?? 0
  teams.forEach(t => { t.delta = t.avgMean - baseline })

  // Color gradient from green (fastest) to red (slowest)
  const colorScale = d3.scaleLinear<string>()
    .domain([0, teams.length - 1])
    .range(['#22c55e', '#ef4444'])
    .interpolate(d3.interpolateRgb)

  return (
    <div className="rounded-xl border border-white/10 overflow-hidden" style={{background:'rgba(0,0,0,0.5)'}}>
      <div className="px-4 py-2 border-b border-white/10 flex items-center gap-2">
        <TrendingUp size={13} className="text-primary"/>
        <span className="text-xs font-bold text-primary uppercase tracking-widest">Constructor Race Pace</span>
      </div>
      <div className="divide-y divide-white/[0.04]">
        {teams.map((t, i) => (
          <div key={t.team} className="flex items-center gap-3 px-4 py-2 hover:bg-white/[0.03] transition-colors">
            <span className="text-xs font-mono text-white/30 w-4">{i + 1}</span>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full shrink-0" style={{background: t.color}}/>
                <span className="font-bold text-sm" style={{color: t.color}}>{t.team}</span>
              </div>
              <div className="flex gap-1 mt-0.5">
                {t.drivers.map(d => (
                  <span key={d.code} className="text-[9px] font-mono text-white/40">{d.code}</span>
                ))}
              </div>
            </div>
            <div className="text-right">
              <div className="font-mono font-bold text-sm text-white/80">{fmtT(t.avgMean)}</div>
              <div className="text-xs font-mono" style={{color: colorScale(i)}}>
                {t.delta === 0 ? '—' : `+${t.delta.toFixed(3)}s`}
              </div>
            </div>
            {/* Color bar */}
            <div className="w-16 h-2 rounded-full bg-white/5 overflow-hidden">
              <div className="h-full rounded-full" style={{
                width: `${Math.max(4, 100 - (t.delta / (teams[teams.length-1].delta||1)) * 100)}%`,
                background: colorScale(i)
              }}/>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main Page ───────────────────────────────────────────────────────────────
export default function RacePacePage() {
  const [year, setYear]     = useState(2026)
  const [event, setEvent]   = useState('Chinese Grand Prix')
  const [stats, setStats]   = useState<DriverStats[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState<string | null>(null)
  const [driverInfo, setDriverInfo] = useState<Record<string, {team:string;color:string;fn:string;ln:string;url:string}>>({})

  const events = EVENTS_BY_YEAR[year]?.filter(e =>
    !e.startsWith('Pre-Season')
  ) ?? []

  // Load driver info
  const loadDriverInfo = useCallback(async (yr: number, ev: string) => {
    try {
      const base = CDN_FALLBACKS[0]
      const r = await fetch(`${base}/${yr}@main/${enc(ev)}/Race/drivers.json?_=${Date.now()}`)
      if (!r.ok) return
      const d = await r.json()
      const info: Record<string, any> = {}
      d.drivers.forEach((dr: any) => {
        info[dr.driver] = {
          team:  dr.team,
          color: dr.tc ? `#${dr.tc}` : (TEAM_COLORS[dr.team] ?? '#888'),
          fn:    dr.fn ?? '',
          ln:    dr.ln ?? '',
          url:   dr.url ?? '',
        }
      })
      setDriverInfo(info)
    } catch {}
  }, [])

  const compute = useCallback(async () => {
    if (!event) return
    setLoading(true); setError(null); setStats([])
    try {
      await loadDriverInfo(year, event)
      const lapMap = await loadRaceLaps(year, event)

      const driverInfoNow = await (async () => {
        const base = CDN_FALLBACKS[0]
        const r = await fetch(`${base}/${year}@main/${enc(event)}/Race/drivers.json?_=${Date.now()}`)
        const d = await r.json()
        const info: Record<string, any> = {}
        d.drivers.forEach((dr: any) => {
          info[dr.driver] = {
            team:  dr.team,
            color: dr.tc ? `#${dr.tc}` : (TEAM_COLORS[dr.team] ?? '#888'),
            fn:    dr.fn ?? '',
            ln:    dr.ln ?? '',
            url:   dr.url ?? '',
          }
        })
        return info
      })()

      const result: DriverStats[] = []

      lapMap.forEach((laps, code) => {
        if (laps.length < 3) return
        const times = laps.map(l => l.time).sort((a, b) => a - b)
        const mean   = d3.mean(times)!
        const median = d3.median(times)!
        const q1     = d3.quantile(times, 0.25)!
        const q3     = d3.quantile(times, 0.75)!
        const min    = times[0]
        const max    = times[times.length - 1]
        const stddev = d3.deviation(times) ?? 0

        // Smoothed lap-by-lap (rolling average window 3)
        const byLap = [...laps].sort((a, b) => a.lap - b.lap)
        const smoothed: {lap:number;t:number}[] = []
        for (let i = 1; i < byLap.length - 1; i++) {
          smoothed.push({
            lap: byLap[i].lap,
            t: (byLap[i-1].time + byLap[i].time + byLap[i+1].time) / 3
          })
        }
        if (byLap.length === 1) smoothed.push({lap:byLap[0].lap, t:byLap[0].time})

        const info = driverInfoNow[code] ?? { team:'Unknown', color:'#888', fn:'', ln:'', url:'' }
        result.push({ code, ...info, laps, mean, median, q1, q3, min, max, stddev, smoothed })
      })

      // Sort by mean lap time
      result.sort((a, b) => a.mean - b.mean)
      setStats(result)
    } catch (e: any) {
      setError(`Failed to load race data: ${e.message}\n\nMake sure this event has Race session data available.`)
    } finally {
      setLoading(false)
    }
  }, [year, event])

  // Auto-load on mount
  useEffect(() => { compute() }, [])

  return (
    <div className="container mx-auto max-w-screen-xl px-2 sm:px-4 py-4">
      {/* Header */}
      <div className="rounded-xl border border-white/10 p-4 sm:p-6 mb-4"
        style={{background:'rgba(255,255,255,0.03)',backdropFilter:'blur(8px)'}}>
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-primary flex items-center gap-3">
              <TrendingUp size={28} className="text-primary"/>
              Race Pace
            </h1>
            <p className="text-sm text-base-content/40 mt-1">
              Box plots sorted by mean lap time · SC/VSC laps excluded · Pit laps excluded
            </p>
          </div>
          <div className="flex flex-wrap gap-2 items-end">
            <div>
              <label className="block text-[10px] text-base-content/40 uppercase font-bold mb-1">Year</label>
              <select value={year}
                onChange={e => { setYear(+e.target.value); setEvent(EVENTS_BY_YEAR[+e.target.value]?.find(ev=>!ev.startsWith('Pre-Season')) ?? '') }}
                className="select select-bordered select-sm bg-base-200/50 select-primary w-24">
                {AVAILABLE_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-base-content/40 uppercase font-bold mb-1">Race Event</label>
              <select value={event} onChange={e => setEvent(e.target.value)}
                className="select select-bordered select-sm bg-base-200/50 select-primary w-64">
                {events.map(ev => <option key={ev} value={ev}>{ev}</option>)}
              </select>
            </div>
            <button onClick={compute} disabled={loading}
              className="btn btn-primary btn-sm gap-2">
              {loading ? <RefreshCw size={13} className="animate-spin"/> : <TrendingUp size={13}/>}
              {loading ? 'Loading…' : 'Load Race Pace'}
            </button>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="alert alert-warning rounded-xl mb-4 whitespace-pre-wrap text-sm">
          <span>{error}</span>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <RefreshCw size={28} className="animate-spin text-primary"/>
          <div className="text-base-content/40 text-sm">Fetching race laps for all drivers…</div>
        </div>
      )}

      {/* Charts */}
      {!loading && stats.length > 0 && (
        <div className="space-y-4">
          {/* Summary stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Fastest Mean',  val: fmtT(stats[0].mean),  sub: stats[0].code,             color: stats[0].color },
              { label: 'Slowest Mean',  val: fmtT(stats[stats.length-1].mean), sub: stats[stats.length-1].code, color: stats[stats.length-1].color },
              { label: 'Field Spread',  val: `${(stats[stats.length-1].mean - stats[0].mean).toFixed(3)}s`, sub: 'fastest → slowest', color: '#a78bfa' },
              { label: 'Drivers',        val: String(stats.length),  sub: 'with valid race data',   color: '#60a5fa' },
            ].map(item => (
              <div key={item.label} className="rounded-xl p-3 border border-white/[0.06]"
                style={{background:'rgba(255,255,255,0.025)'}}>
                <div className="text-[9px] text-base-content/35 font-bold uppercase tracking-widest">{item.label}</div>
                <div className="font-mono font-black text-xl mt-1" style={{color:item.color}}>{item.val}</div>
                <div className="text-[9px] text-base-content/30 mt-0.5">{item.sub}</div>
              </div>
            ))}
          </div>

          {/* Box plots */}
          <div className="rounded-xl border border-white/[0.06] p-3 sm:p-5"
            style={{background:'rgba(255,255,255,0.025)',backdropFilter:'blur(8px)'}}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-primary uppercase tracking-widest">Global Race Pace — Box Plots</h2>
            </div>
            <BoxPlotChart stats={stats} year={year}/>
          </div>

          {/* Driver photos + quick stats row */}
          <div className="rounded-xl border border-white/[0.06] p-3 sm:p-5"
            style={{background:'rgba(255,255,255,0.025)',backdropFilter:'blur(8px)'}}>
            <h2 className="text-sm font-bold text-primary uppercase tracking-widest mb-3">Driver Cards</h2>
            <div className="flex flex-wrap gap-2">
              {stats.map((s, i) => (
                <div key={s.code} className="flex items-center gap-2 rounded-xl px-2.5 py-2 border"
                  style={{borderColor:`${s.color}30`, background:`${s.color}0c`, minWidth: 120}}>
                  <div className="relative shrink-0">
                    {s.url ? (
                      <img src={`/api/driver-img?url=${encodeURIComponent(s.url)}`} alt={s.code}
                        className="w-8 h-8 rounded-full object-cover object-top"
                        style={{border:`2px solid ${s.color}`}}
                        onError={e => { (e.target as HTMLImageElement).style.display='none' }}/>
                    ) : (
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black"
                        style={{background:`${s.color}25`,color:s.color,border:`2px solid ${s.color}55`}}>
                        {s.code[0]}
                      </div>
                    )}
                    <div className="absolute -top-1 -left-1 w-4 h-4 rounded-full flex items-center justify-center text-[7px] font-black"
                      style={{background: i<3 ? '#fbbf24' : i<10 ? s.color : 'rgba(255,255,255,0.15)',
                              color: i<3 ? '#000' : '#fff'}}>
                      {i + 1}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <div className="font-mono font-black text-xs leading-none" style={{color:s.color}}>{s.code}</div>
                    <div className="font-mono text-[9px] text-white/60">{fmtT(s.mean)}</div>
                    <div className="font-mono text-[8px]" style={{color: i===0?'#22c55e':'rgba(248,113,113,0.7)'}}>
                      {i===0 ? 'BEST' : `+${(s.mean - stats[0].mean).toFixed(3)}`}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Smoothed race trace */}
          <div className="rounded-xl border border-white/[0.06] p-3 sm:p-5"
            style={{background:'rgba(255,255,255,0.025)',backdropFilter:'blur(8px)'}}>
            <h2 className="text-sm font-bold text-primary uppercase tracking-widest mb-3">Smoothed Lap-by-Lap Race Pace</h2>
            <RaceTraceChart stats={stats}/>
          </div>

          {/* Constructor table */}
          <ConstructorTable stats={stats}/>

          {/* Raw data table */}
          <div className="rounded-xl border border-white/[0.06] overflow-hidden"
            style={{background:'rgba(255,255,255,0.025)',backdropFilter:'blur(8px)'}}>
            <div className="px-4 py-3 border-b border-white/10">
              <h2 className="text-sm font-bold text-primary uppercase tracking-widest">Raw Statistics</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="table table-xs w-full font-mono">
                <thead><tr className="text-primary/60 text-[10px] bg-base-300/20">
                  <th>P</th><th>Driver</th><th>Team</th><th>Mean</th><th>Median</th>
                  <th>Q1</th><th>Q3</th><th>Spread</th><th>Laps</th><th>Delta</th>
                </tr></thead>
                <tbody>
                  {stats.map((s, i) => (
                    <tr key={s.code} className="border-white/[0.04] hover:bg-white/[0.03]">
                      <td className="text-white/30">{i+1}</td>
                      <td className="font-black" style={{color:s.color}}>{s.code}</td>
                      <td className="text-white/50 text-[9px]">{s.team}</td>
                      <td className="font-bold text-white/80">{fmtT(s.mean)}</td>
                      <td className="text-white/60">{fmtT(s.median)}</td>
                      <td className="text-white/40">{fmtT(s.q1)}</td>
                      <td className="text-white/40">{fmtT(s.q3)}</td>
                      <td className="text-white/40">{(s.q3-s.q1).toFixed(3)}s</td>
                      <td className="text-white/40">{s.laps.length}</td>
                      <td style={{color: i===0?'#22c55e':'#f87171'}}>
                        {i===0 ? '—' : `+${(s.mean-stats[0].mean).toFixed(3)}s`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && !stats.length && !error && (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-base-content/25">
          <TrendingUp size={48} className="opacity-30"/>
          <p className="text-lg font-semibold">Select a race event and click Load Race Pace</p>
        </div>
      )}
    </div>
  )
}
