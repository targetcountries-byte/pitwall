'use client'
import { useEffect, useRef } from 'react'
import * as d3 from 'd3'
import type { DriverData } from '@/lib/api'

export function PositionChart({ drivers }: { drivers: DriverData[] }) {
  const ref = useRef<SVGSVGElement>(null)
  const roRef = useRef<ResizeObserver|null>(null)

  function draw() {
    const svg = d3.select(ref.current!)
    svg.selectAll('*').remove()
    if (!ref.current) return
    const withPos = drivers.filter(d => d.laps.some(l => l.pos > 0))
    if (!withPos.length) {
      svg.attr('width', 200).attr('height', 36)
      svg.append('text').attr('x',8).attr('y',22).attr('fill','rgba(255,255,255,0.2)').attr('font-size',11)
        .text('Position data not available for this session type.')
      return
    }
    const W = ref.current.parentElement!.clientWidth || 900
    const m = { t:16, r:56, b:36, l:36 }, iW = W-m.l-m.r, iH = 240
    svg.attr('width',W).attr('height',iH+m.t+m.b)
    const g = svg.append('g').attr('transform',`translate(${m.l},${m.t})`)
    const maxLap = d3.max(withPos, d => d3.max(d.laps, l => l.lap)) ?? 1
    const maxPos = d3.max(withPos, d => d3.max(d.laps, l => l.pos)) ?? 20
    const xScale = d3.scaleLinear().domain([1, maxLap]).range([0, iW])
    const yScale = d3.scaleLinear().domain([0.5, maxPos+0.5]).range([0, iH])
    g.append('g').call(d3.axisLeft(yScale).ticks(maxPos).tickFormat(d3.format('d'))).selectAll('text').attr('fill','rgba(255,255,255,0.3)').attr('font-size',9)
    g.append('g').attr('transform',`translate(0,${iH})`).call(d3.axisBottom(xScale).ticks(Math.min(maxLap,20)).tickFormat(d3.format('d'))).selectAll('text').attr('fill','rgba(255,255,255,0.3)').attr('font-size',9)
    g.selectAll('.domain').attr('stroke','rgba(255,255,255,0.1)')
    const lineGen = d3.line<{lap:number;pos:number}>().x(p=>xScale(p.lap)).y(p=>yScale(p.pos)).curve(d3.curveStepAfter)
    withPos.forEach(d => {
      const pts = d.laps.filter(l=>l.pos>0).sort((a,b)=>a.lap-b.lap).map(l=>({lap:l.lap,pos:l.pos}))
      g.append('path').datum(pts).attr('fill','none').attr('stroke',d.color).attr('stroke-width',2).attr('opacity',0.85).attr('d',lineGen as any)
      if (pts.length) {
        const last = pts[pts.length-1]
        g.append('text').attr('x',xScale(last.lap)+6).attr('y',yScale(last.pos)+4).attr('fill',d.color).attr('font-size',10).attr('font-family','monospace').attr('font-weight','bold').text(d.code)
      }
    })
  }

  useEffect(() => {
    draw()
    roRef.current?.disconnect()
    roRef.current = new ResizeObserver(draw)
    if (ref.current?.parentElement) roRef.current.observe(ref.current.parentElement)
    return () => roRef.current?.disconnect()
  }, [drivers])

  return <svg ref={ref} className="w-full" id="position-changes-chart"/>
}
