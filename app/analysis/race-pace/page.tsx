'use client'
import { Suspense, useEffect, useRef, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import * as d3 from 'd3'
import { CDN_FALLBACKS, AVAILABLE_YEARS, EVENTS_BY_YEAR, TEAM_COLORS } from '@/lib/constants'
import { RefreshCw, TrendingUp, Play, Pause, RotateCcw, Video } from 'lucide-react'

const enc = (s: string) => encodeURIComponent(s)

// ── Types ──────────────────────────────────────────────────────────────────
interface LapRow { lap: number; time: number; compound: string; stint: number; pos: number }
interface DriverStats {
  code: string; team: string; color: string; url: string; fn: string; ln: string
  laps: LapRow[]
  mean: number; median: number; q1: number; q3: number
  min: number; max: number; iqr: number; stddev: number
  smoothed: { lap: number; t: number }[]
  tyreStrategy: string
}

const fmtSec  = (t: number) => t.toFixed(2) + 's'
const fmtSecF = (t: number) => t.toFixed(3) + 's'
const Y_MIN   = 95
const Y_MAX   = 102

// ── Data fetching ──────────────────────────────────────────────────────────
async function fetchAllRaceLaps(year: number, event: string): Promise<{ stats: DriverStats[]; error?: string }> {
  const base = CDN_FALLBACKS[0]
  const path = `${year}@main/${enc(event)}/Race`
  let driverList: any[] = []
  try {
    const r = await fetch(`${base}/${path}/drivers.json?_=${Date.now()}`)
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    driverList = (await r.json()).drivers ?? []
  } catch (e: any) {
    return { stats: [], error: `No race data for "${event}" ${year}. Published ~30 min after session ends.` }
  }
  const infoMap: Record<string, any> = {}
  driverList.forEach(d => { infoMap[d.driver] = { team: d.team, color: d.tc ? `#${d.tc}` : (TEAM_COLORS[d.team] ?? '#888'), fn: d.fn ?? '', ln: d.ln ?? '', url: d.url ?? '' } })
  const settled = await Promise.allSettled(driverList.map(async d => {
    const r = await fetch(`${base}/${path}/${d.driver}/laptimes.json?_=${Date.now()}`)
    if (!r.ok) return null
    return { code: d.driver, raw: await r.json() }
  }))
  const stats: DriverStats[] = []
  settled.forEach(res => {
    if (res.status !== 'fulfilled' || !res.value) return
    const { code, raw } = res.value
    const info = infoMap[code] ?? { team: 'Unknown', color: '#888', fn: '', ln: '', url: '' }
    const n = (v: any) => (v === 'None' || v == null) ? null : +v
    const laps: LapRow[] = []
    for (let i = 0; i < (raw.lap?.length ?? 0); i++) {
      const t = n(raw.time?.[i])
      if (!t || t <= 0 || (raw.del?.[i] === true || raw.del?.[i] === 'True')) continue
      if ((raw.lap?.[i] ?? 0) <= 1) continue
      if (/[456]/.test(String(raw.status?.[i] ?? '1'))) continue
      laps.push({ lap: raw.lap[i], time: t, compound: String(raw.compound?.[i] ?? 'UNKNOWN').toUpperCase().replace('NONE','UNKNOWN'), stint: raw.stint?.[i] ?? 1, pos: n(raw.pos?.[i]) ?? 0 })
    }
    if (laps.length < 4) return
    const rawMed = d3.median(laps.map(l => l.time).sort(d3.ascending))!
    const clean = laps.filter(l => l.time <= rawMed * 1.12)
    if (clean.length < 4) return
    const times = clean.map(l => l.time).sort(d3.ascending)
    const mean = d3.mean(times)!, median = d3.median(times)!
    const q1 = d3.quantile(times, 0.25)!, q3 = d3.quantile(times, 0.75)!
    const iqr = q3 - q1
    const wMin = Math.max(times[0], q1 - 1.5*iqr), wMax = Math.min(times[times.length-1], q3 + 1.5*iqr)
    const byLap = [...clean].sort((a,b) => a.lap - b.lap)
    const smoothed: {lap:number;t:number}[] = []
    for (let i = 1; i < byLap.length-1; i++) smoothed.push({ lap: byLap[i].lap, t: (byLap[i-1].time + byLap[i].time + byLap[i+1].time) / 3 })
    const seenT: string[] = []
    byLap.forEach(l => { const c = l.compound[0]; if (!seenT.length || seenT[seenT.length-1] !== c) seenT.push(c) })
    stats.push({ code, ...info, laps: clean, mean, median, q1, q3, iqr, stddev: d3.deviation(times) ?? 0, min: wMin, max: wMax, smoothed, tyreStrategy: seenT.join('-') })
  })
  stats.sort((a,b) => a.mean - b.mean)
  return { stats }
}

// ── ANIMATED Box Plot ──────────────────────────────────────────────────────
function AnimatedBoxPlot({ stats, animStep, year, event }: { stats: DriverStats[]; animStep: number; year: number; event: string }) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const tipRef  = useRef<HTMLDivElement>(null)
  const roRef   = useRef<ResizeObserver | null>(null)

  const draw = useCallback(() => {
    if (!wrapRef.current || !stats.length) return
    wrapRef.current.innerHTML = ''
    const W  = wrapRef.current.clientWidth || 900
    const N  = stats.length
    const mL = 64, mR = 24, mT = 80, mB = 110
    const boxW = Math.max(22, Math.min(52, (W - mL - mR) / N - 8))
    const iW = Math.max(W - mL - mR, N * (boxW + 10))
    const iH = 340
    const svgW = iW + mL + mR

    const svg = d3.create('svg').attr('width', svgW).attr('height', iH + mT + mB).style('font-family', 'monospace')
    const defs = svg.append('defs')
    const bg = defs.append('linearGradient').attr('id','bpBg').attr('x1','0%').attr('y1','0%').attr('x2','0%').attr('y2','100%')
    bg.append('stop').attr('offset','0%').attr('stop-color','rgba(255,255,255,0.025)')
    bg.append('stop').attr('offset','100%').attr('stop-color','rgba(0,0,0,0)')
    const g = svg.append('g').attr('transform', `translate(${mL},${mT})`)
    g.append('rect').attr('width', iW).attr('height', iH).attr('fill','url(#bpBg)').attr('rx',4)

    const dataMin = d3.min(stats.flatMap(s=>[s.min,...s.laps.map(l=>l.time)])) ?? Y_MIN
    const dataMax = d3.max(stats.flatMap(s=>[s.max,...s.laps.map(l=>l.time)])) ?? Y_MAX
    const yLo = Math.min(Y_MIN, Math.floor(dataMin)-0.5)
    const yHi = Math.max(Y_MAX, Math.ceil(dataMax)+0.5)
    const yS = d3.scaleLinear().domain([yLo, yHi]).range([iH, 0])
    const yTickVals: number[] = []
    for (let v = Math.ceil(yLo); v <= Math.floor(yHi); v++) yTickVals.push(v)

    // Grid
    yTickVals.forEach(v => {
      g.append('line').attr('x1',0).attr('x2',iW).attr('y1',yS(v)).attr('y2',yS(v))
        .attr('stroke','rgba(255,255,255,0.07)').attr('stroke-dasharray','4,5')
    })

    // Y axis
    g.append('g').call(d3.axisLeft(yS).tickValues(yTickVals).tickFormat(d=>`${+d}`).tickSize(6))
      .call(s => { s.selectAll('text').attr('fill','rgba(255,255,255,0.6)').attr('font-size',11).attr('font-family','monospace'); s.selectAll('line').attr('stroke','rgba(255,255,255,0.2)'); s.select('.domain').attr('stroke','rgba(255,255,255,0.25)') })
    svg.append('text').attr('transform','rotate(-90)').attr('x',-(mT+iH/2)).attr('y',14)
      .attr('text-anchor','middle').attr('fill','rgba(255,255,255,0.5)').attr('font-size',11).text('Smoothed Laptime (s)')

    const xS = d3.scaleBand().domain(stats.map(s=>s.code)).range([0,iW]).paddingInner(0.35).paddingOuter(0.1)
    const bw = xS.bandwidth()
    const baseline = stats[0].mean

    // How many drivers to show based on animStep (0=none, 1=first, etc.)
    const visibleCount = animStep  // each step reveals one more driver

    stats.forEach((s, i) => {
      if (i >= visibleCount) return  // hide until animation reaches this driver
      const x0 = xS(s.code) ?? 0
      const cx = x0 + bw/2
      const col = s.color
      const delta = s.mean - baseline
      const delay = 0  // already revealed

      // Outliers
      s.laps.forEach(l => {
        if (l.time < s.q1 - 1.5*s.iqr || l.time > s.q3 + 1.5*s.iqr) {
          g.append('circle').attr('cx',cx).attr('cy',yS(l.time)).attr('r',3.5)
            .attr('fill','none').attr('stroke',col).attr('stroke-width',1.5).attr('opacity',0.7)
        }
      })

      // Whiskers
      ;[[s.min,s.q1],[s.q3,s.max]].forEach(([lo,hi]) => {
        g.append('line').attr('x1',cx).attr('x2',cx).attr('y1',yS(lo)).attr('y2',yS(hi))
          .attr('stroke',col).attr('stroke-width',1.8).attr('opacity',0.7)
        g.append('line').attr('x1',cx-bw*0.28).attr('x2',cx+bw*0.28).attr('y1',yS(lo)).attr('y2',yS(lo))
          .attr('stroke',col).attr('stroke-width',1.5).attr('opacity',0.6)
        g.append('line').attr('x1',cx-bw*0.28).attr('x2',cx+bw*0.28).attr('y1',yS(hi)).attr('y2',yS(hi))
          .attr('stroke',col).attr('stroke-width',1.5).attr('opacity',0.6)
      })

      // IQR Box — animates height from 0
      const boxTop = yS(s.q3), boxBot = yS(s.q1), boxH = Math.max(3, boxBot - boxTop)
      const rect = g.append('rect').attr('x',x0).attr('width',bw).attr('rx',2)
        .attr('fill',col).attr('fill-opacity',0.20).attr('stroke',col).attr('stroke-width',2.2)
        .attr('cursor','pointer')
        .on('mouseover', function(e) {
          d3.select(this).attr('fill-opacity',0.45)
          if (!tipRef.current) return
          const rect2 = wrapRef.current!.getBoundingClientRect()
          tipRef.current.style.display = 'block'
          tipRef.current.style.left = `${Math.min(e.clientX-rect2.left+12, W-220)}px`
          tipRef.current.style.top  = `${Math.max(0, e.clientY-rect2.top-150)}px`
          tipRef.current.innerHTML = `
            <div style="color:${col}" class="font-black text-sm mb-1">${s.fn} ${s.ln}</div>
            <div class="text-[10px] text-white/50 mb-2">${s.team}</div>
            <table class="text-[10px] font-mono w-full">
              <tr><td class="text-white/40 pr-3">Mean</td><td class="font-bold text-white">${fmtSecF(s.mean)}</td></tr>
              <tr><td class="text-white/40 pr-3">Median</td><td>${fmtSecF(s.median)}</td></tr>
              <tr><td class="text-white/40 pr-3">IQR</td><td>${fmtSecF(s.iqr)}</td></tr>
              <tr><td class="text-white/40 pr-3">Δ best</td><td style="color:${delta<=0?'#4ade80':'#f87171'}">${delta<=0?'—':'+'+delta.toFixed(3)+'s'}</td></tr>
              <tr><td class="text-white/40 pr-3">Tyres</td><td style="color:${col}">${s.tyreStrategy}</td></tr>
            </table>`
        })
        .on('mouseout', function() { d3.select(this).attr('fill-opacity',0.20); if (tipRef.current) tipRef.current.style.display='none' })

      // Animate box growing from bottom (Q1 line) upward
      rect.attr('y', boxBot).attr('height', 0)
      rect.transition().duration(400).ease(d3.easeBackOut).attr('y', boxTop).attr('height', boxH)

      // Median
      const medLine = g.append('line').attr('x1',x0).attr('x2',x0+bw).attr('stroke',col).attr('stroke-width',3).attr('opacity',0)
        .attr('y1',yS(s.median)).attr('y2',yS(s.median))
      medLine.transition().delay(200).duration(300).attr('opacity',1)

      // Mean dashed
      const meanLine = g.append('line').attr('x1',x0).attr('x2',x0+bw).attr('stroke','#fff').attr('stroke-width',1.5)
        .attr('stroke-dasharray','3,2.5').attr('opacity',0).attr('y1',yS(s.mean)).attr('y2',yS(s.mean))
      meanLine.transition().delay(300).duration(300).attr('opacity',0.6)

      // X-axis labels
      const lb = g.append('g').attr('transform',`translate(${cx},${iH+8})`).attr('opacity',0)
      lb.append('text').attr('text-anchor','middle').attr('fill',col).attr('font-size',11).attr('font-weight','900').text(s.code)
      lb.append('text').attr('text-anchor','middle').attr('fill','rgba(255,255,255,0.65)').attr('font-size',9).attr('y',13).text(s.mean.toFixed(2))
      lb.append('text').attr('text-anchor','middle').attr('fill',delta<=0.01?'#4ade80':'rgba(248,113,113,0.9)').attr('font-size',9).attr('y',25).text(delta<=0.01?'+0.00s':`+${delta.toFixed(2)}s`)
      lb.append('text').attr('text-anchor','middle').attr('fill','rgba(255,255,255,0.35)').attr('font-size',8.5).attr('y',36).text(s.tyreStrategy)
      lb.transition().delay(350).duration(200).attr('opacity',1)
    })

    // Legend
    const legG = g.append('g').attr('transform',`translate(${iW-258},${iH-74})`)
    legG.append('rect').attr('x',-8).attr('y',-4).attr('width',266).attr('height',80).attr('rx',4).attr('fill','rgba(5,10,30,0.75)').attr('stroke','rgba(255,255,255,0.1)')
    ;['Dashed Line: Mean, Solid Line: Median;','Boxes contain 50% of the laps;','Whiskers contain 99.3% of normal distrib.','Dots indicate outliers.'].forEach((t,i) => {
      legG.append('text').attr('x',2).attr('y',i*15+12).attr('fill','rgba(255,255,255,0.5)').attr('font-size',9).text(t)
    })

    // Title
    svg.append('text').attr('x',mL+iW/2).attr('y',22).attr('text-anchor','middle').attr('fill','rgba(255,255,255,0.9)').attr('font-size',15).attr('font-weight','900').text(`${year} ${event} — Race`)
    svg.append('text').attr('x',mL+iW/2).attr('y',40).attr('text-anchor','middle').attr('fill','rgba(255,255,255,0.4)').attr('font-size',10).text('Global Race Pace (Drivers Sorted by Mean Laptime)')
    svg.append('text').attr('x',mL+iW/2).attr('y',60).attr('text-anchor','middle').attr('fill','rgba(255,200,0,0.95)').attr('font-size',14).attr('font-weight','900').attr('letter-spacing','3').text('RACE PACE')

    wrapRef.current.appendChild(svg.node()!)
  }, [stats, animStep, year, event])

  useEffect(() => {
    draw()
    roRef.current?.disconnect()
    roRef.current = new ResizeObserver(draw)
    if (wrapRef.current) roRef.current.observe(wrapRef.current)
    return () => roRef.current?.disconnect()
  }, [draw])

  return (
    <div className="relative w-full overflow-x-auto">
      <div ref={wrapRef} className="w-full" style={{minWidth: Math.max(640, stats.length*54)}}/>
      <div ref={tipRef} className="chart-tooltip hidden absolute z-50" style={{maxWidth:240,pointerEvents:'none'}}/>
    </div>
  )
}

