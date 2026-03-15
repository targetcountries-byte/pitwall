'use client'
import Link from 'next/link'
import { useStore } from '@/lib/store'
import { THEMES, ANALYSIS_PAGES } from '@/lib/constants'

export function NavBar() {
  const { theme, setTheme, lang, setLang } = useStore()
  const LANGS = [['EN','🇬🇧 English'],['FR','🇫🇷 Français'],['ES','🇪🇸 Español'],['ID','🇮🇩 Bahasa Indonesia'],['PT','🇵🇹 Português']]

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
              <div className="divider my-1 text-xs opacity-40">Analysis</div>
              {ANALYSIS_PAGES.slice(0,8).map(p => <Link key={p.slug} href={`/analysis/${p.slug}`} className="text-sm py-1 px-2 rounded hover:bg-base-300">{p.label}</Link>)}
              <Link href="/analysis" className="text-sm py-1 px-2 rounded hover:bg-base-300 text-primary font-semibold">All Analysis →</Link>
              <div className="divider my-1 text-xs opacity-40">Schedule</div>
              <Link href="/f1/2026/schedule" className="text-sm py-1 px-2 rounded hover:bg-base-300">F1 Schedule</Link>
              <Link href="/f2/2026/schedule" className="text-sm py-1 px-2 rounded hover:bg-base-300">F2 Schedule</Link>
              <Link href="/f3/2026/schedule" className="text-sm py-1 px-2 rounded hover:bg-base-300">F3 Schedule</Link>
              <div className="divider my-1 text-xs opacity-40">More</div>
              <Link href="/blog" className="text-sm py-1 px-2 rounded hover:bg-base-300">Blog</Link>
              <Link href="/data" className="text-sm py-1 px-2 rounded hover:bg-base-300">Data</Link>
              <Link href="/contact" className="text-sm py-1 px-2 rounded hover:bg-base-300">Contact</Link>
            </div>
          </div>
        </div>

        <Link href="/" className="btn btn-ghost text-primary-content font-bold normal-case text-sm sm:text-base px-2 gap-1">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10" fillOpacity="0.2" stroke="currentColor" strokeWidth="1.5"/><path d="M12 2L12 22M2 12L22 12" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.4"/><circle cx="12" cy="12" r="3" fill="currentColor"/></svg>
          <span className="hidden sm:inline">Tracing Insights</span>
        </Link>
      </div>

      {/* Desktop links */}
      <div className="navbar-center hidden lg:flex">
        <ul className="menu menu-horizontal gap-0 text-sm">
          <li>
            <details>
              <summary className="font-semibold px-3 py-2">Analysis</summary>
              <ul className="bg-base-200 text-base-content rounded-xl shadow-2xl border border-base-300 z-[300] p-2 w-56 max-h-80 overflow-y-auto flex-nowrap">
                <li><Link href="/analysis" className="text-xs py-1.5 font-bold text-primary">All Analysis</Link></li>
                <div className="divider my-0.5"/>
                {ANALYSIS_PAGES.map(p => <li key={p.slug}><Link href={`/analysis/${p.slug}`} className="text-xs py-1.5">{p.label}</Link></li>)}
              </ul>
            </details>
          </li>
          <li><Link href="/blog" className="font-semibold px-3 py-2">Blog</Link></li>
          <li>
            <details>
              <summary className="font-semibold px-3 py-2">Schedule</summary>
              <ul className="bg-base-200 text-base-content rounded-xl shadow-2xl border border-base-300 z-[300] p-2 w-48">
                <li><Link href="/f1/2026/schedule" className="text-xs py-1.5">F1 Schedule</Link></li>
                <li><Link href="/f2/2026/schedule" className="text-xs py-1.5">F2 Schedule</Link></li>
                <li><Link href="/f3/2026/schedule" className="text-xs py-1.5">F3 Schedule</Link></li>
                <li><Link href="/f1academy/2026/schedule" className="text-xs py-1.5">F1Academy Schedule</Link></li>
                <li><Link href="/formulae/2026/schedule" className="text-xs py-1.5">Formula E Schedule</Link></li>
              </ul>
            </details>
          </li>
          <li>
            <details>
              <summary className="font-semibold px-3 py-2">Dash</summary>
              <ul className="bg-base-200 text-base-content rounded-xl shadow-2xl border border-base-300 z-[300] p-2 w-48">
                <li><Link href="/penalty-points" className="text-xs py-1.5">Penalty Points</Link></li>
                <li><Link href="/driver-of-the-day" className="text-xs py-1.5">Driver of the Day</Link></li>
              </ul>
            </details>
          </li>
          <li><Link href="/contact" className="font-semibold px-3 py-2">Contact</Link></li>
          <li><Link href="/data" className="font-semibold px-3 py-2">Data</Link></li>
        </ul>
      </div>

      {/* Right: lang + theme */}
      <div className="navbar-end gap-0.5">
        {/* Theme */}
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

        {/* Language */}
        <div className="dropdown dropdown-end">
          <label tabIndex={0} className="btn btn-ghost btn-sm text-primary-content text-xs px-2">{lang}</label>
          <ul tabIndex={0} className="dropdown-content menu bg-base-200 text-base-content rounded-xl z-[300] w-44 p-1.5 shadow-2xl border border-base-300">
            {LANGS.map(([c,l]) => (
              <li key={c}><button onClick={() => setLang(c)} className="text-xs py-1.5">{l}</button></li>
            ))}
          </ul>
        </div>

        {/* Support button */}
        <a href="https://tracinginsights.com/support/" target="_blank"
          className="btn btn-ghost btn-sm text-primary-content text-xs px-2 hidden sm:flex">Support</a>
      </div>
    </div>
  )
}
