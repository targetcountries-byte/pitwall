import type { Metadata } from 'next'
import './globals.css'
import { NavBar } from '@/components/ui/NavBar'
import { ThemeScript } from '@/components/ui/ThemeScript'

export const metadata: Metadata = {
  title: 'TracingInsights — F1 Analytics',
  description: 'F1 Racing Analytics - Lap Times, Telemetry Data & Race Insights. Download, edit, and share charts freely.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="tracinginsights" suppressHydrationWarning>
      <head><ThemeScript/></head>
      <body className="min-h-screen antialiased">
        <NavBar/>
        <main className="pb-20">{children}</main>
      </body>
    </html>
  )
}
