'use client'
import { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'

interface WeatherData {
  wT: number[]; wAT: number[]; wTT: number[]
  wH: number[]; wWS: number[]; wP: number[]; wR: boolean[]
}

type Channel = 'wTT' | 'wAT' | 'wH' | 'wWS' | 'wP'
const CHANNEL_CFG: Record<Channel, { label: string; unit: string; color: string }> = {
  wTT: { label: 'Track Temp', unit: '°C', color: '#e8002d' },
  wAT: { label: 'Air Temp',   unit: '°C', color: '#38bdf8' },
  wH:  { label: 'Humidity',   unit: '%',  color: '#4ade80' },
  wWS: { label: 'Wind Speed', unit: 'm/s',color: '#ffd600' },
  wP:  { label: 'Pressure',   unit: 'mb', color: '#a78bfa' },
}

export function WeatherChart({ weather }: { weather: WeatherData | null }) {
  const ref = useRef<SVGSVGElement>(null)
  const roRef = useRef<ResizeObserver|null>(null)
  const [active, setActive] = useState<Channel[]>(['wTT', 'wAT'])

  function draw() {
    const svg = d3.select(ref.current!)
    svg.selectAll('*').remove()
    if (!weather || !ref.current) return

    const W = ref.current.parentElement!.clientWidth || 900
    const m = { t: 12, r: 20, b: 36, l: 52 }, iW = W-m.l-m.r, iH = 160
    svg.attr('width', W).attr('height', iH + m.t + m.b)
    const g = svg.append('g').attr('transform', `translate(${m.l},${m.t})`)

    const n = weather.wT.length
    const xScale = d3.scaleLinear().domain([0, n-1]).range([0, iW])

    // Grid
    g.append('g').call(d3.axisBottom(xScale).tickSize(iH).tickFormat(()=>'')).selectAll('line').attr('stroke','rgba(255,255,255,0.04)')
    g.selectAll('.domain').remove()

    // Rain periods
    weather.wR.forEach((rain, i) => {
      if (rain) {
        g.append('rect').attr('x', xScale(i)).attr('width', xScale(1)-xScale(0))
          .attr('y', 0).attr('height', iH).attr('fill', 'rgba(56,189,248,0.08)')
      }
    })

    active.forEach(ch => {
      const cfg = CHANNEL_CFG[ch]
      const vals = weather[ch] as number[]
      const [yMin, yMax] = d3.extent(vals) as [number,number]
      const yScale = d3.scaleLinear().domain([yMin-1, yMax+1]).range([iH, 0])

      const line = d3.line<number>().x((_,i)=>xScale(i)).y(v=>yScale(v)).curve(d3.curveMonotoneX)
      g.append('path').datum(vals).attr('fill','none').attr('stroke',cfg.color).attr('stroke-width',2).attr('opacity',0.9).attr('d',line)

      // Y axis for first channel
      if (ch === active[0]) {
        g.append('g').call(d3.axisLeft(yScale).ticks(4).tickFormat(d => `${+d}${cfg.unit}`))
          .selectAll('text').attr('fill','rgba(255,255,255,0.3)').attr('font-size',9)
      }
    })

    // X axis - time labels
    g.append('g').attr('transform',`translate(0,${iH})`).call(
      d3.axisBottom(xScale).ticks(8).tickFormat(i => {
        const t = weather.wT[+i]
        if (t == null) return ''
        const mins = Math.floor(t/60)
        return `${mins}m`
      })
    ).selectAll('text').attr('fill','rgba(255,255,255,0.3)').attr('font-size',9)
  }

  useEffect(() => {
    draw()
    roRef.current?.disconnect()
    roRef.current = new ResizeObserver(draw)
    if (ref.current?.parentElement) roRef.current.observe(ref.current.parentElement)
    return () => roRef.current?.disconnect()
  }, [weather, active])

  if (!weather) return <div className="py-8 text-center text-base-content/25 text-sm">No weather data available for this session.</div>

  return (
    <div className="w-full">
      <div className="flex flex-wrap gap-1.5 mb-3">
        {(Object.entries(CHANNEL_CFG) as [Channel, typeof CHANNEL_CFG[Channel]][]).map(([ch, cfg]) => (
          <button key={ch} onClick={() => setActive(p => p.includes(ch) ? p.filter(x=>x!==ch) : [...p,ch])}
            className={`btn btn-xs gap-1 font-mono ${active.includes(ch) ? '' : 'opacity-40'}`}
            style={active.includes(ch)?{borderColor:cfg.color,color:cfg.color,background:cfg.color+'22',border:'1px solid'}:{border:'1px solid rgba(255,255,255,0.2)'}}>
            <span className="w-2 h-2 rounded-full inline-block" style={{background:cfg.color}}/>
            {cfg.label}
          </button>
        ))}
        <span className="text-xs text-base-content/30 self-center ml-2">
          {weather.wR.some(Boolean) ? '🌧 Rain detected' : '☀️ Dry session'}
        </span>
      </div>
      <svg ref={ref} className="w-full"/>
    </div>
  )
}
