'use client'
import { useEffect, useRef } from 'react'
import * as d3 from 'd3'
import type { DriverData, LapRow } from '@/lib/api'
import { COMPOUND_COLORS, TRACK_STATUS } from '@/lib/constants'

interface Props {
  drivers: DriverData[]
  fuelCorr: boolean; hideOutliers: boolean; smooth: boolean; showTrackStatus: boolean
  onLapClick: (code: string, lap: LapRow) => void
  selectedLapKeys: string[]
}

function fmt(t: number) {
  const m = Math.floor(t/60), s = (t%60).toFixed(3).padStart(6,'0')
  return m > 0 ? `${m}:${s}` : (t%60).toFixed(3)
}

export function LapChart({ drivers, fuelCorr, hideOutliers, smooth, showTrackStatus, onLapClick, selectedLapKeys }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const tipRef = useRef<HTMLDivElement>(null)
  const roRef  = useRef<ResizeObserver|null>(null)

  function draw() {
    if (!svgRef.current || !drivers.length) return
    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const W = svgRef.current.parentElement!.clientWidth || 900
    const m = { t: 24, r: 24, b: 52, l: 60 }
    const iW = W - m.l - m.r, iH = 400

    svg.attr('width', W).attr('height', iH + m.t + m.b)
    const g = svg.append('g').attr('transform', `translate(${m.l},${m.t})`)

    // Collect laps
    type Pt = { code: string; color: string; lap: LapRow; t: number }
    const all: Pt[] = []
    drivers.forEach(d => d.laps.forEach(l => {
      if (l.time === null) return
      const t = fuelCorr ? l.time + (l.lap - 1) * 0.048 : l.time
      all.push({ code: d.code, color: d.color, lap: l, t })
    }))
    if (!all.length) return

    const med = d3.median(all, a => a.t) ?? 90
    const vis = hideOutliers ? all.filter(a => a.t <= med * 1.07) : all

    const xMax = d3.max(all, a => a.lap.lap) ?? 1
    const xScale = d3.scaleLinear().domain([0.5, xMax + 0.5]).range([0, iW])
    const [yMin, yMax] = d3.extent(vis, a => a.t) as [number, number]
    const yPad = (yMax - yMin) * 0.08 || 0.5
    const yScale = d3.scaleLinear().domain([yMax + yPad, yMin - yPad]).range([iH, 0])

    // Track status bands
    if (showTrackStatus && drivers[0]) {
      drivers[0].laps.forEach(l => {
        if (!l.status || l.status === '1') return
        const chars = l.status.replace(/[^1-7]/g,'').split('')
        const maxCode = chars.reduce((a,b) => +b > +a ? b : a, '1')
        const cfg = TRACK_STATUS[maxCode]
        if (!cfg || maxCode === '1') return
        g.append('rect')
          .attr('x', xScale(l.lap - 0.5)).attr('width', Math.max(1, xScale(l.lap + 0.5) - xScale(l.lap - 0.5)))
          .attr('y', 0).attr('height', iH).attr('fill', cfg.color).attr('pointer-events', 'none')
      })
    }

    // Grid
    g.append('g').call(d3.axisLeft(yScale).ticks(6).tickSize(-iW).tickFormat(() => ''))
      .selectAll('line').attr('stroke','rgba(255,255,255,0.04)').attr('stroke-dasharray','2,4')
    g.selectAll('.domain').remove()

    // Axes
    const axStyle = (sel: d3.Selection<any,any,any,any>) =>
      sel.selectAll('text').attr('fill','rgba(255,255,255,0.35)').attr('font-size',10)

    g.append('g').attr('transform',`translate(0,${iH})`).call(
      d3.axisBottom(xScale).ticks(Math.min(xMax,20)).tickFormat(d3.format('d'))
    ).call(axStyle)
    g.append('g').call(
      d3.axisLeft(yScale).ticks(6).tickFormat(t => fmt(+t))
    ).call(axStyle)

    // Axis labels
    g.append('text').attr('x', iW/2).attr('y', iH+42).attr('text-anchor','middle')
      .attr('fill','rgba(255,255,255,0.25)').attr('font-size',10).text('Lap Number')
    g.append('text').attr('transform','rotate(-90)').attr('x',-iH/2).attr('y',-48)
      .attr('text-anchor','middle').attr('fill','rgba(255,255,255,0.25)').attr('font-size',10).text('Lap Time')

    // Smooth lines
    if (smooth) {
      const line = d3.line<Pt>().x(a => xScale(a.lap.lap)).y(a => yScale(a.t)).curve(d3.curveMonotoneX)
      drivers.forEach(d => {
        const pts = vis.filter(a => a.code === d.code).sort((a,b) => a.lap.lap - b.lap.lap)
        if (pts.length < 2) return
        g.append('path').datum(pts).attr('fill','none')
          .attr('stroke', d.color).attr('stroke-width',1.5).attr('stroke-opacity',0.35)
          .attr('d', line as any).attr('pointer-events','none')
      })
    }

    // Dots
    vis.forEach(a => {
      const sel = selectedLapKeys.includes(`${a.code}-${a.lap.lap}`)
      const cc = COMPOUND_COLORS[a.lap.compound] ?? '#888'
      const cx = xScale(a.lap.lap), cy = yScale(a.t)
      const r = sel ? 7.5 : 5

      if (a.lap.pb) {
        g.append('circle').attr('cx',cx).attr('cy',cy).attr('r',r+3.5)
          .attr('fill','none').attr('stroke',a.color).attr('stroke-width',1)
          .attr('stroke-dasharray','2,2').attr('opacity',0.5).attr('pointer-events','none')
      }

      g.append('circle').attr('cx',cx).attr('cy',cy).attr('r',r)
        .attr('fill', cc).attr('stroke', a.color).attr('stroke-width', sel ? 2.5 : 1.5)
        .attr('opacity', a.lap.del ? 0.2 : (a.lap.pb ? 1 : 0.85))
        .attr('class','lap-dot').attr('cursor','pointer')
        .on('mouseover', function(e) {
          d3.select(this).attr('r', r+2.5).attr('opacity',1)
          if (!tipRef.current) return
          const rect = svgRef.current!.getBoundingClientRect()
          tipRef.current.style.display = 'block'
          tipRef.current.style.left = `${e.clientX - rect.left + 12}px`
          tipRef.current.style.top  = `${e.clientY - rect.top - 50}px`
          tipRef.current.innerHTML = `
            <div style="color:${a.color}" class="font-mono font-bold mb-0.5">${a.code} · Lap ${a.lap.lap}</div>
            <div class="font-mono font-bold text-sm">${fmt(a.t)}</div>
            <div style="color:${cc}" class="text-xs mt-0.5">
              ${a.lap.compound[0]} · ${a.lap.life}L${a.lap.fresh?' 🆕':''}
              ${a.lap.pb?' · 🟣 PB':''}${a.lap.del?' · ❌ DEL':''}
            </div>
            ${a.lap.s1 != null ? `<div class="text-xs opacity-50 font-mono mt-0.5">${a.lap.s1.toFixed(3)} / ${a.lap.s2?.toFixed(3)} / ${a.lap.s3?.toFixed(3)}</div>` : ''}
            ${a.lap.vfl != null ? `<div class="text-xs opacity-40 mt-0.5">FL: ${a.lap.vfl} km/h</div>` : ''}
          `
        })
        .on('mousemove', function(e) {
          if (!tipRef.current) return
          const rect = svgRef.current!.getBoundingClientRect()
          tipRef.current.style.left = `${e.clientX - rect.left + 12}px`
          tipRef.current.style.top  = `${e.clientY - rect.top - 50}px`
        })
        .on('mouseout', function() {
          d3.select(this).attr('r', r).attr('opacity', a.lap.del ? 0.2 : 0.85)
          if (tipRef.current) tipRef.current.style.display = 'none'
        })
        .on('click', () => onLapClick(a.code, a.lap))
    })

    // Driver + compound legends
    const dLegend = svg.append('g').attr('transform',`translate(${m.l+8},10)`)
    drivers.forEach((d,i) => {
      const lg = dLegend.append('g').attr('transform',`translate(${i*58},0)`)
      lg.append('circle').attr('r',5).attr('cy',5).attr('fill',d.color).attr('opacity',0.9)
      lg.append('text').attr('x',9).attr('y',9).attr('fill',d.color).attr('font-size',11).attr('font-family','monospace').text(d.code)
    })

    const cLegend = svg.append('g').attr('transform',`translate(${W-m.r-150},10)`)
    Object.entries(COMPOUND_COLORS).slice(0,5).forEach(([c,col],i) => {
      cLegend.append('circle').attr('cx',i*30).attr('cy',5).attr('r',5).attr('fill',col)
      cLegend.append('text').attr('x',i*30+7).attr('y',9).attr('fill',col).attr('font-size',9).text(c[0])
    })
  }

  useEffect(() => {
    draw()
    roRef.current?.disconnect()
    roRef.current = new ResizeObserver(() => draw())
    if (svgRef.current?.parentElement) roRef.current.observe(svgRef.current.parentElement)
    return () => roRef.current?.disconnect()
  }, [drivers, fuelCorr, hideOutliers, smooth, showTrackStatus, selectedLapKeys])

  return (
    <div className="relative w-full">
      <svg ref={svgRef} className="w-full overflow-visible"/>
      <div ref={tipRef} className="chart-tooltip hidden" style={{maxWidth:220}}/>
    </div>
  )
}
