'use client'
import { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'
import type { DriverData } from '@/lib/api'

export function SectorChart({ drivers }: { drivers: DriverData[] }) {
  const ref = useRef<SVGSVGElement>(null)
  const roRef = useRef<ResizeObserver|null>(null)
  const [sectors, setSectors] = useState<('s1'|'s2'|'s3')[]>(['s1','s2','s3'])

  const SCOL = { s1:'#60a5fa', s2:'#4ade80', s3:'#f472b6' }

  function draw() {
    const svg = d3.select(ref.current!)
    svg.selectAll('*').remove()
    if (!drivers.length || !ref.current) return
    const W = ref.current.parentElement!.clientWidth || 900
    const m = { t: 16, r: 16, b: 40, l: 60 }, iW = W-m.l-m.r, iH = 220
    svg.attr('width', W).attr('height', iH+m.t+m.b)
    const g = svg.append('g').attr('transform', `translate(${m.l},${m.t})`)
    const maxLap = d3.max(drivers, d => d3.max(d.laps, l => l.lap)) ?? 1
    const xScale = d3.scaleLinear().domain([0, maxLap+1]).range([0, iW])
    const vals: number[] = []
    drivers.forEach(d => d.laps.forEach(l => sectors.forEach(s => { const v = l[s]; if (v != null) vals.push(v as number) })))
    if (!vals.length) return
    const [yMin, yMax] = d3.extent(vals) as [number,number]
    const yScale = d3.scaleLinear().domain([yMax*1.04, yMin*0.97]).range([iH, 0])

    g.append('g').attr('transform',`translate(0,${iH})`).call(d3.axisBottom(xScale).ticks(Math.min(maxLap,20)).tickFormat(d3.format('d'))).selectAll('text').attr('fill','rgba(255,255,255,0.3)').attr('font-size',9)
    g.append('g').call(d3.axisLeft(yScale).ticks(5).tickFormat(d => d3.format('.3f')(+d))).selectAll('text').attr('fill','rgba(255,255,255,0.3)').attr('font-size',9)
    g.selectAll('.domain').attr('stroke','rgba(255,255,255,0.1)')

    drivers.forEach(d => sectors.forEach(s => {
      const pts = d.laps.filter(l => l[s] != null)
      g.selectAll(null).data(pts).enter().append('circle')
        .attr('cx', l => xScale(l.lap)).attr('cy', l => yScale(l[s] as number))
        .attr('r', 3.5).attr('fill', SCOL[s]).attr('stroke', d.color).attr('stroke-width', 1).attr('opacity', 0.8)
    }))
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
      <div className="flex gap-2 mb-2">
        {(['s1','s2','s3'] as const).map(s => (
          <button key={s} onClick={() => setSectors(p => p.includes(s)?p.filter(x=>x!==s):[...p,s])}
            className={`btn btn-xs font-mono uppercase ${sectors.includes(s)?'btn-primary':'btn-ghost border border-base-300/50'}`}
            style={sectors.includes(s)?{backgroundColor:SCOL[s]+'33',borderColor:SCOL[s],color:SCOL[s]}:{}}>{s}</button>
        ))}
        <div className="ml-2 flex gap-1.5 items-center flex-wrap">
          {drivers.map(d => <span key={d.code} className="text-xs font-mono" style={{color:d.color}}>● {d.code}</span>)}
        </div>
      </div>
      <svg ref={ref} className="w-full" id="sector-chart"/>
    </div>
  )
}
