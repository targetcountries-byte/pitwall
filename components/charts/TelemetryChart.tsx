'use client'
import { useEffect, useRef } from 'react'
import * as d3 from 'd3'
import type { DriverData, TelPoint } from '@/lib/api'

// 2026 F1 Regulation Changes:
// - DRS (Drag Reduction System) REPLACED by Active Rear Wing (ARW)
// - ARW is passive/active depending on speed, not zone-based
// - Field in data still called 'drs' but represents ARW state

interface Channel {
  key: string
  label: string
  unit: string
  h: number
  fillColor?: string
  fillDriver?: boolean // false = use static color, true = use driver color
  reg2026?: string    // updated label for 2026
  skipIfZero?: boolean
}

const BASE_CHANNELS: Channel[] = [
  { key: 'speed',                 label: 'Speed',         unit: 'km/h', h: 90,  fillDriver: true },
  { key: 'throttle',              label: 'Throttle',      unit: '%',    h: 60,  fillColor: '#22c55e' },
  { key: 'brake',                 label: 'Brake',         unit: '',     h: 50,  fillColor: '#e8002d' },
  { key: 'gear',                  label: 'Gear',          unit: '',     h: 55,  fillColor: '#ffd600' },
  { key: 'rpm',                   label: 'RPM',           unit: '',     h: 65,  fillDriver: true },
  // 2026: DRS → ARW (Active Rear Wing)
  { key: 'drs',                   label: 'DRS',           unit: '',     h: 40,  fillColor: '#38bdf8', reg2026: 'ARW (Active Rear Wing)', skipIfZero: true },
  { key: 'distanceToDriverAhead', label: 'Gap Ahead',     unit: 'm',    h: 60,  fillColor: '#a78bfa', skipIfZero: true },
  { key: 'acc_x',                 label: 'Long G',        unit: 'g',    h: 65,  fillColor: '#f97316' },
  { key: 'acc_y',                 label: 'Lat G',         unit: 'g',    h: 65,  fillColor: '#ec4899' },
  { key: 'acc_z',                 label: 'Vert G',        unit: 'g',    h: 55,  fillColor: '#8b5cf6', skipIfZero: true },
  { key: 'z',                     label: 'Elevation',     unit: 'm',    h: 55,  fillColor: '#06b6d4' },
]

function formatVal(v: number, unit: string): string {
  if (Math.abs(v) >= 1000) return `${(v/1000).toFixed(1)}k`
  if (unit === '%') return `${Math.round(v)}`
  if (unit === 'g') return v.toFixed(2)
  return Math.abs(v) < 10 ? v.toFixed(1) : Math.round(v).toString()
}

