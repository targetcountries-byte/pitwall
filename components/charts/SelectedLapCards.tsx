'use client'
import type { DriverData } from '@/lib/api'
import { COMPOUND_COLORS } from '@/lib/constants'

function fmtT(t: number | null) {
  if (t == null) return '—'
  const m = Math.floor(t / 60), s = (t % 60).toFixed(3).padStart(6, '0')
  return m > 0 ? `${m}:${s}` : (t % 60).toFixed(3)
}

// Build proxied image URL
const proxyImg = (url: string) =>
  url ? `/api/driver-img?url=${encodeURIComponent(url)}` : ''

interface SelLap { key: string; driver: string; lap: number; time: number }

export function SelectedLapCards({
  selLaps, drivers, available
}: {
  selLaps: SelLap[]
  drivers: DriverData[]
  available: { driver: string; color: string; fn: string; ln: string; url: string; team: string }[]
}) {
  if (!selLaps.length) return null

  const sorted = [...selLaps].sort((a, b) => (a.time ?? 9999) - (b.time ?? 9999))
  const bestTime = sorted[0]?.time ?? 0

  return (
    <div className="mt-4" id="selectedLapsCards">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-bold uppercase tracking-widest text-primary/60">
          Selected Lap Summaries
        </span>
        <span className="text-[9px] text-base-content/30">{sorted.length} lap{sorted.length > 1 ? 's' : ''} selected</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {sorted.map((sl, idx) => {
          const info = available.find(d => d.driver === sl.driver)
          const dd = drivers.find(d => d.code === sl.driver)
          const lap = dd?.laps.find(l => l.lap === sl.lap)
          const tel = dd?.tel
          const color = info?.color ?? '#888'
          const delta = idx === 0 ? null : sl.time - bestTime
          const cc = COMPOUND_COLORS[lap?.compound ?? 'UNKNOWN'] ?? '#888'
          const isWhite = cc === '#f0f0ec'
          const maxSpeed = tel?.length ? Math.max(...tel.map(p => p.speed).filter(v => v > 0)) : null
          const imgSrc = info?.url ? proxyImg(info.url) : ''

          return (
            <div key={sl.key} className="rounded-2xl overflow-hidden relative"
              style={{
                background: `linear-gradient(135deg, ${color}18 0%, rgba(5,10,25,0.95) 60%)`,
                border: `1px solid ${color}35`,
                boxShadow: `0 4px 24px ${color}18`,
              }}>

              {/* Rank ribbon */}
              {idx === 0 && (
                <div className="absolute top-0 right-0 px-2 py-0.5 text-[9px] font-bold tracking-widest rounded-bl-lg"
                  style={{ background: color, color: isWhite ? '#000' : '#fff' }}>
                  ▲ FASTEST
                </div>
              )}

              <div className="flex">
                {/* Photo column */}
                <div className="relative w-[88px] sm:w-[100px] shrink-0 overflow-hidden"
                  style={{ background: `linear-gradient(180deg, ${color}25 0%, rgba(0,0,0,0.6) 100%)` }}>
                  {imgSrc ? (
                    <img
                      src={imgSrc}
                      alt={`${info?.fn} ${info?.ln}`}
                      className="w-full h-full object-cover object-top absolute inset-0"
                      style={{ maxHeight: 180, mixBlendMode: 'luminosity', filter: 'contrast(1.1) saturate(1.1)' }}
                      onError={e => {
                        const el = e.target as HTMLImageElement
                        el.style.display = 'none'
                        // Show fallback initial
                        const fb = el.nextElementSibling as HTMLElement
                        if (fb) fb.style.display = 'flex'
                      }}
                    />
                  ) : null}
                  {/* Fallback */}
                  <div className="w-full h-full items-center justify-center text-4xl font-black absolute inset-0"
                    style={{ display: imgSrc ? 'none' : 'flex', color, opacity: 0.5 }}>
                    {sl.driver[0]}
                  </div>

                  {/* Team color stripe at bottom of photo */}
                  <div className="absolute bottom-0 left-0 right-0 h-1" style={{ background: color }}/>

                  {/* Driver number */}
                  <div className="absolute top-1.5 left-1.5 text-[10px] font-black font-mono"
                    style={{ color, textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>
                    #{info ? (available.find(a=>a.driver===sl.driver) ? sl.driver : '') : ''}
                  </div>
                </div>

                {/* Data column */}
                <div className="flex-1 min-w-0 p-2.5 flex flex-col justify-between">
                  {/* Name + team */}
                  <div>
                    <div className="text-[8px] font-bold uppercase tracking-widest text-base-content/40 mb-0.5">{info?.team}</div>
                    <div className="font-black text-sm leading-tight" style={{ color }}>
                      {info?.fn?.toUpperCase()} {info?.ln?.toUpperCase()}
                    </div>
                  </div>

                  {/* Lap time — BIG */}
                  <div className="my-1.5">
                    <div className="font-mono font-black text-2xl leading-none" style={{ color }}>
                      {fmtT(sl.time)}
                    </div>
                    {delta !== null ? (
                      <div className="text-xs font-mono text-red-400 mt-0.5">+{delta.toFixed(3)}</div>
                    ) : (
                      <div className="text-[9px] text-primary mt-0.5">● Fastest of selected</div>
                    )}
                  </div>

                  {/* Tyre + lap info */}
                  {lap && lap.compound !== 'UNKNOWN' && (
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <div className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-black shadow-md"
                        style={{ background: cc, color: isWhite ? '#000' : '#fff' }}>
                        {lap.compound[0]}
                      </div>
                      <span className="text-[9px] font-mono text-base-content/50">
                        {lap.compound} · {lap.life}L
                        {lap.fresh ? ' · 🆕 New' : ''}
                        {lap.pb ? ' · 🟣 PB' : ''}
                      </span>
                    </div>
                  )}

                  {/* Sector grid */}
                  {lap?.s1 != null && (
                    <div className="grid grid-cols-3 gap-1 mb-1.5">
                      {[
                        ['S1', lap.s1, '#60a5fa'],
                        ['S2', lap.s2, '#4ade80'],
                        ['S3', lap.s3, '#f472b6'],
                      ].map(([s, v, c]) => (
                        <div key={s as string} className="text-center rounded-lg py-1"
                          style={{ background: `${c}15`, border: `1px solid ${c}30` }}>
                          <div className="text-[7px] font-bold tracking-wider mb-0.5" style={{ color: c as string }}>{s}</div>
                          <div className="text-[9px] font-mono font-bold text-base-content/80">
                            {(v as number | null)?.toFixed(3) ?? '—'}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Speed trap footer */}
              {(lap?.vfl != null || maxSpeed != null) && (
                <div className="border-t px-3 py-2 grid grid-cols-4 gap-1"
                  style={{ borderColor: `${color}20`, background: `${color}08` }}>
                  {[
                    ['MAX',   maxSpeed ? `${Math.round(maxSpeed)}` : '—', 'km/h'],
                    ['FL',    lap?.vfl   != null ? `${Math.round(lap.vfl!)}`   : '—', 'km/h'],
                    ['T1',    lap?.vi1   != null ? `${Math.round(lap.vi1!)}`   : '—', 'km/h'],
                    ['T2',    lap?.vi2   != null ? `${Math.round(lap.vi2!)}`   : '—', 'km/h'],
                  ].map(([label, val, unit]) => (
                    <div key={label} className="text-center">
                      <div className="text-[7px] font-bold text-base-content/30 uppercase tracking-wide">{label}</div>
                      <div className="text-[11px] font-mono font-black text-base-content/80">{val}</div>
                      <div className="text-[6px] text-base-content/20">{unit}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
