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
  const m = Math.floor(t / 60), s = (t % 60).toFixed(3).padStart(6, '0')
  return m > 0 ? `${m}:${s}` : (t % 60).toFixed(3)
}

export function LapChart({ drivers, fuelCorr, hideOutliers, smooth, showTrackStatus, onLapClick, selectedLapKeys }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const tipRef = useRef<HTMLDivElement>(null)
  const roRef  = useRef<ResizeObserver | null>(null)

  function draw() {
    if (!svgRef.current || !drivers.length) return
    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const W = svgRef.current.parentElement!.clientWidth || 900
    const m = { t: 28, r: 24, b: 48, l: 64 }
    const iW = W - m.l - m.r, iH = 380

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
    const yPad = (yMax - yMin) * 0.10 || 0.5
    const yScale = d3.scaleLinear().domain([yMax + yPad, yMin - yPad]).range([iH, 0])

    // Gradient background per compound stint
    const defs = svg.append('defs')
    const bgGrad = defs.append('linearGradient').attr('id', 'chartBg').attr('x1','0').attr('x2','0').attr('y1','0').attr('y2','1')
    bgGrad.append('stop').attr('offset','0%').attr('stop-color','rgba(255,255,255,0.04)')
    bgGrad.append('stop').attr('offset','100%').attr('stop-color','rgba(255,255,255,0)')
    g.append('rect').attr('width', iW).attr('height', iH).attr('fill','url(#chartBg)').attr('rx', 4)

    // Track status bands (with gradient opacity)
    if (showTrackStatus && drivers[0]) {
      drivers[0].laps.forEach(l => {
        if (!l.status || l.status === '1') return
        const cfg = TRACK_STATUS[l.status]
        if (!cfg) return
        const x1 = xScale(l.lap - 0.5), bw = xScale(l.lap + 0.5) - x1
        // Add gradient band
        const gid = `ts${l.lap}`
        const grad = defs.append('linearGradient').attr('id', gid).attr('x1','0').attr('x2','0').attr('y1','0').attr('y2','1')
        grad.append('stop').attr('offset','0%').attr('stop-color', cfg.color.replace('rgba','rgba').replace(',0.', ',0.'))
        grad.append('stop').attr('offset','100%').attr('stop-color', cfg.color.replace(',0.12)',',0.04)').replace(',0.10)',',0.03)').replace(',0.14)',',0.05)'))
        g.append('rect').attr('x', x1).attr('width', Math.max(1, bw))
          .attr('y', 0).attr('height', iH).attr('fill', `url(#${gid})`).attr('pointer-events', 'none')
      })
    }

    // Grid lines (subtle)
    g.append('g').call(d3.axisLeft(yScale).ticks(6).tickSize(-iW).tickFormat(() => ''))
      .selectAll('line').attr('stroke', 'rgba(255,255,255,0.04)').attr('stroke-dasharray', '3,5')
    g.append('g').call(d3.axisBottom(xScale).ticks(Math.min(xMax, 20)).tickSize(-iH).tickFormat(() => ''))
      .selectAll('line').attr('stroke', 'rgba(255,255,255,0.03)').attr('stroke-dasharray', '3,8')
    g.selectAll('.domain').remove()

    // Axes
    const axStyle = (sel: d3.Selection<any,any,any,any>) =>
      sel.selectAll('text').attr('fill', 'rgba(255,255,255,0.3)').attr('font-size', 10).attr('font-family', 'monospace')
    g.append('g').attr('transform', `translate(0,${iH})`).call(
      d3.axisBottom(xScale).ticks(Math.min(xMax, 20)).tickFormat(d3.format('d'))
    ).call(axStyle)
    g.append('g').call(
      d3.axisLeft(yScale).ticks(6).tickFormat(t => fmt(+t))
    ).call(axStyle)

    // Axis labels
    g.append('text').attr('x', iW / 2).attr('y', iH + 40).attr('text-anchor', 'middle')
      .attr('fill', 'rgba(255,255,255,0.18)').attr('font-size', 10).text('Lap')
    g.append('text').attr('transform', 'rotate(-90)').attr('x', -iH / 2).attr('y', -50)
      .attr('text-anchor', 'middle').attr('fill', 'rgba(255,255,255,0.18)').attr('font-size', 10).text('Lap Time')

    // Smooth trend lines per driver
    if (smooth) {
      const line = d3.line<Pt>().x(a => xScale(a.lap.lap)).y(a => yScale(a.t)).curve(d3.curveMonotoneX)
      drivers.forEach(d => {
        const pts = vis.filter(a => a.code === d.code && !a.lap.del).sort((a, b) => a.lap.lap - b.lap.lap)
        if (pts.length < 2) return
        // Shadow line for depth
        g.append('path').datum(pts).attr('fill', 'none')
          .attr('stroke', '#000').attr('stroke-width', 4).attr('stroke-opacity', 0.2)
          .attr('d', line as any).attr('pointer-events', 'none')
        g.append('path').datum(pts).attr('fill', 'none')
          .attr('stroke', d.color).attr('stroke-width', 2).attr('stroke-opacity', 0.4)
          .attr('d', line as any).attr('pointer-events', 'none')
      })
    }

    // Dots — per compound with driver color border
    vis.forEach(a => {
      const sel = selectedLapKeys.includes(`${a.code}-${a.lap.lap}`)
      const cc = COMPOUND_COLORS[a.lap.compound] ?? '#888'
      const cx = xScale(a.lap.lap), cy = yScale(a.t)
      const r = sel ? 8 : 5.5

      if (a.lap.del) return // hide deleted laps entirely

      // PB ring (purple dashed)
      if (a.lap.pb) {
        g.append('circle').attr('cx', cx).attr('cy', cy).attr('r', r + 4)
          .attr('fill', 'none').attr('stroke', '#c084fc').attr('stroke-width', 1.5)
          .attr('stroke-dasharray', '3,2.5').attr('opacity', 0.7).attr('pointer-events', 'none')
      }

      // Selected highlight
      if (sel) {
        g.append('circle').attr('cx', cx).attr('cy', cy).attr('r', r + 3)
          .attr('fill', a.color).attr('fill-opacity', 0.2).attr('pointer-events', 'none')
      }

      // Main dot
      g.append('circle').attr('cx', cx).attr('cy', cy).attr('r', r)
        .attr('fill', cc).attr('stroke', a.color).attr('stroke-width', sel ? 2.5 : 1.8)
        .attr('opacity', a.lap.pb ? 1 : 0.9)
        .attr('filter', sel ? 'drop-shadow(0 0 4px currentColor)' : 'none')
        .attr('class', 'lap-dot').attr('cursor', 'pointer')
        .on('mouseover', function(e) {
          d3.select(this).transition().duration(80).attr('r', r + 3)
          if (!tipRef.current) return
          const rect = svgRef.current!.getBoundingClientRect()
          const tx = e.clientX - rect.left
          const ty = e.clientY - rect.top
          tipRef.current.style.display = 'block'
          tipRef.current.style.left = `${tx + 14}px`
          tipRef.current.style.top  = `${ty - 70}px`
          tipRef.current.innerHTML = `
            <div style="color:${a.color}" class="font-mono font-black text-xs mb-1">${a.code} · Lap ${a.lap.lap}</div>
            <div class="font-mono font-black text-lg text-white">${fmt(a.t)}</div>
            <div class="mt-1 flex gap-2 items-center">
              <span class="px-1.5 py-0.5 rounded text-[9px] font-bold"
                style="background:${cc}33;color:${cc};border:1px solid ${cc}66">
                ${a.lap.compound[0]} · ${a.lap.life}L${a.lap.fresh?' ✦':''}
              </span>
              ${a.lap.pb ? '<span class="text-[9px] text-purple-400">● PB</span>' : ''}
            </div>
            ${a.lap.s1 != null ? `<div class="text-[9px] text-white/40 font-mono mt-1">S1 ${a.lap.s1.toFixed(3)} · S2 ${a.lap.s2?.toFixed(3)} · S3 ${a.lap.s3?.toFixed(3)}</div>` : ''}
            ${a.lap.vfl != null ? `<div class="text-[9px] text-white/30 mt-0.5">FL ${Math.round(a.lap.vfl!)} km/h</div>` : ''}
          `
        })
        .on('mousemove', function(e) {
          if (!tipRef.current || !svgRef.current) return
          const rect = svgRef.current.getBoundingClientRect()
          tipRef.current.style.left = `${e.clientX - rect.left + 14}px`
          tipRef.current.style.top  = `${e.clientY - rect.top - 70}px`
        })
        .on('mouseout', function() {
          d3.select(this).transition().duration(100).attr('r', r)
          if (tipRef.current) tipRef.current.style.display = 'none'
        })
        .on('click', () => onLapClick(a.code, a.lap))
    })

    // Driver labels top of chart
    const labG = svg.append('g').attr('transform', `translate(${m.l + 8}, 14)`)
    drivers.forEach((d, i) => {
      const best = vis.filter(a => a.code === d.code && !a.lap.del).sort((a, b) => a.t - b.t)[0]
      const bestStr = best ? ` ${fmt(best.t)}` : ''
      const lg = labG.append('g').attr('transform', `translate(${i * 110}, 0)`)
      lg.append('circle').attr('r', 5).attr('cy', 0).attr('fill', d.color).attr('opacity', 0.9)
      lg.append('text').attr('x', 8).attr('y', 4).attr('fill', d.color).attr('font-size', 10)
        .attr('font-family', 'monospace').attr('font-weight', 'bold').text(d.code + bestStr)
    })

    // Compound legend bottom right
    const cLeg = svg.append('g').attr('transform', `translate(${W - m.r - 180}, ${iH + m.t + 32})`)
    Object.entries(COMPOUND_COLORS).slice(0, 5).forEach(([comp, col], i) => {
      cLeg.append('circle').attr('cx', i * 34).attr('cy', 0).attr('r', 5).attr('fill', col)
      cLeg.append('text').attr('x', i * 34 + 7).attr('y', 4).attr('fill', col).attr('font-size', 9).text(comp[0])
    })
  }

  useEffect(() => {
    draw()
    roRef.current?.disconnect()
    roRef.current = new ResizeObserver(draw)
    if (svgRef.current?.parentElement) roRef.current.observe(svgRef.current.parentElement)
    return () => roRef.current?.disconnect()
  }, [drivers, fuelCorr, hideOutliers, smooth, showTrackStatus, selectedLapKeys])

  return (
    <div className="relative w-full">
      <svg ref={svgRef} className="w-full overflow-visible"/>
      <div ref={tipRef} className="chart-tooltip hidden" style={{ maxWidth: 220 }}/>
    </div>
  )
}
