const metricGroups = [
  {
    title: "Repeated voluntary usage",
    metrics: ["Week 1 return", "Week 4 return", "Reflection recurrence"],
  },
  {
    title: "Reflection usefulness",
    metrics: ["Useful reflections", "Somewhat useful", "Not useful"],
  },
  {
    title: "Retrieval quality",
    metrics: ["Searches used", "Found it", "Close", "Missed"],
  },
  {
    title: "Insight quality",
    metrics: ["Insights opened", "Useful", "Generic tone tags", "Invasive tone tags"],
  },
];

export default function AlphaDashboardPage() {
  return (
    <main className="min-h-screen px-6 py-8">
      <div className="mx-auto max-w-6xl">
        <header className="border-b border-slate-200 pb-5">
          <h1 className="text-2xl font-semibold">Alpha Retention Dashboard</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Privacy-safe dashboard scaffold. It should show behavioral evidence, not reflection
            content, prompts, transcripts, or raw search queries.
          </p>
        </header>
        <section className="grid gap-4 py-8 md:grid-cols-2">
          {metricGroups.map((group) => (
            <div key={group.title} className="rounded-lg border border-slate-200 bg-white p-5">
              <h2 className="text-base font-semibold">{group.title}</h2>
              <div className="mt-4 grid gap-3">
                {group.metrics.map((metric) => (
                  <div key={metric} className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">{metric}</span>
                    <span className="font-mono text-slate-400">pending</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
