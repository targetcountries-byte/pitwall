'use client'
import { useEffect, useRef } from 'react'
import * as d3 from 'd3'
import type { DriverData } from '@/lib/api'
import { COMPOUND_COLORS } from '@/lib/constants'

export function TyreStrategyChart({ drivers }: { drivers: DriverData[] }) {
  const ref = useRef<SVGSVGElement>(null)
  const roRef = useRef<ResizeObserver | null>(null)

  function draw() {
    const svg = d3.select(ref.current!)
    svg.selectAll('*').remove()
    if (!drivers.length || !ref.current) return

    const W = ref.current.parentElement!.clientWidth || 900
    const rowH = 26, m = { t: 8, r: 80, b: 28, l: 52 }
    const iW = W - m.l - m.r, iH = drivers.length * rowH
    svg.attr('width', W).attr('height', iH + m.t + m.b)
    const g = svg.append('g').attr('transform', `translate(${m.l},${m.t})`)

    const maxLap = d3.max(drivers, d => d3.max(d.laps, l => l.lap)) ?? 1
    const xScale = d3.scaleLinear().domain([0, maxLap]).range([0, iW])
    const yScale = d3.scaleBand().domain(drivers.map(d => d.code)).range([0, iH]).padding(0.28)

    // Grid lines
    g.append('g').call(d3.axisBottom(xScale).ticks(Math.min(maxLap, 20)).tickSize(iH).tickFormat(() => ''))
      .selectAll('line').attr('stroke', 'rgba(255,255,255,0.04)')
    g.selectAll('.domain').remove()

    g.append('g').attr('transform', `translate(0,${iH})`).call(
      d3.axisBottom(xScale).ticks(Math.min(maxLap, 20)).tickFormat(d3.format('d'))
    ).selectAll('text').attr('fill', 'rgba(255,255,255,0.3)').attr('font-size', 9)

    g.append('g').call(d3.axisLeft(yScale)).selectAll('text').each(function (code) {
      const d = drivers.find(dr => dr.code === code)
      d3.select(this).attr('fill', d?.color ?? '#888').attr('font-family', 'monospace')
        .attr('font-size', 10).attr('font-weight', 'bold')
    })

    drivers.forEach(d => {
      const bw = yScale.bandwidth(), y0 = yScale(d.code) ?? 0
      const stints = d3.group(d.laps.filter(l => l.time !== null), l => l.stint)

      stints.forEach(laps => {
        const sorted = laps.sort((a, b) => a.lap - b.lap)
        const first = sorted[0], last = sorted[sorted.length - 1]
        const col = COMPOUND_COLORS[first.compound] ?? '#888'
        const x1 = xScale(first.lap - 1), x2 = xScale(last.lap)
        const blen = Math.max(5, x2 - x1)

        // Main compound bar
        g.append('rect').attr('x', x1).attr('width', blen).attr('y', y0).attr('height', bw).attr('rx', 3)
          .attr('fill', col).attr('fill-opacity', 0.22).attr('stroke', col).attr('stroke-width', 1.8)

        // Compound letter + lap count
        if (blen > 28) {
          g.append('text').attr('x', x1 + blen / 2).attr('y', y0 + bw / 2 + 3.5)
            .attr('text-anchor', 'middle').attr('fill', col).attr('font-size', 9).attr('font-weight', 'bold')
            .text(`${first.compound[0]} (${sorted.length})`)
        }

        // Dots for each lap
        sorted.forEach(lap => {
          const cx = xScale(lap.lap - 0.5)
          if (lap.fresh && lap.lap === first.lap) {
            g.append('circle').attr('cx', cx).attr('cy', y0 + bw / 2).attr('r', 3)
              .attr('fill', '#22c55e').attr('stroke', '#000').attr('stroke-width', 0.5)
          } else {
            g.append('circle').attr('cx', cx).attr('cy', y0 + bw / 2).attr('r', 1.8)
              .attr('fill', 'rgba(255,255,255,0.25)')
          }
          if (lap.pb) {
            g.append('circle').attr('cx', cx).attr('cy', y0 + bw / 2).attr('r', 3.5)
              .attr('fill', 'none').attr('stroke', 'rgba(200,50,200,0.7)').attr('stroke-width', 1)
          }
        })
      })
    })

    // Legend
    const legG = svg.append('g').attr('transform', `translate(${m.l}, ${iH + m.t + 16})`)
    const compounds = ['SOFT', 'MEDIUM', 'HARD', 'INTER', 'WET']
    compounds.forEach((c, i) => {
      const col = COMPOUND_COLORS[c]
      legG.append('rect').attr('x', i * 70).attr('width', 10).attr('height', 10).attr('rx', 2)
        .attr('fill', col).attr('opacity', 0.8)
      legG.append('text').attr('x', i * 70 + 13).attr('y', 9).attr('fill', col).attr('font-size', 9).text(c)
    })
    legG.append('circle').attr('cx', 5 * 70 + 5).attr('cy', 5).attr('r', 3).attr('fill', '#22c55e')
    legG.append('text').attr('x', 5 * 70 + 13).attr('y', 9).attr('fill', '#22c55e').attr('font-size', 9).text('FRESH')
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
