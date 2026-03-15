export function ThemeScript() {
  return (
    <script dangerouslySetInnerHTML={{__html:`
      try{const s=JSON.parse(localStorage.getItem('ti-pitwall-v1')||'{}');const t=s?.state?.theme||'tracinginsights';document.documentElement.setAttribute('data-theme',t)}catch(e){}
    `}}/>
  )
}
