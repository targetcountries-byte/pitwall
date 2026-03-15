'use client'
import { useEffect, useRef } from 'react'
import * as d3 from 'd3'
import type { DriverData, TelPoint } from '@/lib/api'

const CHANNELS = [
  { key: 'speed',                  label: 'Speed',          unit: 'km/h', h: 90,  color: null },
  { key: 'throttle',               label: 'Throttle',       unit: '%',    h: 65,  color: '#22c55e' },
  { key: 'brake',                  label: 'Brake',          unit: '',     h: 50,  color: '#e8002d' },
  { key: 'gear',                   label: 'Gear',           unit: '',     h: 55,  color: '#ffd600' },
  { key: 'rpm',                    label: 'RPM',            unit: '',     h: 65,  color: null },
  { key: 'drs',                    label: 'DRS',            unit: '',     h: 40,  color: '#38bdf8' },
  { key: 'distanceToDriverAhead',  label: 'Gap Ahead',      unit: 'm',    h: 55,  color: '#a78bfa' },
  { key: 'acc_x',                  label: 'Long G',         unit: 'g',    h: 65,  color: '#f97316' },
  { key: 'acc_y',                  label: 'Lat G',          unit: 'g',    h: 65,  color: '#ec4899' },
  { key: 'acc_z',                  label: 'Vert G',         unit: 'g',    h: 55,  color: '#8b5cf6' },
  { key: 'z',                      label: 'Elevation',      unit: 'm',    h: 55,  color: '#06b6d4' },
]

export function TelemetryChart({ drivers }: { drivers: DriverData[] }) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const roRef   = useRef<ResizeObserver|null>(null)

  function draw() {
    if (!wrapRef.current) return
    wrapRef.current.innerHTML = ''

    const withTel = drivers.filter(d => d.tel.length > 0)
    if (!withTel.length) {
      wrapRef.current.innerHTML = `
        <div class="flex items-center justify-center py-14 text-base-content/25 text-sm text-center px-4">
          Click any lap dot on the chart above to load telemetry comparison
        </div>`
      return
    }

    const W = wrapRef.current.clientWidth || 900
    const mL = 58, mR = 16, mT = 4
    const iW = W - mL - mR

    // Find max distance across all drivers for normalization
    const maxDist = d3.max(withTel, d => d3.max(d.tel, p => p.distance)) ?? 1

    CHANNELS.forEach((ch, chIdx) => {
      const svg = d3.create('svg').attr('width', W).attr('height', ch.h + mT)
      const g = svg.append('g').attr('transform', `translate(${mL},${mT})`)

      const xScale = d3.scaleLinear().domain([0, 1]).range([0, iW])

      // Collect all values across all drivers
      const vals: number[] = []
      withTel.forEach(d => d.tel.forEach(p => {
        const v = p[ch.key as keyof TelPoint] as number
        if (v != null && isFinite(v) && v !== 0) vals.push(v)
      }))

      if (!vals.length) {
        // Skip empty channels
        const wrap = document.createElement('div')
        wrap.className = 'mb-0'
        wrap.appendChild(svg.node()!)
        wrapRef.current!.appendChild(wrap)
        return
      }

      const [yMin, yMax] = d3.extent(vals) as [number,number]
      const yRange = yMax - yMin
      const yPad = Math.max(yRange * 0.05, 0.1)
      const yScale = d3.scaleLinear().domain([yMin - yPad, yMax + yPad]).range([ch.h, 0])

      // Faint grid
      g.append('g').call(d3.axisLeft(yScale).ticks(2).tickSize(-iW).tickFormat(()=>''))
        .selectAll('line').attr('stroke','rgba(255,255,255,0.03)')
      g.selectAll('.domain').remove()

      // Channel label
      g.append('text')
        .attr('x', -mL + 2).attr('y', ch.h/2 + 3)
        .attr('fill', 'rgba(255,255,255,0.5)').attr('font-size', 9).attr('font-weight', '700')
        .text(ch.label)

      // Y axis ticks
      g.append('g').call(d3.axisLeft(yScale).ticks(2).tickFormat(d => {
        const v = +d
        if (Math.abs(v) >= 1000) return `${(v/1000).toFixed(1)}k`
        if (Math.abs(v) < 10) return v.toFixed(1)
        return Math.round(v).toString()
      })).selectAll('text').attr('fill','rgba(255,255,255,0.25)').attr('font-size',8)

      // Draw lines per driver
      const line = d3.line<TelPoint>()
        .x(p => xScale(p.distance / maxDist))
        .y(p => {
          const v = p[ch.key as keyof TelPoint] as number
          return isFinite(v) ? yScale(v) : yScale(yMin)
        })
        .defined(p => {
          const v = p[ch.key as keyof TelPoint] as number
          return v != null && isFinite(v)
        })
        .curve(d3.curveMonotoneX)

      withTel.forEach(d => {
        const strokeColor = ch.color || d.color
        g.append('path').datum(d.tel)
          .attr('fill', 'none')
          .attr('stroke', strokeColor)
          .attr('stroke-width', ch.color ? 1.5 : 1.8)
          .attr('opacity', ch.color ? 0.7 : 0.9)
          .attr('d', line as any)
      })

      // Brake: fill area for clarity
      if (ch.key === 'brake' && withTel.length === 1) {
        const area = d3.area<TelPoint>()
          .x(p => xScale(p.distance / maxDist))
          .y0(yScale(0)).y1(p => yScale(p.brake))
          .defined(p => isFinite(p.brake))
          .curve(d3.curveMonotoneX)
        g.append('path').datum(withTel[0].tel)
          .attr('fill', '#e8002d').attr('opacity', 0.35)
          .attr('d', area as any)
      }

      // Throttle: fill area
      if (ch.key === 'throttle' && withTel.length === 1) {
        const area = d3.area<TelPoint>()
          .x(p => xScale(p.distance / maxDist))
          .y0(yScale(0)).y1(p => yScale(p.throttle))
          .defined(p => isFinite(p.throttle))
          .curve(d3.curveMonotoneX)
        g.append('path').datum(withTel[0].tel)
          .attr('fill', '#22c55e').attr('opacity', 0.25)
          .attr('d', area as any)
      }

      const wrap = document.createElement('div')
      wrap.className = 'mb-0.5'
      wrap.appendChild(svg.node()!)
      wrapRef.current!.appendChild(wrap)
    })
  }

  useEffect(() => {
    draw()
    roRef.current?.disconnect()
    roRef.current = new ResizeObserver(draw)
    if (wrapRef.current) roRef.current.observe(wrapRef.current)
    return () => roRef.current?.disconnect()
  }, [drivers])

  return <div ref={wrapRef} className="w-full select-none" id="speedchart"/>
}
