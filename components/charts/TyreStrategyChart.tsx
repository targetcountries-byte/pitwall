'use client'
import { useEffect, useRef } from 'react'
import * as d3 from 'd3'
import type { DriverData } from '@/lib/api'
import { COMPOUND_COLORS } from '@/lib/constants'

export function TyreStrategyChart({ drivers }: { drivers: DriverData[] }) {
  const ref = useRef<SVGSVGElement>(null)
  const roRef = useRef<ResizeObserver|null>(null)

  function draw() {
    const svg = d3.select(ref.current!)
    svg.selectAll('*').remove()
    if (!drivers.length || !ref.current) return
    const W = ref.current.parentElement!.clientWidth || 900
    const rowH = 28, m = { t: 8, r: 80, b: 32, l: 56 }
    const iW = W - m.l - m.r, iH = drivers.length * rowH
    svg.attr('width', W).attr('height', iH + m.t + m.b)
    const g = svg.append('g').attr('transform', `translate(${m.l},${m.t})`)
    const maxLap = d3.max(drivers, d => d3.max(d.laps, l => l.lap)) ?? 1
    const xScale = d3.scaleLinear().domain([0, maxLap]).range([0, iW])
    const yScale = d3.scaleBand().domain(drivers.map(d => d.code)).range([0, iH]).padding(0.3)

    g.append('g').attr('transform', `translate(0,${iH})`).call(
      d3.axisBottom(xScale).ticks(Math.min(maxLap,20)).tickFormat(d3.format('d'))
    ).selectAll('text').attr('fill','rgba(255,255,255,0.3)').attr('font-size',9)

    g.append('g').call(d3.axisLeft(yScale))
      .selectAll('text').each(function(code) {
        const d = drivers.find(dr => dr.code === code)
        d3.select(this).attr('fill', d?.color ?? '#888').attr('font-family','monospace').attr('font-size',11).attr('font-weight','bold')
      })

    drivers.forEach(d => {
      const bw = yScale.bandwidth()
      const y0 = yScale(d.code) ?? 0
      const stints = d3.group(d.laps.filter(l=>l.time!==null), l => l.stint)
      stints.forEach(laps => {
        const sorted = laps.sort((a,b)=>a.lap-b.lap)
        const first = sorted[0], last = sorted[sorted.length-1]
        const col = COMPOUND_COLORS[first.compound] ?? '#888'
        const x1 = xScale(first.lap-1), x2 = xScale(last.lap)
        const blen = Math.max(4, x2-x1)
        g.append('rect').attr('x',x1).attr('width',blen).attr('y',y0).attr('height',bw).attr('rx',3)
          .attr('fill',col).attr('fill-opacity',0.25).attr('stroke',col).attr('stroke-width',1.5)
        if (blen > 25) {
          g.append('text').attr('x',x1+blen/2).attr('y',y0+bw/2+4).attr('text-anchor','middle')
            .attr('fill',col).attr('font-size',9).attr('font-weight','bold')
            .text(`${first.compound[0]} (${sorted.length})`)
        }
      })
    })
  }

  useEffect(() => {
    draw()
    roRef.current?.disconnect()
    roRef.current = new ResizeObserver(draw)
    if (ref.current?.parentElement) roRef.current.observe(ref.current.parentElement)
    return () => roRef.current?.disconnect()
  }, [drivers])

  return <svg ref={ref} className="w-full" id="tyre-strategy-chart"/>
}
