'use client'
import { useEffect, useRef } from 'react'
import * as d3 from 'd3'
import type { DriverData } from '@/lib/api'
import { COMPOUND_COLORS } from '@/lib/constants'

export function StintChart({ drivers }: { drivers: DriverData[] }) {
  const ref = useRef<SVGSVGElement>(null)
  const roRef = useRef<ResizeObserver|null>(null)

  function draw() {
    const svg = d3.select(ref.current!)
    svg.selectAll('*').remove()
    if (!drivers.length || !ref.current) return
    const W = ref.current.parentElement!.clientWidth || 900
    const rowH = 34, m = { t: 16, r: 16, b: 36, l: 56 }
    const iW = W - m.l - m.r, iH = drivers.length * rowH
    svg.attr('width', W).attr('height', iH + m.t + m.b)
    const g = svg.append('g').attr('transform', `translate(${m.l},${m.t})`)
    const maxLap = d3.max(drivers, d => d3.max(d.laps, l => l.lap)) ?? 1
    const xScale = d3.scaleLinear().domain([1, maxLap + 1]).range([0, iW])
    const yScale = d3.scaleBand().domain(drivers.map(d => d.code)).range([0, iH]).padding(0.28)

    g.append('g').attr('transform', `translate(0,${iH})`).call(
      d3.axisBottom(xScale).ticks(Math.min(maxLap,20)).tickFormat(d3.format('d'))
    ).selectAll('text').attr('fill','rgba(255,255,255,0.3)').attr('font-size',9)
    g.selectAll('.domain, line').attr('stroke','rgba(255,255,255,0.1)')

    g.append('g').call(d3.axisLeft(yScale))
      .selectAll('text').each(function(code) {
        const d = drivers.find(dr => dr.code === code)
        d3.select(this).attr('fill', d?.color ?? '#888').attr('font-family','monospace').attr('font-size',11).attr('font-weight','bold')
      })

    drivers.forEach(d => {
      const valid = d.laps.filter(l => l.time !== null)
      const stints = d3.group(valid, l => l.stint)
      stints.forEach((laps, stintNum) => {
        const sorted = laps.sort((a,b) => a.lap - b.lap)
        const first = sorted[0], last = sorted[sorted.length-1]
        const col = COMPOUND_COLORS[first.compound] ?? '#888'
        const bw = yScale.bandwidth()
        const y0 = yScale(d.code) ?? 0

        g.append('rect')
          .attr('x', xScale(first.lap) - 1)
          .attr('width', Math.max(3, xScale(last.lap + 1) - xScale(first.lap) + 1))
          .attr('y', y0).attr('height', bw).attr('rx', 3)
          .attr('fill', col).attr('fill-opacity', 0.2)
          .attr('stroke', col).attr('stroke-width', 1.5)

        const barW = xScale(last.lap+1) - xScale(first.lap)
        if (barW > 18) {
          g.append('text')
            .attr('x', xScale(first.lap) + barW/2).attr('y', y0 + bw/2 + 4)
            .attr('text-anchor','middle').attr('fill', col)
            .attr('font-size', 10).attr('font-weight','bold').text(first.compound[0])
        }

        if (+stintNum > 1) {
          g.append('line')
            .attr('x1', xScale(first.lap)).attr('x2', xScale(first.lap))
            .attr('y1', y0-4).attr('y2', y0+bw+4)
            .attr('stroke','rgba(255,255,255,0.5)').attr('stroke-width',1.5).attr('stroke-dasharray','3,2')
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

  return <svg ref={ref} className="w-full"/>
}
