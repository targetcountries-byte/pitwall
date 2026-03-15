'use client'
import { useEffect, useRef } from 'react'
import * as d3 from 'd3'
import type { DriverData, TelPoint } from '@/lib/api'

interface Corner { CornerNumber: number; X: number; Y: number; Distance: number }

export function TrackMap({ drivers, corners }: { drivers: DriverData[]; corners: Corner[] | null }) {
  const ref = useRef<SVGSVGElement>(null)
  const roRef = useRef<ResizeObserver | null>(null)

  function draw() {
    const svg = d3.select(ref.current!)
    svg.selectAll('*').remove()
    if (!ref.current) return

    const W = ref.current.parentElement!.clientWidth || 700
    const H = Math.min(W * 0.65, 380)

    const withPos = drivers.filter(d => d.tel.length > 2 && d.tel.some(p => p.x !== 0))

    if (!withPos.length) {
      svg.attr('width', W).attr('height', 80)
      svg.append('text').attr('x', W / 2).attr('y', 45)
        .attr('text-anchor', 'middle').attr('fill', 'rgba(255,255,255,0.18)').attr('font-size', 12)
        .text('Click a lap dot above to load track map telemetry')
      return
    }

    svg.attr('width', W).attr('height', H)
    const pad = 36

    const allX = withPos.flatMap(d => d.tel.map(p => p.x)).filter(v => v !== 0)
    const allY = withPos.flatMap(d => d.tel.map(p => p.y)).filter(v => v !== 0)
    const [xMin, xMax] = d3.extent(allX) as [number, number]
    const [yMin, yMax] = d3.extent(allY) as [number, number]

    // Preserve aspect ratio
    const dataW = xMax - xMin, dataH = yMax - yMin
    const scaleF = Math.min((W - pad * 2) / dataW, (H - pad * 2) / dataH)
    const xOff = (W - dataW * scaleF) / 2, yOff = (H - dataH * scaleF) / 2

    const xS = (v: number) => xOff + (v - xMin) * scaleF
    const yS = (v: number) => H - yOff - (v - yMin) * scaleF  // flip Y

    // Draw thick track outline from first driver (grey outer, black inner)
    const trackPts = withPos[0].tel.filter(p => p.x !== 0)
    if (trackPts.length > 2) {
      const line = d3.line<TelPoint>().x(p => xS(p.x)).y(p => yS(p.y)).curve(d3.curveCatmullRomClosed)

      // Outer glow
      svg.append('path').datum(trackPts).attr('fill', 'none')
        .attr('stroke', 'rgba(255,255,255,0.06)').attr('stroke-width', 18)
        .attr('d', line as any)

      // Track surface (dark)
      svg.append('path').datum(trackPts).attr('fill', 'none')
        .attr('stroke', 'rgba(20,25,50,0.9)').attr('stroke-width', 12)
        .attr('d', line as any)

      // Track edge lines (white kerb)
      svg.append('path').datum(trackPts).attr('fill', 'none')
        .attr('stroke', 'rgba(255,255,255,0.15)').attr('stroke-width', 12)
        .attr('stroke-dasharray', 'none')
        .attr('d', line as any)

      // Re-draw dark center
      svg.append('path').datum(trackPts).attr('fill', 'none')
        .attr('stroke', 'rgba(10,15,40,0.95)').attr('stroke-width', 8)
        .attr('d', line as any)
    }

    // Draw each driver's path in their color (thin)
    withPos.forEach(d => {
      const pts = d.tel.filter(p => p.x !== 0)
      if (pts.length < 2) return
      const line = d3.line<TelPoint>()
        .x(p => xS(p.x)).y(p => yS(p.y))
        .curve(d3.curveCatmullRom)

      svg.append('path').datum(pts).attr('fill', 'none')
        .attr('stroke', d.color).attr('stroke-width', 2.5)
        .attr('opacity', 0.9).attr('d', line as any)
    })

    // Draw corner numbers
    if (corners?.length) {
      corners.forEach(c => {
        const cx = xS(c.X), cy = yS(c.Y)

        svg.append('circle').attr('cx', cx).attr('cy', cy).attr('r', 7)
          .attr('fill', 'rgba(5,10,30,0.9)').attr('stroke', 'rgba(255,255,255,0.5)').attr('stroke-width', 1.2)

        svg.append('text').attr('x', cx).attr('y', cy + 3.5)
          .attr('text-anchor', 'middle').attr('fill', 'rgba(255,255,255,0.8)')
          .attr('font-size', 7).attr('font-weight', '700')
          .text(c.CornerNumber)
      })
    }

    // Start/finish line
    if (withPos[0].tel.length > 0) {
      const s = withPos[0].tel.find(p => p.x !== 0)
      if (s) {
        svg.append('rect').attr('x', xS(s.x) - 4).attr('y', yS(s.y) - 14)
          .attr('width', 8).attr('height', 28).attr('fill', 'rgba(255,255,255,0.7)').attr('rx', 1)
      }
    }

    // Driver legend
    const legY = H - 14
    const legG = svg.append('g').attr('transform', `translate(${pad}, ${legY})`)
    withPos.forEach((d, i) => {
      legG.append('circle').attr('cx', i * 48 + 4).attr('cy', 0).attr('r', 4).attr('fill', d.color)
      legG.append('text').attr('x', i * 48 + 11).attr('y', 4)
        .attr('fill', d.color).attr('font-size', 9).attr('font-family', 'monospace').attr('font-weight', 'bold')
        .text(d.code)
    })
  }

  useEffect(() => {
    draw()
    roRef.current?.disconnect()
    roRef.current = new ResizeObserver(draw)
    if (ref.current?.parentElement) roRef.current.observe(ref.current.parentElement)
    return () => roRef.current?.disconnect()
  }, [drivers, corners])

  return <svg ref={ref} className="w-full" id="trackmap"/>
}
