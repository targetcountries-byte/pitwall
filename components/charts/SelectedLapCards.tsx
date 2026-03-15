'use client'
import type { DriverData, LapRow } from '@/lib/api'
import { COMPOUND_COLORS } from '@/lib/constants'

function fmtT(t: number | null) {
  if (t == null) return '—'
  const m = Math.floor(t / 60), s = (t % 60).toFixed(3).padStart(6, '0')
  return m > 0 ? `${m}:${s}` : (t % 60).toFixed(3)
}

interface SelLap { key: string; driver: string; lap: number; time: number }

export function SelectedLapCards({
  selLaps, drivers, available
}: {
  selLaps: SelLap[]
  drivers: DriverData[]
  available: { driver: string; color: string; fn: string; ln: string; url: string; team: string }[]
}) {
  if (!selLaps.length) return null

  // Sort by lap time ascending (fastest first like TI)
  const sorted = [...selLaps].sort((a, b) => (a.time ?? 9999) - (b.time ?? 9999))
  const bestTime = sorted[0]?.time ?? 0

  return (
    <div className="mt-3" id="selectedLapsCards">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-bold text-primary/60 uppercase tracking-widest">Selected Lap Summaries</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {sorted.map((sl, idx) => {
          const info = available.find(d => d.driver === sl.driver)
          const dd = drivers.find(d => d.code === sl.driver)
          const lap = dd?.laps.find(l => l.lap === sl.lap)
          const tel = dd?.tel
          const color = info?.color ?? '#888'
          const delta = idx === 0 ? 0 : sl.time - bestTime
          const cc = COMPOUND_COLORS[lap?.compound ?? 'UNKNOWN'] ?? '#888'
          const maxSpeed = tel?.length ? Math.max(...tel.map(p => p.speed).filter(v => v > 0)) : null
          const isWhite = cc === '#f0f0ec'

          return (
            <div key={sl.key} className="rounded-xl overflow-hidden border"
              style={{ borderColor: color + '30', background: 'rgba(5,10,25,0.85)' }}>

              {/* Color strip top */}
              <div className="h-0.5" style={{ background: color }}/>

              <div className="flex gap-0 min-h-[120px]">
                {/* Driver photo - left column */}
                <div className="w-[90px] sm:w-[100px] shrink-0 relative overflow-hidden"
                  style={{ background: color + '15' }}>
                  {info?.url ? (
                    <img src={info.url} alt={sl.driver}
                      className="w-full h-full object-cover object-top absolute inset-0"
                      style={{ maxHeight: 160 }}
                      onError={e => {
                        const t = e.target as HTMLImageElement
                        t.style.display = 'none'
                        t.nextElementSibling?.classList.remove('hidden')
                      }}/>
                  ) : null}
                  <div className={`${info?.url ? 'hidden' : 'flex'} w-full h-full items-center justify-center text-3xl font-bold font-mono absolute inset-0`}
                    style={{ color }}>
                    {sl.driver[0]}
                  </div>
                  {/* Compound badge overlay */}
                  {lap && lap.compound !== 'UNKNOWN' && (
                    <div className="absolute bottom-1.5 left-1.5 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shadow-lg"
                      style={{ background: cc, color: isWhite ? '#000' : '#fff', border: '1px solid rgba(0,0,0,0.5)' }}>
                      {lap.compound[0]}
                    </div>
                  )}
                  {/* Stint number */}
                  {lap && (
                    <div className="absolute top-1 right-1 text-[8px] font-mono text-white/60 bg-black/40 rounded px-1">
                      {lap.life}L
                    </div>
                  )}
                </div>

                {/* Main data - right column */}
                <div className="flex-1 min-w-0 p-2.5">
                  {/* Driver name + position */}
                  <div className="flex items-start justify-between mb-1">
                    <div>
                      <div className="font-bold text-xs uppercase tracking-wide" style={{ color }}>
                        {info?.fn?.toUpperCase()} {info?.ln?.toUpperCase()}
                      </div>
                      <div className="text-[9px] text-base-content/35 truncate">{info?.team}</div>
                    </div>
                    {/* Position badge */}
                    <div className="w-6 h-6 rounded-full border-2 flex items-center justify-center text-[9px] font-bold shrink-0 ml-1"
                      style={{ borderColor: color, color, background: color + '20' }}>
                      {(lap?.pos && lap.pos > 0) ? lap.pos : (idx + 1)}
                    </div>
                  </div>

                  {/* Lap time - large */}
                  <div className="font-mono font-bold text-xl leading-none mb-0.5" style={{ color }}>
                    {fmtT(sl.time)}
                  </div>

                  {/* Delta */}
                  {idx > 0 && (
                    <div className="text-xs font-mono text-error mb-1">+{delta.toFixed(3)}</div>
                  )}
                  {idx === 0 && <div className="text-[9px] text-primary mb-1">● FASTEST</div>}

                  {/* Sector times */}
                  {lap?.s1 != null && (
                    <div className="flex gap-1 mb-1.5">
                      {[['S1', lap.s1, '#60a5fa'], ['S2', lap.s2, '#4ade80'], ['S3', lap.s3, '#f472b6']].map(([s, v, c]) => (
                        <div key={s as string} className="flex-1 text-center rounded px-1 py-0.5"
                          style={{ background: 'rgba(255,255,255,0.04)' }}>
                          <div className="text-[7px] font-bold" style={{ color: c as string }}>{s}</div>
                          <div className="text-[9px] font-mono font-semibold text-base-content/70">
                            {(v as number)?.toFixed(3) ?? '—'}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Speed traps */}
                  <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
                    {[
                      ['MAX SPEED', maxSpeed ? `${Math.round(maxSpeed)} km/h` : '—'],
                      ['FL SPEED', lap?.vfl != null ? `${Math.round(lap.vfl)} km/h` : '—'],
                      ['S1 TRAP', lap?.vi1 != null ? `${Math.round(lap.vi1)} km/h` : '—'],
                      ['S2 TRAP', lap?.vi2 != null ? `${Math.round(lap.vi2)} km/h` : '—'],
                    ].map(([label, val]) => (
                      <div key={label}>
                        <div className="text-[7px] text-base-content/25 font-bold uppercase tracking-wide">{label}</div>
                        <div className="text-[9px] font-mono text-base-content/60 font-semibold">{val}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