// ── ANIMATED Race Trace ────────────────────────────────────────────────────
function AnimatedRaceTrace({ stats, animLap }: { stats: DriverStats[]; animLap: number }) {
  const ref   = useRef<SVGSVGElement>(null)
  const roRef = useRef<ResizeObserver | null>(null)

  function draw() {
    if (!ref.current || !stats.length) return
    const svg = d3.select(ref.current)
    svg.selectAll('*').remove()
    const W  = ref.current.parentElement!.clientWidth || 900
    const mL = 64, mR = 120, mT = 16, mB = 52
    const iW = W - mL - mR, iH = 260
    svg.attr('width',W).attr('height',iH+mT+mB)
    const g = svg.append('g').attr('transform',`translate(${mL},${mT})`)
    const allPts = stats.flatMap(s=>s.smoothed)
    if (!allPts.length) return
    const minLap = d3.min(allPts,p=>p.lap)!
    const maxLap = d3.max(allPts,p=>p.lap)!
    const dataMinT = d3.min(allPts,p=>p.t)!
    const dataMaxT = d3.max(allPts,p=>p.t)!
    const yLo = Math.min(Y_MIN, Math.floor(dataMinT)-0.5)
    const yHi = Math.max(Y_MAX, Math.ceil(dataMaxT)+0.5)
    const yS = d3.scaleLinear().domain([yLo,yHi]).range([iH,0])
    const xS = d3.scaleLinear().domain([minLap,maxLap]).range([0,iW])
    const yTicks: number[] = []
    for (let v=Math.ceil(yLo); v<=Math.floor(yHi); v++) yTicks.push(v)

    // Current lap to draw up to
    const currentLap = animLap

    yTicks.forEach(v => { g.append('line').attr('x1',0).attr('x2',iW).attr('y1',yS(v)).attr('y2',yS(v)).attr('stroke','rgba(255,255,255,0.06)').attr('stroke-dasharray','4,5') })
    g.append('g').call(d3.axisLeft(yS).tickValues(yTicks).tickFormat(d=>`${+d}`).tickSize(5)).call(s=>{s.selectAll('text').attr('fill','rgba(255,255,255,0.5)').attr('font-size',10).attr('font-family','monospace');s.selectAll('line').attr('stroke','rgba(255,255,255,0.15)');s.select('.domain').attr('stroke','rgba(255,255,255,0.2)')})
    g.append('g').attr('transform',`translate(0,${iH})`).call(d3.axisBottom(xS).ticks(10).tickFormat(d3.format('d')).tickSize(5)).call(s=>{s.selectAll('text').attr('fill','rgba(255,255,255,0.5)').attr('font-size',10).attr('font-family','monospace');s.selectAll('line').attr('stroke','rgba(255,255,255,0.15)');s.select('.domain').attr('stroke','rgba(255,255,255,0.2)')})
    svg.append('text').attr('transform','rotate(-90)').attr('x',-(mT+iH/2)).attr('y',14).attr('text-anchor','middle').attr('fill','rgba(255,255,255,0.4)').attr('font-size',10).text('Laptime (s)')
    g.append('text').attr('x',iW/2).attr('y',iH+40).attr('text-anchor','middle').attr('fill','rgba(255,255,255,0.35)').attr('font-size',11).text('Lap')

    // Vertical "current lap" indicator
    if (currentLap > minLap && currentLap <= maxLap) {
      g.append('line').attr('x1',xS(currentLap)).attr('x2',xS(currentLap)).attr('y1',0).attr('y2',iH)
        .attr('stroke','rgba(255,230,0,0.5)').attr('stroke-width',1.5).attr('stroke-dasharray','4,3')
      g.append('text').attr('x',xS(currentLap)+4).attr('y',10)
        .attr('fill','rgba(255,230,0,0.8)').attr('font-size',9).attr('font-family','monospace').text(`Lap ${Math.round(currentLap)}`)
    }

    const lineGen = d3.line<{lap:number;t:number}>().x(p=>xS(p.lap)).y(p=>yS(p.t)).curve(d3.curveBasis)

    stats.forEach(s => {
      // Only draw up to current animated lap
      const visible = s.smoothed.filter(p => p.lap <= currentLap)
      if (!visible.length) return
      g.append('path').datum(visible).attr('fill','none').attr('stroke','#000').attr('stroke-width',4).attr('opacity',0.15).attr('d',lineGen as any)
      g.append('path').datum(visible).attr('fill','none').attr('stroke',s.color).attr('stroke-width',2.2).attr('opacity',0.9).attr('d',lineGen as any)
      // Moving dot at tip
      const last = visible[visible.length-1]
      if (last && currentLap < maxLap) {
        g.append('circle').attr('cx',xS(last.lap)).attr('cy',yS(last.t)).attr('r',4)
          .attr('fill',s.color).attr('stroke','#fff').attr('stroke-width',1.5)
        g.append('text').attr('x',xS(last.lap)+6).attr('y',yS(last.t)+3.5)
          .attr('fill',s.color).attr('font-size',9).attr('font-weight','bold').attr('font-family','monospace').text(s.code)
      } else if (last) {
        g.append('text').attr('x',xS(last.lap)+5).attr('y',yS(last.t)+3.5)
          .attr('fill',s.color).attr('font-size',9).attr('font-weight','bold').attr('font-family','monospace').text(s.code)
      }
    })
  }

  useEffect(() => {
    draw()
    roRef.current?.disconnect()
    roRef.current = new ResizeObserver(draw)
    if (ref.current?.parentElement) roRef.current.observe(ref.current.parentElement)
    return () => roRef.current?.disconnect()
  }, [stats, animLap])

  return <svg ref={ref} className="w-full"/>
}

