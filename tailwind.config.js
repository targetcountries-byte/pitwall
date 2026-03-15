/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,ts,jsx,tsx}','./components/**/*.{js,ts,jsx,tsx}'],
  plugins: [require('daisyui')],
  daisyui: {
    themes: [
      { tracinginsights: { primary:'#e8f000','primary-content':'#1a1a00',secondary:'#d4d4f0',accent:'#e8f000',neutral:'#1c1c2e','base-100':'#0f0f1a','base-200':'#1a1a2e','base-300':'#252540','base-content':'#d4d4f0',info:'#38bdf8',success:'#22c55e',warning:'#f59e0b',error:'#ef4444'}},
      { luxury: { primary:'#f5d060','primary-content':'#1a1000',secondary:'#c59b4d',accent:'#f5d060',neutral:'#1a1209','base-100':'#09090b','base-200':'#111113','base-300':'#1c1c1e','base-content':'#e8dcc8'}},
      { coffee: { primary:'#c8a97c','primary-content':'#1a1000',secondary:'#8b6914',accent:'#c8a97c',neutral:'#1f1612','base-100':'#1a120b','base-200':'#231a10','base-300':'#2d2215','base-content':'#e8d5b0'}},
      { night: { primary:'#38bdf8','primary-content':'#001220',secondary:'#818cf8',accent:'#f472b6',neutral:'#1e293b','base-100':'#0f172a','base-200':'#1e293b','base-300':'#334155','base-content':'#cbd5e1'}},
      { dim: { primary:'#9ca3af','primary-content':'#111',secondary:'#6b7280',accent:'#9ca3af',neutral:'#374151','base-100':'#1f2937','base-200':'#111827','base-300':'#0f172a','base-content':'#d1d5db'}},
      { mercedes: { primary:'#27F4D2','primary-content':'#001a17',secondary:'#00b4a0',accent:'#27F4D2',neutral:'#001a17','base-100':'#000d0b','base-200':'#001a17','base-300':'#002724','base-content':'#b0f8ee'}},
      { astonmartin: { primary:'#229971','primary-content':'#fff',secondary:'#00594a',accent:'#229971',neutral:'#001208','base-100':'#00080a','base-200':'#001510','base-300':'#002018','base-content':'#a0f0d0'}},
      { haas: { primary:'#B6BABD','primary-content':'#1a1a1a',secondary:'#e10600',accent:'#B6BABD',neutral:'#1a1a1a','base-100':'#0d0d0d','base-200':'#1a1a1a','base-300':'#262626','base-content':'#e0e0e0'}},
      { redbull: { primary:'#3671C6','primary-content':'#fff',secondary:'#cc1e4a',accent:'#3671C6',neutral:'#000a1a','base-100':'#000409','base-200':'#000a18','base-300':'#001026','base-content':'#c0d4f8'}},
      { williams: { primary:'#64C4FF','primary-content':'#001a2e',secondary:'#0057a8',accent:'#64C4FF',neutral:'#00101f','base-100':'#00060f','base-200':'#00101f','base-300':'#001830','base-content':'#b0e8ff'}},
      { racingbulls: { primary:'#6692FF','primary-content':'#fff',secondary:'#001489',accent:'#6692FF',neutral:'#00081a','base-100':'#000410','base-200':'#00081a','base-300':'#000d26','base-content':'#c0d0ff'}},
      { mclaren: { primary:'#FF8000','primary-content':'#1a0600',secondary:'#cc2200',accent:'#FF8000',neutral:'#1a0e00','base-100':'#0d0700','base-200':'#1a0e00','base-300':'#261500','base-content':'#ffdebc'}},
      { sauber: { primary:'#52E252','primary-content':'#001a00',secondary:'#00a000',accent:'#52E252',neutral:'#001200','base-100':'#000a00','base-200':'#001200','base-300':'#001c00','base-content':'#c0ffc0'}},
      { alpine: { primary:'#FF87BC','primary-content':'#1a001a',secondary:'#0090ff',accent:'#FF87BC',neutral:'#1a0010','base-100':'#0d0008','base-200':'#1a0010','base-300':'#260018','base-content':'#ffd0e8'}},
      { ferrari: { primary:'#E8002D','primary-content':'#fff',secondary:'#ffcc00',accent:'#E8002D',neutral:'#1a0000','base-100':'#0d0000','base-200':'#1a0000','base-300':'#260000','base-content':'#ffc8c8'}},
      'synthwave','halloween','forest','dracula',
      { sunset: { primary:'#ff6b35','primary-content':'#fff',secondary:'#ffd166',accent:'#ff6b35',neutral:'#1a0f00','base-100':'#0d0700','base-200':'#1a0e00','base-300':'#261500','base-content':'#ffd0b0'}},
    ],
    defaultTheme: 'tracinginsights',
    darkTheme: 'tracinginsights',
    base: true, styled: true, utils: true,
  },
}