export function TelemetryChart({ drivers, year }: { drivers: DriverData[], year?: number }) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const roRef   = useRef<ResizeObserver | null>(null)

  const is2026 = (year ?? 2026) >= 2026

  function draw() {
    if (!wrapRef.current) return
    wrapRef.current.innerHTML = ''

    const withTel = drivers.filter(d => d.tel.length > 0)
    if (!withTel.length) {
      wrapRef.current.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:center;height:120px;
          color:rgba(255,255,255,0.2);font-size:13px;text-align:center;padding:0 24px">
          Click any lap dot above to load telemetry comparison
        </div>`
      return
    }

    const W = wrapRef.current.clientWidth || 900
    const mL = 64, mR = 20, mT = 4
    const iW = W - mL - mR

    const maxDist = d3.max(withTel, d => d3.max(d.tel, p => p.distance)) ?? 1

    BASE_CHANNELS.forEach(ch => {
      // Check if channel has meaningful data
      const allVals: number[] = []
      withTel.forEach(d => d.tel.forEach(p => {
        const v = p[ch.key as keyof TelPoint] as number
        if (v != null && isFinite(v)) allVals.push(v)
      }))

      // Skip channels that are all-zero (skipIfZero) unless there's meaningful variance
      if (ch.skipIfZero) {
        const max = d3.max(allVals.map(Math.abs)) ?? 0
        if (max < 0.1) return
      }

      if (!allVals.length) return

      const [yMin, yMax] = d3.extent(allVals) as [number, number]
      const yRange = yMax - yMin
      const yPad = Math.max(yRange * 0.06, 0.1)
      const yS = d3.scaleLinear().domain([yMin - yPad, yMax + yPad]).range([ch.h, 0])
      const xS = d3.scaleLinear().domain([0, 1]).range([0, iW])

      // Build SVG
      const svg = d3.create('svg').attr('width', W).attr('height', ch.h + mT + 20)
      const g = svg.append('g').attr('transform', `translate(${mL},${mT})`)

      // Subtle background for this channel
      g.append('rect').attr('x', 0).attr('y', 0).attr('width', iW).attr('height', ch.h)
        .attr('fill', 'rgba(255,255,255,0.015)').attr('rx', 2)

      // Horizontal center reference line (for g-forces)
      if (ch.unit === 'g' || ch.key === 'drs') {
        const midY = yS(0)
        if (midY > 0 && midY < ch.h) {
          g.append('line').attr('x1', 0).attr('x2', iW).attr('y1', midY).attr('y2', midY)
            .attr('stroke', 'rgba(255,255,255,0.08)').attr('stroke-dasharray', '4,4')
        }
      }

      // Grid lines
      g.append('g').call(d3.axisLeft(yS).ticks(2).tickSize(-iW).tickFormat(() => ''))
        .selectAll('line').attr('stroke', 'rgba(255,255,255,0.03)')
      g.selectAll('.domain').remove()

      // Y axis label (left side, vertical)
      const chLabel = (is2026 && ch.reg2026) ? ch.reg2026 : ch.label
      const displayLabel = is2026 && ch.reg2026 ? 'ARW' : ch.label.substring(0, 8)
      g.append('text')
        .attr('x', -mL + 3).attr('y', ch.h / 2 + 3)
        .attr('fill', ch.fillColor ?? 'rgba(255,255,255,0.5)')
        .attr('font-size', 9).attr('font-weight', '700')
        .attr('font-family', 'monospace')
        .text(displayLabel)

      // Y axis ticks (min/max)
      ;[yMin, (yMin+yMax)/2, yMax].forEach((v, i) => {
        if (i === 1 && yRange < 5) return
        g.append('text')
          .attr('x', -6).attr('y', yS(v) + 3)
          .attr('text-anchor', 'end')
          .attr('fill', 'rgba(255,255,255,0.2)').attr('font-size', 7)
          .text(formatVal(v, ch.unit))
      })

      // Draw each driver's line
      withTel.forEach((d, di) => {
        const pts = d.tel.filter(p => {
          const v = p[ch.key as keyof TelPoint] as number
          return v != null && isFinite(v)
        })
        if (pts.length < 2) return

        const strokeColor = ch.fillColor ?? d.color
        const strokeW = withTel.length === 1 ? 2 : 1.6

        // Area fill (first driver only for clarity)
        if ((ch.fillColor || ch.fillDriver) && di === 0) {
          const baseY = ch.key === 'brake' || ch.key === 'throttle' || ch.key === 'drs' ? yS(0) : ch.h
          const area = d3.area<TelPoint>()
            .x(p => xS(p.distance / maxDist))
            .y0(Math.min(baseY, ch.h)).y1(p => yS(p[ch.key as keyof TelPoint] as number))
            .defined(p => isFinite(p[ch.key as keyof TelPoint] as number))
            .curve(d3.curveMonotoneX)

          const fillCol = ch.fillColor ?? d.color
          g.append('path').datum(pts)
            .attr('fill', fillCol)
            .attr('fill-opacity', ch.fillColor ? 0.15 : 0.08)
            .attr('d', area as any)
        }

        const line = d3.line<TelPoint>()
          .x(p => xS(p.distance / maxDist))
          .y(p => yS(p[ch.key as keyof TelPoint] as number))
          .defined(p => isFinite(p[ch.key as keyof TelPoint] as number))
          .curve(d3.curveMonotoneX)

        g.append('path').datum(pts)
          .attr('fill', 'none')
          .attr('stroke', strokeColor)
          .attr('stroke-width', strokeW)
          .attr('opacity', withTel.length > 3 ? 0.7 : 0.9)
          .attr('d', line as any)

        // Driver code label at end of line
        if (withTel.length > 1 && pts.length > 0) {
          const lastPt = pts[pts.length - 1]
          const vy = yS(lastPt[ch.key as keyof TelPoint] as number)
          if (vy > 2 && vy < ch.h - 2) {
            const labelG = svg.append('g').attr('transform', `translate(${mL + iW + 3},${mT + vy})`)
            labelG.append('text').attr('y', 3.5)
              .attr('fill', strokeColor).attr('font-size', 7).attr('font-weight', 'bold').attr('font-family', 'monospace')
              .text(d.code.substring(0, 3))
          }
        }
      })

      // 2026 badge for ARW channel
      if (is2026 && ch.reg2026) {
        g.append('rect').attr('x', iW - 60).attr('y', 2).attr('width', 58).attr('height', 12).attr('rx', 3)
          .attr('fill', '#38bdf8').attr('fill-opacity', 0.15)
        g.append('text').attr('x', iW - 31).attr('y', 11)
          .attr('text-anchor', 'middle').attr('fill', '#38bdf8').attr('font-size', 7).attr('font-weight', 'bold')
          .text('2026 REG')
      }

      // Wrap and append
      const wrap = document.createElement('div')
      wrap.style.marginBottom = '1px'
      wrap.appendChild(svg.node()!)
      wrapRef.current!.appendChild(wrap)
    })

    // X-axis distance markers (bottom of chart)
    const xSvg = d3.create('svg').attr('width', W).attr('height', 24)
    const xG = xSvg.append('g').attr('transform', `translate(${mL},0)`)
    xG.append('g').call(
      d3.axisBottom(d3.scaleLinear().domain([0, 1]).range([0, iW]))
        .ticks(8)
        .tickFormat(d => `${(+d * 100).toFixed(0)}%`)
    ).selectAll('text').attr('fill', 'rgba(255,255,255,0.25)').attr('font-size', 8)
    xSvg.selectAll('.domain').attr('stroke', 'rgba(255,255,255,0.1)')

    const xWrap = document.createElement('div')
    xWrap.appendChild(xSvg.node()!)
    wrapRef.current!.appendChild(xWrap)
  }

  useEffect(() => {
    draw()
    roRef.current?.disconnect()
    roRef.current = new ResizeObserver(draw)
    if (wrapRef.current) roRef.current.observe(wrapRef.current)
    return () => roRef.current?.disconnect()
  }, [drivers, year])

  return <div ref={wrapRef} className="w-full select-none" id="speedchart"/>
}