// ── ANIMATED Strip Chart ───────────────────────────────────────────────────
function AnimatedStrip({ stats, animStep }: { stats: DriverStats[]; animStep: number }) {
  const ref   = useRef<SVGSVGElement>(null)
  const roRef = useRef<ResizeObserver | null>(null)

  function draw() {
    if (!ref.current || !stats.length) return
    const svg = d3.select(ref.current)
    svg.selectAll('*').remove()
    const W = ref.current.parentElement!.clientWidth || 900
    const N = stats.length
    const m = {t:8,r:24,b:36,l:64}
    const iW = W-m.l-m.r, iH = 110, colW = iW/N
    svg.attr('width',W).attr('height',iH+m.t+m.b)
    const g = svg.append('g').attr('transform',`translate(${m.l},${m.t})`)
    const allTimes = stats.flatMap(s=>s.laps.map(l=>l.time))
    const yLo = Math.min(Y_MIN, Math.floor(d3.min(allTimes)!)-0.5)
    const yHi = Math.max(Y_MAX, Math.ceil(d3.max(allTimes)!)+0.5)
    const yS  = d3.scaleLinear().domain([yLo,yHi]).range([iH,0])
    const yTicks: number[] = []
    for (let v=Math.ceil(yLo); v<=Math.floor(yHi); v++) yTicks.push(v)
    g.append('g').call(d3.axisLeft(yS).tickValues(yTicks).tickFormat(d=>`${+d}`).tickSize(4)).call(s=>{s.selectAll('text').attr('fill','rgba(255,255,255,0.4)').attr('font-size',8).attr('font-family','monospace');s.selectAll('line').attr('stroke','rgba(255,255,255,0.1)');s.select('.domain').attr('stroke','rgba(255,255,255,0.1)')})
    yTicks.forEach(v => { g.append('line').attr('x1',0).attr('x2',iW).attr('y1',yS(v)).attr('y2',yS(v)).attr('stroke','rgba(255,255,255,0.05)').attr('stroke-dasharray','3,5') })

    stats.forEach((s,i) => {
      if (i >= animStep) return
      const cx = i*colW + colW/2
      const dotsG = g.append('g').attr('opacity',0)
      s.laps.forEach((l,j) => {
        const jitter = (((i*1234+j*7919)%100)/100-0.5)*colW*0.44
        dotsG.append('circle').attr('cx',cx+jitter).attr('cy',yS(l.time)).attr('r',2).attr('fill',s.color).attr('opacity',0.32)
      })
      dotsG.transition().duration(350).attr('opacity',1)
      g.append('circle').attr('cx',cx).attr('cy',yS(s.mean)).attr('r',5.5).attr('fill',s.color).attr('stroke','#fff').attr('stroke-width',1.8).attr('opacity',0)
        .transition().delay(200).duration(300).attr('opacity',1)
      g.append('line').attr('x1',cx-colW*0.3).attr('x2',cx+colW*0.3).attr('y1',yS(s.median)).attr('y2',yS(s.median))
        .attr('stroke',s.color).attr('stroke-width',2.5).attr('opacity',0)
        .transition().delay(250).duration(250).attr('opacity',0.9)
    })
  }

  useEffect(() => {
    draw()
    roRef.current?.disconnect()
    roRef.current = new ResizeObserver(draw)
    if (ref.current?.parentElement) roRef.current.observe(ref.current.parentElement)
    return () => roRef.current?.disconnect()
  }, [stats, animStep])

  return <svg ref={ref} className="w-full"/>
}

