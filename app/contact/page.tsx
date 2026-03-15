export default function ContactPage() {
  return (
    <div className="container mx-auto max-w-screen-xl px-4 py-4">
      <div className="bg-base-100/30 backdrop-blur-md rounded-xl border border-white/10 shadow-2xl p-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-primary mb-2">Contact</h1>
        <p className="text-base-content/50 mb-6">Get in touch with the TracingInsights team.</p>
        <div className="space-y-3">
          {[
            { label: 'Website', href: 'https://tracinginsights.com/contact/', icon: '🌐' },
            { label: 'Twitter / X', href: 'https://x.com/tracinginsights', icon: '🐦' },
            { label: 'Email', href: 'mailto:tracing.insights@gmail.com', icon: '📧' },
            { label: 'Reddit', href: 'https://www.reddit.com/r/TracingInsights/', icon: '🔴' },
          ].map(item => (
            <a key={item.href} href={item.href} target="_blank"
              className="flex items-center gap-3 p-4 bg-base-200/40 rounded-xl border border-white/5 hover:border-primary/30 transition-all group">
              <span className="text-2xl">{item.icon}</span>
              <span className="font-semibold group-hover:text-primary transition-colors">{item.label}</span>
              <span className="ml-auto text-primary opacity-0 group-hover:opacity-100 transition-opacity">→</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}
