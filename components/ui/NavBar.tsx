'use client'
import Link from 'next/link'
import { useStore } from '@/lib/store'
import { THEMES, ANALYSIS_PAGES } from '@/lib/constants'

export function NavBar() {
  const { theme, setTheme, lang, setLang } = useStore()
  const LANGS = [['EN','🇬🇧 English'],['FR','🇫🇷 Français'],['ES','🇪🇸 Español'],['ID','🇮🇩 Bahasa Indonesia'],['PT','🇵🇹 Português']]
  const SOCIALS = [
    { href:'https://x.com/tracinginsights', label:'🐦 Twitter / X' },
    { href:'https://instagram.com/tracinginsights', label:'📸 Instagram' },
    { href:'https://www.reddit.com/r/TracingInsights/', label:'🔴 Reddit' },
    { href:'https://bsky.app/profile/tracinginsights.com', label:'🦋 Bluesky' },
    { href:'https://www.youtube.com/channel/UCehTBMnvLYkCbneNuC8d4_A', label:'▶️ YouTube' },
    { href:'https://t.me/tracinginsights', label:'📱 Telegram' },
    { href:'https://tracinginsights.substack.com/', label:'📧 SubStack' },
  ]

  return (
    <div className="navbar bg-primary text-primary-content px-2 sm:px-4 min-h-12 sticky top-0 z-[200] shadow-lg">
      {/* Mobile drawer */}
      <div className="navbar-start">
        <div className="drawer lg:hidden">
          <input id="mobile-menu-drawer" type="checkbox" className="drawer-toggle"/>
          <div className="drawer-content">
            <label htmlFor="mobile-menu-drawer" className="btn btn-ghost btn-sm p-1 text-primary-content">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16"/>
              </svg>
            </label>
          </div>
          <div className="drawer-side z-[300]">
            <label htmlFor="mobile-menu-drawer" className="drawer-overlay"/>
            <div className="min-h-full w-72 bg-base-200 text-base-content p-4 flex flex-col gap-1 overflow-y-auto">
              <Link href="/" className="font-bold text-primary text-lg mb-2">Tracing Insights</Link>
              <div className="divider my-0.5 text-xs opacity-40">Analysis</div>
              {ANALYSIS_PAGES.slice(0,8).map(p => <Link key={p.slug} href={`/analysis/${p.slug}`} className="text-sm py-1 px-2 rounded hover:bg-base-300">{p.label}</Link>)}
              <Link href="/analysis" className="text-sm py-1 px-2 rounded hover:bg-base-300 text-primary font-semibold">All Analysis →</Link>
              <div className="divider my-0.5 text-xs opacity-40">Schedule</div>
              <Link href="/f1/2026/schedule" className="text-sm py-1 px-2 rounded hover:bg-base-300">F1 Schedule</Link>
              <Link href="/f2/2026/schedule" className="text-sm py-1 px-2 rounded hover:bg-base-300">F2 Schedule</Link>
              <Link href="/f3/2026/schedule" className="text-sm py-1 px-2 rounded hover:bg-base-300">F3 Schedule</Link>
              <div className="divider my-0.5 text-xs opacity-40">Dash</div>
              <Link href="/penalty-points" className="text-sm py-1 px-2 rounded hover:bg-base-300">Penalty Points</Link>
              <Link href="/driver-of-the-day" className="text-sm py-1 px-2 rounded hover:bg-base-300">Driver of the Day</Link>
              <div className="divider my-0.5 text-xs opacity-40">More</div>
              <Link href="/blog" className="text-sm py-1 px-2 rounded hover:bg-base-300">Blog</Link>
              <Link href="/data" className="text-sm py-1 px-2 rounded hover:bg-base-300">Data</Link>
              <Link href="/contact" className="text-sm py-1 px-2 rounded hover:bg-base-300">Contact</Link>
              {SOCIALS.map(s => <a key={s.href} href={s.href} target="_blank" className="text-sm py-1 px-2 rounded hover:bg-base-300">{s.label}</a>)}
            </div>
          </div>
        </div>

        <Link href="/" className="btn btn-ghost text-primary-content font-bold normal-case text-sm sm:text-base px-2 gap-1">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" opacity="0.9">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
          </svg>
          <span className="hidden sm:inline">Tracing Insights</span>
        </Link>
      </div>

      {/* Desktop nav — exact match to TI: Analysis, Blog, Schedule, Dash, Socials, Contact, Data */}
      <div className="navbar-center hidden lg:flex">
        <ul className="menu menu-horizontal gap-0 text-sm">
          {/* Analysis */}
          <li>
            <details>
              <summary className="font-semibold px-3 py-2">Analysis</summary>
              <ul className="bg-base-200 text-base-content rounded-xl shadow-2xl border border-base-300 z-[300] p-2 w-56 max-h-80 overflow-y-auto flex-nowrap left-0">
                <li><Link href="/analysis" className="text-xs py-1.5 font-bold text-primary rounded-lg">All Analysis</Link></li>
                <div className="divider my-0.5"/>
                {ANALYSIS_PAGES.map(p => (
                  <li key={p.slug}><Link href={`/analysis/${p.slug}`} className="text-xs py-1.5 rounded-lg">{p.label}</Link></li>
                ))}
              </ul>
            </details>
          </li>
          <li><Link href="/blog" className="font-semibold px-3 py-2">Blog</Link></li>
          {/* Schedule */}
          <li>
            <details>
              <summary className="font-semibold px-3 py-2">Schedule</summary>
              <ul className="bg-base-200 text-base-content rounded-xl shadow-2xl border border-base-300 z-[300] p-2 w-52">
                <li><Link href="/f1/2026/schedule"    className="text-xs py-1.5 rounded-lg">F1 Schedule</Link></li>
                <li><Link href="/f2/2026/schedule"    className="text-xs py-1.5 rounded-lg">F2 Schedule</Link></li>
                <li><Link href="/f3/2026/schedule"    className="text-xs py-1.5 rounded-lg">F3 Schedule</Link></li>
                <li><Link href="/f1academy/2026/schedule" className="text-xs py-1.5 rounded-lg">F1Academy Schedule</Link></li>
                <li><Link href="/formulae/2026/schedule" className="text-xs py-1.5 rounded-lg">Formula E Schedule</Link></li>
              </ul>
            </details>
          </li>
          {/* Dash */}
          <li>
            <details>
              <summary className="font-semibold px-3 py-2">Dash</summary>
              <ul className="bg-base-200 text-base-content rounded-xl shadow-2xl border border-base-300 z-[300] p-2 w-48">
                <li><Link href="/penalty-points"    className="text-xs py-1.5 rounded-lg">Penalty Points</Link></li>
                <li><Link href="/driver-of-the-day" className="text-xs py-1.5 rounded-lg">Driver of the Day</Link></li>
              </ul>
            </details>
          </li>
          {/* Socials — TI has this */}
          <li>
            <details>
              <summary className="font-semibold px-3 py-2">Socials</summary>
              <ul className="bg-base-200 text-base-content rounded-xl shadow-2xl border border-base-300 z-[300] p-2 w-48">
                {SOCIALS.map(s => (
                  <li key={s.href}><a href={s.href} target="_blank" className="text-xs py-1.5 rounded-lg">{s.label}</a></li>
                ))}
              </ul>
            </details>
          </li>
          <li><Link href="/contact" className="font-semibold px-3 py-2">Contact</Link></li>
          <li><Link href="/data"    className="font-semibold px-3 py-2">Data</Link></li>
        </ul>
      </div>

      {/* Right: theme + lang + support */}
      <div className="navbar-end gap-0.5">
        <div className="dropdown dropdown-end">
          <label tabIndex={0} className="btn btn-ghost btn-sm text-primary-content text-xs px-2 gap-1">🎨</label>
          <ul tabIndex={0} className="dropdown-content menu bg-base-200 text-base-content rounded-xl z-[300] w-44 p-1.5 shadow-2xl border border-base-300 max-h-80 overflow-y-auto flex-nowrap">
            {THEMES.map(t => (
              <li key={t.id}>
                <button onClick={() => setTheme(t.id)}
                  className={`text-xs py-1.5 w-full text-left px-2 rounded-lg hover:bg-base-300 flex justify-between items-center ${theme===t.id?'text-primary font-bold bg-primary/10':''}`}>
                  {t.label} {theme===t.id&&<span>✓</span>}
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div className="dropdown dropdown-end">
          <label tabIndex={0} className="btn btn-ghost btn-sm text-primary-content text-xs px-2">{lang}</label>
          <ul tabIndex={0} className="dropdown-content menu bg-base-200 text-base-content rounded-xl z-[300] w-48 p-1.5 shadow-2xl border border-base-300">
            {LANGS.map(([c,l]) => (
              <li key={c}><button onClick={() => setLang(c)} className="text-xs py-1.5">{l}</button></li>
            ))}
          </ul>
        </div>
        <a href="https://tracinginsights.com/support/" target="_blank"
          className="btn btn-ghost btn-sm text-primary-content text-xs px-2 hidden md:flex">Support</a>
      </div>
    </div>
  )
}
