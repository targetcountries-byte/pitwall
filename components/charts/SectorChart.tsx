'use client'
import { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'
import type { DriverData } from '@/lib/api'
import { TRACK_STATUS } from '@/lib/constants'

type Sector = 's1' | 's2' | 's3'
const SCOL: Record<Sector, string> = { s1: '#60a5fa', s2: '#4ade80', s3: '#f472b6' }

export function SectorChart({ drivers }: { drivers: DriverData[] }) {
  const ref = useRef<SVGSVGElement>(null)
  const tipRef = useRef<HTMLDivElement>(null)
  const roRef = useRef<ResizeObserver | null>(null)
  const [sectors, setSectors] = useState<Sector[]>(['s1', 's2', 's3'])

  function draw() {
    const svg = d3.select(ref.current!)
    svg.selectAll('*').remove()
    if (!drivers.length || !ref.current) return

    const W = ref.current.parentElement!.clientWidth || 900
    const m = { t: 16, r: 20, b: 40, l: 60 }
    const iW = W - m.l - m.r, iH = 240
    svg.attr('width', W).attr('height', iH + m.t + m.b)
    const g = svg.append('g').attr('transform', `translate(${m.l},${m.t})`)

    const maxLap = d3.max(drivers, d => d3.max(d.laps, l => l.lap)) ?? 1
    const xScale = d3.scaleLinear().domain([0.5, maxLap + 0.5]).range([0, iW])

    // Collect sector values
    type Pt = { lap: number; val: number; code: string; color: string; sector: Sector; status: string }
    const pts: Pt[] = []
    drivers.forEach(d => {
      d.laps.forEach(l => {
        sectors.forEach(s => {
          const v = l[s] as number | null
          if (v != null && v > 0) {
            pts.push({ lap: l.lap, val: v, code: d.code, color: d.color, sector: s, status: l.status ?? '1' })
          }
        })
      })
    })

    if (!pts.length) return

    const [yMin, yMax] = d3.extent(pts, p => p.val) as [number, number]
    const yPad = (yMax - yMin) * 0.08 || 0.5
    const yScale = d3.scaleLinear().domain([yMax + yPad, yMin - yPad]).range([iH, 0])

    // Track status bands (like TI's yellow/red shading)
    if (drivers[0]) {
      drivers[0].laps.forEach(l => {
        if (!l.status || l.status === '1') return
        const cfg = TRACK_STATUS[l.status]
        if (!cfg || l.status === '1') return
        g.append('rect')
          .attr('x', xScale(l.lap - 0.5)).attr('width', Math.max(1, xScale(l.lap + 0.5) - xScale(l.lap - 0.5)))
          .attr('y', 0).attr('height', iH).attr('fill', cfg.color).attr('pointer-events', 'none')
      })
    }

    // Grid
    g.append('g').call(d3.axisLeft(yScale).ticks(5).tickSize(-iW).tickFormat(() => ''))
      .selectAll('line').attr('stroke', 'rgba(255,255,255,0.04)').attr('stroke-dasharray', '3,4')
    g.selectAll('.domain').remove()

    // Axes
    g.append('g').attr('transform', `translate(0,${iH})`).call(
      d3.axisBottom(xScale).ticks(Math.min(maxLap, 20)).tickFormat(d3.format('d'))
    ).selectAll('text').attr('fill', 'rgba(255,255,255,0.3)').attr('font-size', 9)

    g.append('g').call(
      d3.axisLeft(yScale).ticks(5).tickFormat(d => d3.format('.3f')(+d))
    ).selectAll('text').attr('fill', 'rgba(255,255,255,0.3)').attr('font-size', 8)

    // Smooth lines per driver per sector
    if (drivers.length <= 6) {
      drivers.forEach(d => {
        sectors.forEach(s => {
          const dPts = d.laps.filter(l => (l[s] as number | null) != null && (l[s] as number) > 0)
            .sort((a, b) => a.lap - b.lap)
          if (dPts.length < 2) return
          const line = d3.line<typeof dPts[0]>()
            .x(l => xScale(l.lap)).y(l => yScale(l[s] as number))
            .curve(d3.curveMonotoneX)
          g.append('path').datum(dPts).attr('fill', 'none')
            .attr('stroke', SCOL[s]).attr('stroke-width', 1).attr('opacity', 0.2)
            .attr('d', line as any)
        })
      })
    }

    // Dots
    pts.forEach(p => {
      const cx = xScale(p.lap), cy = yScale(p.val)
      const col = SCOL[p.sector]
      g.append('circle').attr('cx', cx).attr('cy', cy).attr('r', 4)
        .attr('fill', col).attr('fill-opacity', 0.7)
        .attr('stroke', p.color).attr('stroke-width', 1.2)
        .attr('cursor', 'pointer')
        .on('mouseover', function (e) {
          d3.select(this).attr('r', 6).attr('fill-opacity', 1)
          if (!tipRef.current) return
          const rect = ref.current!.getBoundingClientRect()
          tipRef.current.style.display = 'block'
          tipRef.current.style.left = `${e.clientX - rect.left + 10}px`
          tipRef.current.style.top = `${e.clientY - rect.top - 50}px`
          tipRef.current.innerHTML = `
            <div style="color:${p.color}" class="font-mono font-bold text-xs">${p.code} · Lap ${p.lap}</div>
            <div style="color:${col}" class="font-bold">${p.sector.toUpperCase()}: ${p.val.toFixed(3)}s</div>
          `
        })
        .on('mouseout', function () {
          d3.select(this).attr('r', 4).attr('fill-opacity', 0.7)
          if (tipRef.current) tipRef.current.style.display = 'none'
        })
    })

    // Legend
    const legend = svg.append('g').attr('transform', `translate(${m.l}, ${iH + m.t + 26})`)
    const sectors3: Sector[] = ['s1', 's2', 's3']
    sectors3.forEach((s, i) => {
      legend.append('circle').attr('cx', i * 70 + 5).attr('r', 4).attr('fill', SCOL[s])
      legend.append('text').attr('x', i * 70 + 13).attr('y', 4)
        .attr('fill', SCOL[s]).attr('font-size', 9).text(s.toUpperCase())
    })
    drivers.forEach((d, i) => {
      legend.append('circle').attr('cx', 3 * 70 + i * 48 + 5).attr('r', 4).attr('fill', d.color)
      legend.append('text').attr('x', 3 * 70 + i * 48 + 13).attr('y', 4)
        .attr('fill', d.color).attr('font-size', 9).attr('font-family', 'monospace').text(d.code)
    })
  }

  useEffect(() => {
    draw()
    roRef.current?.disconnect()
    roRef.current = new ResizeObserver(draw)
    if (ref.current?.parentElement) roRef.current.observe(ref.current.parentElement)
    return () => roRef.current?.disconnect()
  }, [drivers, sectors])

  return (
    <div className="w-full" id="sector-chart-section">
      <div className="flex gap-2 mb-3">
        {(['s1', 's2', 's3'] as Sector[]).map(s => (
          <button key={s} onClick={() => setSectors(p => p.includes(s) ? p.filter(x => x !== s) : [...p, s])}
            className="btn btn-xs font-mono uppercase font-bold"
            style={sectors.includes(s)
              ? { backgroundColor: SCOL[s] + '33', borderColor: SCOL[s], color: SCOL[s], border: '1px solid' }
              : { border: '1px solid rgba(255,255,255,0.15)', opacity: 0.4 }}>
            ● {s}
          </button>
        ))}
      </div>
      <div className="relative">
        <svg ref={ref} className="w-full" id="sector-chart"/>
        <div ref={tipRef} className="chart-tooltip hidden pointer-events-none"/>
      </div>
    </div>
  )
}
