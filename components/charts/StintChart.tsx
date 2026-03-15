'use client'
import { useEffect, useRef } from 'react'
import * as d3 from 'd3'
import type { DriverData } from '@/lib/api'
import { COMPOUND_COLORS } from '@/lib/constants'

function fmtT(t: number | null) {
  if (t == null) return '—'
  const m = Math.floor(t / 60), s = (t % 60).toFixed(3).padStart(6, '0')
  return m > 0 ? `${m}:${s}` : (t % 60).toFixed(3)
}

// Individual driver stint card (matches TI's grid layout in Image 1)
function DriverStintCard({ d }: { d: DriverData }) {
  const stints = d3.group(d.laps.filter(l => l.time !== null), l => l.stint)
  const stintArr = Array.from(stints.entries()).sort((a, b) => +a[0] - +b[0])

  return (
    <div className="rounded-lg border border-white/[0.07] p-2.5"
      style={{ background: 'rgba(0,0,0,0.3)' }}>
      {/* Driver header */}
      <div className="flex items-center gap-1.5 mb-2">
        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: d.color }}/>
        <span className="font-mono font-bold text-xs" style={{ color: d.color }}>{d.code}</span>
        <span className="text-[9px] text-base-content/30 truncate">{d.team}</span>
      </div>

      {/* Stints */}
      {stintArr.map(([stintNum, laps]) => {
        const sorted = laps.sort((a, b) => a.lap - b.lap)
        const first = sorted[0], last = sorted[sorted.length - 1]
        const best = sorted.reduce((b, l) => l.time! < b.time! ? l : b, sorted[0])
        const cc = COMPOUND_COLORS[first.compound] ?? '#888'
        const avg = d3.mean(sorted, l => l.time!) ?? 0

        return (
          <div key={stintNum} className="mb-2 last:mb-0">
            {/* Compound + stint info */}
            <div className="flex items-center gap-1.5 mb-1">
              <span className="w-3 h-3 rounded-full text-[8px] font-bold flex items-center justify-center"
                style={{ background: cc, color: cc === '#f0f0ec' ? '#000' : '#fff' }}>
                {first.compound[0]}
              </span>
              <span className="text-[9px] font-mono" style={{ color: cc }}>
                Stint {stintNum} · {sorted.length}L
                {first.fresh ? ' 🆕' : ''}
              </span>
            </div>

            {/* Lap time mini bars */}
            <div className="space-y-0.5">
              {sorted.slice(0, 6).map(lap => {
                const isFirst = lap.lap === first.lap, isLast = lap.lap === last.lap
                return (
                  <div key={lap.lap} className="flex items-center gap-1.5">
                    <span className="text-[8px] text-base-content/30 w-4 text-right font-mono">{lap.lap}</span>
                    <span className={`text-[9px] font-mono ${lap.pb ? 'text-primary font-bold' : 'text-base-content/60'}`}>
                      {fmtT(lap.time)}
                    </span>
                    {lap.del && <span className="text-[8px] text-error">DEL</span>}
                  </div>
                )
              })}
              {sorted.length > 6 && (
                <div className="text-[8px] text-base-content/25 pl-5">+{sorted.length - 6} more laps</div>
              )}
            </div>

            {/* Best / avg */}
            <div className="flex gap-2 mt-1 pt-1 border-t border-white/[0.05]">
              <span className="text-[8px] text-base-content/30">Best: <span className="text-primary font-mono">{fmtT(best.time)}</span></span>
              <span className="text-[8px] text-base-content/30">Avg: <span className="font-mono">{fmtT(avg)}</span></span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// Separate chart for the bar chart view (like TI's compact per-driver chart)
function StintBarChart({ drivers }: { drivers: DriverData[] }) {
  const ref = useRef<SVGSVGElement>(null)
  const roRef = useRef<ResizeObserver | null>(null)

  function draw() {
    const svg = d3.select(ref.current!)
    svg.selectAll('*').remove()
    if (!drivers.length || !ref.current) return
    const W = ref.current.parentElement!.clientWidth || 900
    const rowH = 28, m = { t: 8, r: 16, b: 28, l: 52 }
    const iW = W - m.l - m.r, iH = drivers.length * rowH
    svg.attr('width', W).attr('height', iH + m.t + m.b)
    const g = svg.append('g').attr('transform', `translate(${m.l},${m.t})`)
    const maxLap = d3.max(drivers, d => d3.max(d.laps, l => l.lap)) ?? 1
    const xScale = d3.scaleLinear().domain([1, maxLap + 1]).range([0, iW])
    const yScale = d3.scaleBand().domain(drivers.map(d => d.code)).range([0, iH]).padding(0.3)

    g.append('g').attr('transform', `translate(0,${iH})`).call(
      d3.axisBottom(xScale).ticks(Math.min(maxLap, 20)).tickFormat(d3.format('d'))
    ).selectAll('text').attr('fill', 'rgba(255,255,255,0.3)').attr('font-size', 9)
    g.selectAll('.domain').attr('stroke', 'rgba(255,255,255,0.08)')

    g.append('g').call(d3.axisLeft(yScale)).selectAll('text').each(function (code) {
      const dr = drivers.find(dr => dr.code === code)
      d3.select(this).attr('fill', dr?.color ?? '#888').attr('font-family', 'monospace').attr('font-size', 10).attr('font-weight', 'bold')
    })

    drivers.forEach(d => {
      const bw = yScale.bandwidth(), y0 = yScale(d.code) ?? 0
      const stints = d3.group(d.laps.filter(l => l.time !== null), l => l.stint)
      stints.forEach(laps => {
        const sorted = laps.sort((a, b) => a.lap - b.lap)
        const first = sorted[0], last = sorted[sorted.length - 1]
        const col = COMPOUND_COLORS[first.compound] ?? '#888'
        const x1 = xScale(first.lap - 0.5), blen = Math.max(4, xScale(last.lap + 0.5) - x1)

        g.append('rect').attr('x', x1).attr('width', blen).attr('y', y0).attr('height', bw).attr('rx', 3)
          .attr('fill', col).attr('fill-opacity', 0.18).attr('stroke', col).attr('stroke-width', 1.5)

        if (blen > 24) {
          g.append('text').attr('x', x1 + blen / 2).attr('y', y0 + bw / 2 + 3.5)
            .attr('text-anchor', 'middle').attr('fill', col).attr('font-size', 9).attr('font-weight', 'bold')
            .text(`${first.compound[0]} (${sorted.length})`)
        }

        // Fresh tyre indicator dot
        if (first.fresh) {
          g.append('circle').attr('cx', x1 + 4).attr('cy', y0 + bw / 2).attr('r', 2.5)
            .attr('fill', '#22c55e').attr('stroke', '#000').attr('stroke-width', 0.5)
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

  return <svg ref={ref} className="w-full" id="stint-chart"/>
}

export function StintChart({ drivers }: { drivers: DriverData[] }) {
  if (!drivers.length) return <div className="text-center py-8 text-base-content/25 text-sm">No data loaded</div>

  return (
    <div className="w-full">
      {/* Card grid - matches TI exactly */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 mb-4">
        {drivers.map(d => <DriverStintCard key={d.code} d={d}/>)}
      </div>
      {/* Bar chart for overview when many drivers */}
      {drivers.length > 2 && <StintBarChart drivers={drivers}/>}
    </div>
  )
}
