export default function RecruiterPlaceholder({ title, description }) {
  return <section aria-labelledby="recruiter-page-title" className="glass-panel-strong rounded-[32px] px-6 py-12 sm:px-8">
    <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-fuchsia-600 dark:text-fuchsia-300">Coming soon</p>
    <h2 id="recruiter-page-title" className="text-2xl font-semibold">{title}</h2>
    <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600 dark:text-slate-400">{description}</p>
  </section>;
}