// ── Constructor bars ───────────────────────────────────────────────────────
function ConstructorBars({ stats, animStep }: { stats: DriverStats[]; animStep: number }) {
  const byTeam = new Map<string, DriverStats[]>()
  stats.forEach(s => { const a = byTeam.get(s.team)??[]; a.push(s); byTeam.set(s.team,a) })
  const teams = Array.from(byTeam.entries())
    .map(([team,drivers]) => ({ team, color: drivers[0].color, drivers, avg: d3.mean(drivers,d=>d.mean)! }))
    .sort((a,b) => a.avg-b.avg)
  const base = teams[0]?.avg ?? 0
  const maxD = (teams[teams.length-1]?.avg??base) - base || 1
  const cScale = d3.scaleLinear<string>().domain([0,maxD]).range(['#4ade80','#ef4444']).interpolate(d3.interpolateRgb)

  return (
    <div className="space-y-2">
      {teams.map((t,i) => {
        const delta = t.avg - base
        const visible = animStep > 0
        return (
          <div key={t.team} className={`flex items-center gap-3 transition-all duration-500 ${visible?'opacity-100 translate-x-0':'opacity-0 translate-x-8'}`}
            style={{transitionDelay:`${i*80}ms`}}>
            <div className="w-5 text-xs font-mono text-white/30 text-right shrink-0">{i+1}</div>
            <div className="w-32 shrink-0">
              <div className="font-bold text-sm" style={{color:t.color}}>{t.team}</div>
              <div className="text-[9px] font-mono text-white/35">{t.drivers.map(d=>d.code).join(' · ')}</div>
            </div>
            <div className="flex-1 h-7 rounded-lg overflow-hidden bg-white/5 relative">
              <div className="h-full rounded-lg transition-all duration-700" style={{
                width: visible ? `${Math.max(3,100-(delta/maxD)*88)}%` : '0%',
                transitionDelay:`${i*80+200}ms`,
                background:`linear-gradient(90deg,${t.color}cc,${t.color}66)`
              }}/>
              <div className="absolute inset-0 flex items-center px-2.5">
                <span className="font-mono font-bold text-xs text-white/90">{fmtSec(t.avg)}</span>
              </div>
            </div>
            <div className="w-20 text-right shrink-0 font-mono font-bold text-xs" style={{color:cScale(delta)}}>
              {delta<0.01?'—':`+${delta.toFixed(3)}s`}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Animation Controller ───────────────────────────────────────────────────
function useAnimation(stats: DriverStats[]) {
  const [playing,   setPlaying]   = useState(false)
  const [phase,     setPhase]     = useState<'idle'|'boxes'|'trace'|'strip'|'done'>('idle')
  const [boxStep,   setBoxStep]   = useState(0)   // 0 = hidden, 1..N = reveal one by one
  const [traceLap,  setTraceLap]  = useState(0)   // current lap in trace animation
  const [stripStep, setStripStep] = useState(0)
  const rafRef = useRef<number | null>(null)
  const startTimeRef = useRef<number>(0)

  const allLaps = stats.length ? d3.extent(stats.flatMap(s=>s.smoothed), p=>p.lap) as [number,number] : [0,60]
  const minLap = allLaps[0], maxLap = allLaps[1]

  const reset = useCallback(() => {
    setPlaying(false); setPhase('idle')
    setBoxStep(0); setTraceLap(minLap); setStripStep(0)
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
  }, [minLap])

  const run = useCallback(() => {
    if (!stats.length) return
    setPlaying(true)
    setBoxStep(0); setTraceLap(minLap); setStripStep(0)
    setPhase('boxes')
    let step = 0
    const N = stats.length

    // Phase 1: reveal boxes one by one (600ms each)
    const revealBoxes = () => {
      step++
      setBoxStep(step)
      if (step < N) {
        setTimeout(revealBoxes, 520)
      } else {
        // Phase 2: animate trace line
        setTimeout(startTrace, 400)
      }
    }

    // Phase 2: trace animation lap by lap
    const startTrace = () => {
      setPhase('trace')
      const lapRange = maxLap - minLap
      const totalMs  = Math.max(4000, lapRange * 70) // ~70ms per lap
      const startT   = performance.now()
      const animTrace = (now: number) => {
        const elapsed = now - startT
        const progress = Math.min(elapsed / totalMs, 1)
        const currentLap = minLap + progress * (maxLap - minLap)
        setTraceLap(currentLap)
        if (progress < 1) {
          rafRef.current = requestAnimationFrame(animTrace)
        } else {
          setTraceLap(maxLap)
          setTimeout(startStrip, 400)
        }
      }
      rafRef.current = requestAnimationFrame(animTrace)
    }

    // Phase 3: reveal strip dots one by one
    let sStep = 0
    const startStrip = () => {
      setPhase('strip')
      const revealStrip = () => {
        sStep++
        setStripStep(sStep)
        if (sStep < N) setTimeout(revealStrip, 420)
        else { setPhase('done'); setPlaying(false) }
      }
      revealStrip()
    }

    revealBoxes()
  }, [stats, minLap, maxLap])

  return { playing, phase, boxStep, traceLap, stripStep, run, reset }
}

// ── Main Page ──────────────────────────────────────────────────────────────
function RacePaceInner() {
  const sp       = useSearchParams()
  const urlYear  = sp.get('y') ? +sp.get('y')! : 2026
  const urlEvent = sp.get('e') ? decodeURIComponent(sp.get('e')!) : 'Chinese Grand Prix'
  const autoLoad = sp.get('autoload') === '1'

  const [year,    setYear]    = useState(urlYear)
  const [event,   setEvent]   = useState(() => {
    const evts = EVENTS_BY_YEAR[urlYear] ?? []
    return evts.find(ev => ev === urlEvent || ev.toLowerCase().includes(urlEvent.toLowerCase()) || ev.replace(' Grand Prix','').toLowerCase()===urlEvent.toLowerCase()) ?? urlEvent
  })
  const [stats,   setStats]   = useState<DriverStats[]>([])
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const [ran,     setRan]     = useState(false)

  const { playing, phase, boxStep, traceLap, stripStep, run, reset } = useAnimation(stats)
  const raceEvents = (EVENTS_BY_YEAR[year] ?? []).filter(e => !e.startsWith('Pre-Season'))

  const load = useCallback(async () => {
    if (!event) return
    reset()
    setLoading(true); setError(null); setStats([])
    const { stats: s, error: e } = await fetchAllRaceLaps(year, event)
    if (e) setError(e)
    else setStats(s)
    setLoading(false)
    setRan(true)
  }, [year, event, reset])

  useEffect(() => { if (autoLoad && !ran) load() }, [autoLoad, ran])

  const fastest = stats[0], slowest = stats[stats.length-1]
  const spread  = stats.length > 1 ? slowest.mean - fastest.mean : 0

  // Phase label
  const phaseLabel: Record<string, string> = {
    idle:  '', boxes: 'Revealing driver pace...', trace: 'Animating race trace...',
    strip: 'Showing lap distribution...', done: 'Animation complete ✓'
  }

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
              Y-axis in <b className="text-primary">seconds</b> · 95s = bottom · 102s = top
            </p>
          </div>
          <div className="flex flex-wrap gap-2 items-end">
            <div>
              <label className="block text-[10px] text-base-content/40 uppercase font-bold mb-1">Year</label>
              <select value={year} onChange={e=>{const y=+e.target.value;setYear(y);setEvent((EVENTS_BY_YEAR[y]?.find(ev=>!ev.startsWith('Pre-Season')))?? '')}}
                className="select select-bordered select-sm select-primary bg-base-200/50 w-24">
                {AVAILABLE_YEARS.map(y=><option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-base-content/40 uppercase font-bold mb-1">Race Event</label>
              <select value={event} onChange={e=>setEvent(e.target.value)} className="select select-bordered select-sm select-primary bg-base-200/50 w-64">
                {raceEvents.map(ev=><option key={ev} value={ev}>{ev}</option>)}
              </select>
            </div>
            <button onClick={load} disabled={loading} className="btn btn-outline btn-primary btn-sm gap-2">
              {loading?<RefreshCw size={13} className="animate-spin"/>:<RefreshCw size={13}/>}
              {loading?'Loading…':'Load Data'}
            </button>
          </div>
        </div>
      </div>

      {error && <div className="alert alert-warning rounded-xl mb-4 text-sm"><span>{error}</span></div>}
      {loading && <div className="flex flex-col items-center justify-center py-24 gap-4"><RefreshCw size={32} className="animate-spin text-primary"/><div className="text-base-content/40">Loading all driver race laps…</div></div>}

      {!loading && stats.length > 0 && (<>

        {/* ── BIG RUN BUTTON BAR ─────────────────────────────────────────── */}
        <div className="rounded-2xl border border-white/[0.08] p-4 mb-4 flex flex-wrap items-center gap-4"
          style={{background:'rgba(255,255,255,0.03)',backdropFilter:'blur(12px)'}}>

          {/* Play / Pause / Reset */}
          <div className="flex items-center gap-3">
            {!playing ? (
              <button onClick={run}
                className="btn btn-primary btn-lg gap-2 font-black text-base shadow-2xl"
                style={{minWidth:180,boxShadow:'0 0 28px hsl(var(--p)/0.45)'}}>
                <Play size={20} fill="currentColor"/> Run Animation ▶
              </button>
            ) : (
              <button className="btn btn-warning btn-lg gap-2 font-black text-base cursor-default" disabled>
                <RefreshCw size={18} className="animate-spin"/> Animating…
              </button>
            )}
            <button onClick={reset} disabled={playing} title="Reset all charts"
              className="btn btn-ghost btn-lg border border-white/20 gap-2 text-base-content/60 hover:text-primary">
              <RotateCcw size={18}/>
            </button>
          </div>

          {/* Phase indicator */}
          <div className="flex-1 min-w-[200px]">
            {phase !== 'idle' && (
              <div>
                <div className="text-xs font-bold text-primary/80 mb-1.5 flex items-center gap-2">
                  {phase !== 'done' && <span className="inline-block w-2 h-2 rounded-full bg-primary animate-pulse"/>}
                  {phaseLabel[phase]}
                </div>
                {/* Progress steps */}
                <div className="flex items-center gap-1.5">
                  {[
                    { id: 'boxes', label: 'Box Plots', done: phase==='trace'||phase==='strip'||phase==='done', active: phase==='boxes' },
                    { id: 'trace', label: 'Race Trace', done: phase==='strip'||phase==='done', active: phase==='trace' },
                    { id: 'strip', label: 'Distribution', done: phase==='done', active: phase==='strip' },
                  ].map((p, i) => (
                    <div key={p.id} className="flex items-center gap-1.5">
                      <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold transition-all duration-300 ${
                        p.done ? 'bg-primary/20 text-primary border border-primary/40' :
                        p.active ? 'bg-primary/10 text-primary border border-primary/30 animate-pulse' :
                        'bg-white/5 text-white/25 border border-white/10'
                      }`}>
                        {p.done ? '✓' : p.active ? '▶' : `${i+1}`} {p.label}
                      </div>
                      {i < 2 && <span className="text-white/20 text-xs">→</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {phase === 'idle' && stats.length > 0 && (
              <p className="text-sm text-base-content/40">Click <b className="text-primary">Run Animation ▶</b> to animate all charts in sequence • Record your screen to capture it</p>
            )}
          </div>

          {/* Record hint */}
          <div className="flex items-center gap-2 text-xs text-base-content/30 border border-white/10 rounded-xl px-3 py-2">
            <Video size={14} className="text-primary/50"/>
            <span>Use screen recorder while animation plays</span>
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          {[
            {label:'Fastest Mean',val:fmtSecF(fastest.mean),sub:fastest.code,color:fastest.color},
            {label:'Slowest Mean',val:fmtSecF(slowest.mean),sub:slowest.code,color:slowest.color},
            {label:'Field Spread',val:`${spread.toFixed(3)}s`,sub:`${fastest.code} → ${slowest.code}`,color:'#a78bfa'},
            {label:'Drivers',val:String(stats.length),sub:'with ≥4 clean laps',color:'#60a5fa'},
          ].map(item => (
            <div key={item.label} className="rounded-xl p-3.5 border border-white/[0.06]" style={{background:'rgba(255,255,255,0.03)'}}>
              <div className="text-[9px] text-base-content/35 font-bold uppercase tracking-widest">{item.label}</div>
              <div className="font-mono font-black text-xl mt-1" style={{color:item.color}}>{item.val}</div>
              <div className="text-[10px] text-base-content/30 mt-0.5 font-mono">{item.sub}</div>
            </div>
          ))}
        </div>

        {/* Box Plots */}
        <div className="rounded-2xl border border-white/[0.06] p-4 sm:p-5 mb-4 overflow-x-auto"
          style={{background:'rgba(255,255,255,0.025)',backdropFilter:'blur(8px)'}}>
          <div className="flex items-center justify-between mb-2">
            <div>
              <h2 className="font-black text-primary uppercase tracking-widest text-sm">Box Plot — Race Pace</h2>
              <p className="text-[10px] text-base-content/35 mt-0.5">Solid = Median · Dashed = Mean · Hover for full stats</p>
            </div>
            <div className="text-[10px] font-mono text-base-content/30">
              {boxStep > 0 ? `${boxStep}/${stats.length} drivers` : 'Press ▶ to animate'}
            </div>
          </div>
          <AnimatedBoxPlot stats={stats} animStep={boxStep} year={year} event={event}/>
        </div>

        {/* Race Trace */}
        <div className="rounded-2xl border border-white/[0.06] p-4 sm:p-5 mb-4"
          style={{background:'rgba(255,255,255,0.025)',backdropFilter:'blur(8px)'}}>
          <div className="flex items-center justify-between mb-2">
            <div>
              <h2 className="font-black text-primary uppercase tracking-widest text-sm">Smoothed Lap-by-Lap Race Pace</h2>
              <p className="text-[10px] text-base-content/35 mt-0.5">Rolling window-3 smoothed · Y-axis in seconds</p>
            </div>
            {traceLap > 0 && <div className="text-[10px] font-mono text-yellow-400/70">Lap {Math.round(traceLap)}</div>}
          </div>
          <AnimatedRaceTrace stats={stats} animLap={traceLap}/>
        </div>

        {/* Strip */}
        <div className="rounded-2xl border border-white/[0.06] p-4 sm:p-5 mb-4 overflow-x-auto"
          style={{background:'rgba(255,255,255,0.025)',backdropFilter:'blur(8px)'}}>
          <h2 className="font-black text-primary uppercase tracking-widest text-sm mb-1">Lap Distribution Strip</h2>
          <p className="text-[10px] text-base-content/35 mb-3">Each dot = 1 lap · Large dot = mean · Dash = median</p>
          <AnimatedStrip stats={stats} animStep={stripStep}/>
        </div>

        {/* Constructor — slides in when done */}
        <div className={`rounded-2xl border border-white/[0.06] p-4 sm:p-5 mb-4 transition-all duration-700 ${phase==='done'||phase==='strip'?'opacity-100 translate-y-0':'opacity-0 translate-y-4'}`}
          style={{background:'rgba(255,255,255,0.025)',backdropFilter:'blur(8px)'}}>
          <h2 className="font-black text-primary uppercase tracking-widest text-sm mb-4">Constructor Race Pace</h2>
          <ConstructorBars stats={stats} animStep={stripStep}/>
        </div>

        {/* Driver cards */}
        <div className="rounded-2xl border border-white/[0.06] p-4 sm:p-5 mb-4"
          style={{background:'rgba(255,255,255,0.025)',backdropFilter:'blur(8px)'}}>
          <h2 className="font-black text-primary uppercase tracking-widest text-sm mb-3">Driver Rankings</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-2">
            {stats.map((s,i) => (
              <div key={s.code} className={`rounded-xl border overflow-hidden transition-all duration-500 ${i<boxStep?'opacity-100 scale-100':'opacity-0 scale-95'}`}
                style={{borderColor:`${s.color}30`,background:`linear-gradient(135deg,${s.color}12 0%,rgba(5,10,25,0.9) 60%)`,transitionDelay:`${i*40}ms`}}>
                <div className="h-0.5" style={{background:s.color}}/>
                <div className="p-2 flex items-start gap-2">
                  <div className="relative shrink-0">
                    {s.url ? <img src={`/api/driver-img?url=${encodeURIComponent(s.url)}`} alt={s.code} className="w-9 h-9 rounded-full object-cover object-top" style={{border:`2px solid ${s.color}66`}} onError={e=>{(e.target as HTMLImageElement).style.display='none'}}/> :
                      <div className="w-9 h-9 rounded-full flex items-center justify-center font-black text-sm" style={{background:`${s.color}25`,color:s.color,border:`2px solid ${s.color}55`}}>{s.code[0]}</div>}
                    <div className="absolute -top-1 -left-1 w-4 h-4 rounded-full flex items-center justify-center text-[7px] font-black shadow"
                      style={{background:i<3?'#fbbf24':i<10?s.color:'rgba(255,255,255,0.15)',color:i<8?'#000':'#fff'}}>{i+1}</div>
                  </div>
                  <div className="min-w-0">
                    <div className="font-mono font-black text-xs" style={{color:s.color}}>{s.code}</div>
                    <div className="text-[8px] text-white/35 truncate">{s.team.split(' ')[0]}</div>
                    <div className="font-mono font-bold text-[11px] text-white/80 mt-0.5">{fmtSec(s.mean)}</div>
                    <div className="font-mono text-[9px]" style={{color:i===0?'#4ade80':'rgba(248,113,113,0.8)'}}>
                      {i===0?'FASTEST':`+${(s.mean-fastest.mean).toFixed(3)}s`}
                    </div>
                    <div className="font-mono text-[8px] text-white/30">{s.tyreStrategy}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Data Table */}
        <div className="rounded-2xl border border-white/[0.06] mb-4 overflow-hidden"
          style={{background:'rgba(255,255,255,0.025)',backdropFilter:'blur(8px)'}}>
          <div className="px-5 py-3 border-b border-white/[0.06]">
            <h2 className="font-black text-primary uppercase tracking-widest text-sm">Full Statistics (seconds)</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="table table-sm w-full font-mono">
              <thead><tr className="text-primary/60 text-[10px] bg-base-300/20">
                <th>P</th><th>Code</th><th>Driver</th><th>Team</th>
                <th>Mean (s)</th><th>Median (s)</th><th>Q1</th><th>Q3</th><th>IQR</th><th>Laps</th><th>Tyres</th><th>Δ Best</th>
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
                    <td style={{color:i===0?'#4ade80':'#f87171'}}>{i===0?'—':`+${(s.mean-fastest.mean).toFixed(3)}s`}</td>
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
            style={{boxShadow:'0 0 32px hsl(var(--p)/0.4)', minWidth:240}}>
            <TrendingUp size={22}/> Load Race Data ▶
          </button>
        </div>
      )}
    </div>
  )
}

export default function RacePacePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-24"><span className="loading loading-spinner loading-lg text-primary"/></div>}>
      <RacePaceInner/>
    </Suspense>
  )
}
