'use client'
import { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'

interface WeatherData {
  wT: number[]; wAT: number[]; wH: number[]; wP: number[]
  wR: boolean[]; wTT: number[]; wWD: number[]; wWS: number[]
}

type Chan = 'wTT' | 'wAT' | 'wH' | 'wWS' | 'wP'
const CHANS: { key: Chan; label: string; unit: string; color: string }[] = [
  { key: 'wTT', label: 'Track Temp', unit: '°C', color: '#e8002d' },
  { key: 'wAT', label: 'Air Temp',   unit: '°C', color: '#38bdf8' },
  { key: 'wH',  label: 'Humidity',   unit: '%',  color: '#4ade80' },
  { key: 'wWS', label: 'Wind Speed', unit: 'm/s', color: '#ffd600' },
  { key: 'wP',  label: 'Pressure',   unit: 'mb', color: '#a78bfa' },
]

export function WeatherChart({ weather }: { weather: WeatherData | null }) {
  const ref = useRef<SVGSVGElement>(null)
  const tipRef = useRef<HTMLDivElement>(null)
  const roRef = useRef<ResizeObserver | null>(null)
  const [active, setActive] = useState<Chan[]>(['wTT', 'wAT'])

  function draw() {
    const svg = d3.select(ref.current!)
    svg.selectAll('*').remove()
    if (!weather || !ref.current) return

    const W = ref.current.parentElement!.clientWidth || 900
    const m = { t: 10, r: 20, b: 36, l: 52 }
    const iW = W - m.l - m.r, iH = 180
    svg.attr('width', W).attr('height', iH + m.t + m.b)
    const g = svg.append('g').attr('transform', `translate(${m.l},${m.t})`)

    const n = weather.wT.length
    if (n === 0) return

    const t0 = weather.wT[0] ?? 0
    const tLast = weather.wT[n - 1] ?? t0
    const xScale = d3.scaleLinear().domain([t0, tLast]).range([0, iW])

    // Rain shading
    weather.wR.forEach((rain, i) => {
      if (!rain) return
      const x1 = xScale(weather.wT[i] ?? t0)
      const x2 = i + 1 < n ? xScale(weather.wT[i + 1] ?? tLast) : xScale(tLast)
      g.append('rect').attr('x', x1).attr('width', Math.max(1, x2 - x1))
        .attr('y', 0).attr('height', iH).attr('fill', 'rgba(56,189,248,0.1)')
    })

    // Grid
    g.append('g').call(d3.axisLeft(d3.scaleLinear().domain([0, 1]).range([iH, 0])).ticks(4).tickSize(-iW).tickFormat(() => ''))
      .selectAll('line').attr('stroke', 'rgba(255,255,255,0.04)')
    g.selectAll('.domain').remove()

    // Draw each active channel
    const yScales: Partial<Record<Chan, d3.ScaleLinear<number, number>>> = {}
    active.forEach((ch, idx) => {
      const cfg = CHANS.find(c => c.key === ch)!
      const vals = weather[ch] as number[]
      const [vMin, vMax] = d3.extent(vals) as [number, number]
      const yPad = (vMax - vMin) * 0.1 || 1
      const yS = d3.scaleLinear().domain([vMin - yPad, vMax + yPad]).range([iH, 0])
      yScales[ch] = yS

      const line = d3.line<number>()
        .x((_, i) => xScale(weather.wT[i] ?? t0))
        .y(v => yS(v))
        .curve(d3.curveMonotoneX)

      // Area fill under line
      const area = d3.area<number>()
        .x((_, i) => xScale(weather.wT[i] ?? t0))
        .y0(iH).y1(v => yS(v))
        .curve(d3.curveMonotoneX)

      g.append('path').datum(vals)
        .attr('fill', cfg.color).attr('fill-opacity', 0.08)
        .attr('d', area)

      g.append('path').datum(vals)
        .attr('fill', 'none').attr('stroke', cfg.color).attr('stroke-width', 2)
        .attr('opacity', 0.9).attr('d', line)

      // Y axis (first active channel)
      if (idx === 0) {
        g.append('g').call(d3.axisLeft(yS).ticks(4).tickFormat(d => `${+d}${cfg.unit}`))
          .selectAll('text').attr('fill', cfg.color).attr('font-size', 9).attr('opacity', 0.7)
        g.selectAll('.domain').attr('stroke', cfg.color).attr('opacity', 0.3)
      }
    })

    // X axis - session time in minutes
    g.append('g').attr('transform', `translate(0,${iH})`).call(
      d3.axisBottom(xScale).ticks(8).tickFormat(d => {
        const secs = +d - t0
        const m = Math.floor(secs / 60)
        return `${m}m`
      })
    ).selectAll('text').attr('fill', 'rgba(255,255,255,0.3)').attr('font-size', 9)

    // Hover line
    const vLine = g.append('line').attr('stroke', 'rgba(255,255,255,0.25)').attr('stroke-width', 1)
      .attr('stroke-dasharray', '3,3').attr('y1', 0).attr('y2', iH).attr('display', 'none')

    g.append('rect').attr('width', iW).attr('height', iH).attr('fill', 'transparent')
      .on('mousemove', function (e) {
        const [mx] = d3.pointer(e)
        const t = xScale.invert(mx)
        const idx = d3.bisectLeft(weather.wT, t)
        vLine.attr('display', null).attr('x1', mx).attr('x2', mx)
        if (tipRef.current && idx < n) {
          const svgRect = ref.current!.getBoundingClientRect()
          tipRef.current.style.display = 'block'
          tipRef.current.style.left = `${e.clientX - svgRect.left + m.l + 8}px`
          tipRef.current.style.top = `${m.t + 4}px`
          const mins = Math.floor((weather.wT[idx] - t0) / 60)
          tipRef.current.innerHTML = `<div class="font-mono text-[10px] text-primary mb-1">${mins}m into session</div>` +
            CHANS.filter(c => active.includes(c.key)).map(c =>
              `<div style="color:${c.color}" class="text-[9px]">${c.label}: <b>${(weather[c.key] as number[])[idx]?.toFixed(1)}${c.unit}</b></div>`
            ).join('')
        }
      })
      .on('mouseleave', function () {
        vLine.attr('display', 'none')
        if (tipRef.current) tipRef.current.style.display = 'none'
      })
  }

  useEffect(() => {
    draw()
    roRef.current?.disconnect()
    roRef.current = new ResizeObserver(draw)
    if (ref.current?.parentElement) roRef.current.observe(ref.current.parentElement)
    return () => roRef.current?.disconnect()
  }, [weather, active])

  if (!weather) return (
    <div className="py-8 text-center text-base-content/25 text-sm">No weather data available</div>
  )

  const isRain = weather.wR.some(Boolean)
  const latestTrack = weather.wTT[weather.wTT.length - 1]?.toFixed(1)
  const latestAir = weather.wAT[weather.wAT.length - 1]?.toFixed(1)

  return (
    <div className="w-full">
      {/* Channel toggles + stats */}
      <div className="flex flex-wrap items-center gap-1.5 mb-3">
        {CHANS.map(c => (
          <button key={c.key}
            onClick={() => setActive(p => p.includes(c.key) ? p.filter(x => x !== c.key) : [...p, c.key])}
            className="btn btn-xs gap-1.5 font-mono text-[10px] transition-all"
            style={active.includes(c.key)
              ? { borderColor: c.color, color: c.color, background: c.color + '20', border: '1px solid' }
              : { border: '1px solid rgba(255,255,255,0.15)', opacity: 0.45 }}>
            <span className="w-2 h-2 rounded-full" style={{ background: c.color }}/>
            {c.label}
          </button>
        ))}
        <div className="ml-auto flex gap-3 text-[10px] text-base-content/40">
          {latestTrack && <span>Track: <b className="text-error">{latestTrack}°C</b></span>}
          {latestAir   && <span>Air: <b className="text-info">{latestAir}°C</b></span>}
          {isRain && <span className="text-info">🌧 Rain</span>}
        </div>
      </div>
      <div className="relative">
        <svg ref={ref} className="w-full"/>
        <div ref={tipRef} className="chart-tooltip hidden pointer-events-none"/>
      </div>
    </div>
  )
}
