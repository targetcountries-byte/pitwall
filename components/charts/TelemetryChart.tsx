'use client'
import { useEffect, useRef } from 'react'
import * as d3 from 'd3'
import type { DriverData, TelPoint } from '@/lib/api'

const CHANNELS = [
  { key: 'speed',    label: 'Speed',    unit: 'km/h', h: 80 },
  { key: 'throttle', label: 'Throttle', unit: '%',    h: 60 },
  { key: 'brake',    label: 'Brake',    unit: '',     h: 45 },
  { key: 'gear',     label: 'Gear',     unit: '',     h: 45 },
  { key: 'rpm',      label: 'RPM',      unit: '',     h: 60 },
  { key: 'drs',      label: 'DRS',      unit: '',     h: 40 },
  { key: 'acc_x',    label: 'Long G',   unit: 'g',    h: 55 },
  { key: 'acc_y',    label: 'Lat G',    unit: 'g',    h: 55 },
]

export function TelemetryChart({ drivers }: { drivers: DriverData[] }) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const roRef   = useRef<ResizeObserver|null>(null)

  function draw() {
    if (!wrapRef.current) return
    wrapRef.current.innerHTML = ''
    const withTel = drivers.filter(d => d.tel.length > 0)
    if (!withTel.length) {
      wrapRef.current.innerHTML = `<div class="flex items-center justify-center py-14 text-base-content/25 text-sm text-center">Click any lap dot above to compare telemetry</div>`
      return
    }

    const W = wrapRef.current.clientWidth || 900
    const mL = 54, mR = 16, mT = 4, mB = 0
    const iW = W - mL - mR

    // Normalize distance 0..1
    const maxDist = d3.max(withTel, d => d3.max(d.tel, p => p.distance)) ?? 1

    CHANNELS.forEach(ch => {
      const svg = d3.create('svg').attr('width', W).attr('height', ch.h + mT + mB)
      const g = svg.append('g').attr('transform', `translate(${mL},${mT})`)

      const xScale = d3.scaleLinear().domain([0, 1]).range([0, iW])
      const vals: number[] = withTel.flatMap(d => d.tel.map(p => +p[ch.key as keyof TelPoint] as number).filter(isFinite))
      if (!vals.length) { wrapRef.current!.appendChild(svg.node()!); return }

      const [yMin, yMax] = d3.extent(vals) as [number,number]
      const yPad = Math.max((yMax-yMin)*0.06, 0.1)
      const yScale = d3.scaleLinear().domain([yMin-yPad, yMax+yPad]).range([ch.h,0])

      // faint grid
      g.append('g').call(d3.axisLeft(yScale).ticks(2).tickSize(-iW).tickFormat(() => ''))
        .selectAll('line').attr('stroke','rgba(255,255,255,0.03)')
      g.selectAll('.domain').remove()

      // Y labels
      g.append('text').attr('x',-mL+2).attr('y', ch.h/2+3).attr('fill','rgba(255,255,255,0.45)').attr('font-size',9).attr('font-weight','600').text(ch.label)
      g.append('g').call(d3.axisLeft(yScale).ticks(2).tickFormat(d => {
        const v = +d; return Math.abs(v)>=1000 ? `${(v/1000).toFixed(1)}k` : v.toFixed(v%1===0?0:1)
      })).selectAll('text').attr('fill','rgba(255,255,255,0.25)').attr('font-size',8)

      const line = d3.line<TelPoint>()
        .x(p => xScale(p.distance/maxDist))
        .y(p => yScale(+p[ch.key as keyof TelPoint] as number))
        .defined(p => isFinite(+p[ch.key as keyof TelPoint] as number))
        .curve(d3.curveMonotoneX)

      withTel.forEach(d => {
        g.append('path').datum(d.tel).attr('fill','none')
          .attr('stroke', d.color).attr('stroke-width', 1.8)
          .attr('opacity', 0.88).attr('d', line as any)
      })

      const wrap = document.createElement('div')
      wrap.className = 'mb-0.5'
      wrap.appendChild(svg.node()!)
      wrapRef.current!.appendChild(wrap)
    })
  }

  useEffect(() => {
    draw()
    roRef.current?.disconnect()
    roRef.current = new ResizeObserver(() => draw())
    if (wrapRef.current) roRef.current.observe(wrapRef.current)
    return () => roRef.current?.disconnect()
  }, [drivers])

  return <div ref={wrapRef} className="w-full select-none"/>
}
