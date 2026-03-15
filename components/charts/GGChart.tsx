'use client'
import { useEffect, useRef } from 'react'
import * as d3 from 'd3'
import type { DriverData } from '@/lib/api'

export function GGChart({ drivers }: { drivers: DriverData[] }) {
  const ref = useRef<SVGSVGElement>(null)
  const roRef = useRef<ResizeObserver|null>(null)

  function draw() {
    const svg = d3.select(ref.current!)
    svg.selectAll('*').remove()
    if (!ref.current) return
    const withTel = drivers.filter(d => d.tel.length > 0)
    if (!withTel.length) {
      svg.attr('width',200).attr('height',36)
      svg.append('text').attr('x',8).attr('y',22).attr('fill','rgba(255,255,255,0.2)').attr('font-size',11).text('Load telemetry first — click a lap above.')
      return
    }
    const W = ref.current.parentElement!.clientWidth || 500
    const size = Math.min(W, 420), m = {t:20,r:20,b:40,l:44}, iS = size-m.l-m.r
    svg.attr('width',size).attr('height',size)
    const g = svg.append('g').attr('transform',`translate(${m.l},${m.t})`)
    const allX = withTel.flatMap(d=>d.tel.map(p=>p.acc_y))
    const allY = withTel.flatMap(d=>d.tel.map(p=>p.acc_x))
    const ext = Math.max(d3.max([...allX,...allY].map(Math.abs))??30,8)
    const xScale = d3.scaleLinear().domain([-ext,ext]).range([0,iS])
    const yScale = d3.scaleLinear().domain([-ext,ext]).range([iS,0])
    g.append('line').attr('x1',0).attr('x2',iS).attr('y1',yScale(0)).attr('y2',yScale(0)).attr('stroke','rgba(255,255,255,0.1)')
    g.append('line').attr('x1',xScale(0)).attr('x2',xScale(0)).attr('y1',0).attr('y2',iS).attr('stroke','rgba(255,255,255,0.1)')
    g.append('g').attr('transform',`translate(0,${iS})`).call(d3.axisBottom(xScale).ticks(5)).selectAll('text').attr('fill','rgba(255,255,255,0.3)').attr('font-size',9)
    g.append('g').call(d3.axisLeft(yScale).ticks(5)).selectAll('text').attr('fill','rgba(255,255,255,0.3)').attr('font-size',9)
    g.append('text').attr('x',iS/2).attr('y',iS+36).attr('text-anchor','middle').attr('fill','rgba(255,255,255,0.25)').attr('font-size',9).text('Lateral G (acc_y)')
    withTel.forEach(d => {
      const s = d.tel.filter((_,i)=>i%2===0)
      g.selectAll(null).data(s).enter().append('circle')
        .attr('cx',p=>xScale(p.acc_y)).attr('cy',p=>yScale(p.acc_x))
        .attr('r',1.5).attr('fill',d.color).attr('opacity',0.4)
    })
  }

  useEffect(() => {
    draw()
    roRef.current?.disconnect()
    roRef.current = new ResizeObserver(draw)
    if (ref.current?.parentElement) roRef.current.observe(ref.current.parentElement)
    return () => roRef.current?.disconnect()
  }, [drivers])

  return <svg ref={ref} className="w-full"/>
}
