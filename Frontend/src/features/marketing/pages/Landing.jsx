import React, { useState } from "react";
import { ArrowRight, BrainCircuit, CheckCircle2, FileDown, MoonStar, ShieldCheck, Sparkles, Target, Wand2 } from "lucide-react";
import { Link } from "react-router-dom";
import heroImage from "../../../assets/Product_logo.png";
import ThemeToggle from "../../../components/ui/ThemeToggle.jsx";
import { useAuth } from "../../auth/hooks/useAuth";
import { contact } from "../../../services/auth.api";

const featureCards = [
  {
    icon: Target,
    title: "Role-aware prep",
    text: "Paste the job description and get interview preparation tailored to the exact role you are targeting."
  },
  {
    icon: BrainCircuit,
    title: "AI-generated questions",
    text: "Generate technical and behavioral questions with intention and model answers so you know what good looks like."
  },
  {
    icon: FileDown,
    title: "Downloadable report",
    text: "Export your interview analysis as a PDF and keep a clean prep document ready for revision."
  },
  {
    icon: MoonStar,
    title: "Light and dark themes",
    text: "Switch the entire experience between themes without losing your place in the workflow."
  }
];

const processSteps = [
  "Add the target job description and your own background.",
  "Let the app analyze fit, strengths, skill gaps, and interview focus areas.",
  "Review your questions, roadmap, and export the report for practice."
];

const Landing = () => {
  const { user, initialLoading } = useAuth();

  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactMessage, setContactMessage] = useState("");
  const [contactLoading, setContactLoading] = useState(false);
  const [contactSuccess, setContactSuccess] = useState("");
  const [contactError, setContactError] = useState("");

  const handleContactSubmit = async (e) => {
    e.preventDefault();
    setContactError("");
    setContactSuccess("");

    if (!contactName.trim() || !contactEmail.trim() || !contactMessage.trim()) {
      setContactError("All fields are required.");
      return;
    }

    if (contactMessage.trim().length < 10) {
      setContactError("Message must be at least 10 characters long.");
      return;
    }

    try {
      setContactLoading(true);
      const res = await contact({ name: contactName, email: contactEmail, message: contactMessage });
      setContactSuccess(res.message || "Your message has been sent successfully!");
      setContactName("");
      setContactEmail("");
      setContactMessage("");
    } catch (err) {
      setContactError(err?.response?.data?.message || "Failed to send message. Please try again.");
    } finally {
      setContactLoading(false);
    }
  };

  return (
    <div className="page-shell px-4 py-6 text-slate-900 dark:text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="sticky top-4 z-50 mb-8 rounded-[28px] border border-white/55 bg-white/42 px-5 py-4 shadow-[0_20px_60px_rgba(15,23,42,0.14)] backdrop-blur-[28px] supports-[backdrop-filter]:bg-white/28 dark:border-white/12 dark:bg-slate-950/40 dark:shadow-[0_20px_60px_rgba(2,6,23,0.45)] dark:supports-[backdrop-filter]:bg-slate-950/26 sm:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-fuchsia-500 to-orange-400 text-white shadow-lg">
                <Wand2 size={20} />
              </div>
              <div>
                <div className="text-lg font-semibold">PrepWise AI</div>
                <div className="text-sm text-slate-600 dark:text-slate-400">
                  AI interview planning for modern developers
                </div>
              </div>
            </div>

            <nav className="flex flex-wrap items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
              <a href="#features" className="rounded-full bg-white/22 px-3 py-2 backdrop-blur-xl transition hover:bg-white/35 dark:bg-white/[0.04] dark:hover:bg-white/[0.08]">Features</a>
              <a href="#workflow" className="rounded-full bg-white/22 px-3 py-2 backdrop-blur-xl transition hover:bg-white/35 dark:bg-white/[0.04] dark:hover:bg-white/[0.08]">Workflow</a>
              <a href="#contact" className="rounded-full bg-white/22 px-3 py-2 backdrop-blur-xl transition hover:bg-white/35 dark:bg-white/[0.04] dark:hover:bg-white/[0.08]">Contact</a>
              <div className="rounded-full bg-white/20 p-1 backdrop-blur-xl dark:bg-white/[0.05]">
                <ThemeToggle />
              </div>
              <Link
                to={user ? "/workspace" : "/login"}
                className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 dark:bg-white dark:text-slate-950"
              >
                {initialLoading ? "Loading..." : user ? "Open workspace" : "Login"}
                <ArrowRight size={16} />
              </Link>
            </nav>
          </div>
        </header>

        <main className="mt-6">
          <section className="grid items-center gap-8 lg:grid-cols-[1.08fr,0.92fr]">
            <div className="glass-panel-strong rounded-[36px] px-6 py-10 sm:px-10 sm:py-12">
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-emerald-600 dark:text-emerald-300">
                <Sparkles size={14} />
                Smarter interview prep
              </div>

              <h1 className="mt-6 max-w-3xl text-5xl font-semibold leading-[1.05] sm:text-6xl">
                Turn your resume and target role into a complete interview strategy.
              </h1>

              <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600 dark:text-slate-400">
                This project helps you generate role-specific technical questions, behavioral prompts, skill-gap insights,
                a structured preparation roadmap, and a downloadable report from a single workflow.
              </p>

              <div className="mt-8 flex flex-col gap-4 sm:flex-row">
                <Link
                  to={user ? "/workspace" : "/login"}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-fuchsia-500 to-orange-400 px-6 py-4 text-base font-semibold text-white transition hover:-translate-y-0.5"
                >
                  {user ? "Go to workspace" : "Login to start"}
                  <ArrowRight size={18} />
                </Link>
                <Link
                  to="/register"
                  className="inline-flex items-center justify-center rounded-2xl border border-slate-300/70 bg-white/70 px-6 py-4 text-base font-semibold text-slate-800 transition hover:-translate-y-0.5 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-100"
                >
                  Create account
                </Link>
              </div>

              <div className="mt-10 grid gap-4 sm:grid-cols-3">
                <div className="rounded-3xl bg-slate-900/5 p-5 dark:bg-white/5">
                  <div className="text-3xl font-semibold">Role fit</div>
                  <div className="mt-2 text-sm text-slate-600 dark:text-slate-400">Match score and missing skill visibility</div>
                </div>
                <div className="rounded-3xl bg-slate-900/5 p-5 dark:bg-white/5">
                  <div className="text-3xl font-semibold">Question bank</div>
                  <div className="mt-2 text-sm text-slate-600 dark:text-slate-400">Technical and behavioral prep in one place</div>
                </div>
                <div className="rounded-3xl bg-slate-900/5 p-5 dark:bg-white/5">
                  <div className="text-3xl font-semibold">Roadmap</div>
                  <div className="mt-2 text-sm text-slate-600 dark:text-slate-400">Daily prep plan built from your profile</div>
                </div>
              </div>
            </div>

            <div>
              <div className="glass-panel rounded-[36px] p-5">
                <img
                  src={heroImage}
                  alt="AI interview dashboard preview"
                  className="w-full rounded-[28px] border border-slate-200/70 object-cover shadow-2xl dark:border-white/10"
                />
              </div>

              <div className="glass-panel mt-6 rounded-[28px] p-6">
                <div className="flex items-center gap-3">
                  <ShieldCheck className="text-emerald-500" size={20} />
                  <div className="font-semibold text-lg">Focused preparation</div>
                </div>
                <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-400">
                  Reduce guesswork by practicing questions that align with your actual resume and the company role.
                </p>
              </div>
            </div>
          </section>

          <section id="features" className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {featureCards.map((feature) => {
              const Icon = feature.icon;
              return (
                <article key={feature.title} className="glass-panel rounded-[28px] p-6">
                  <div className="inline-flex rounded-2xl bg-fuchsia-500/10 p-3 text-fuchsia-500 dark:text-fuchsia-300">
                    <Icon size={22} />
                  </div>
                  <h2 className="mt-5 text-xl font-semibold">{feature.title}</h2>
                  <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-400">{feature.text}</p>
                </article>
              );
            })}
          </section>

          <section id="workflow" className="mt-8 grid gap-8 lg:grid-cols-[0.85fr,1.15fr]">
            <div className="glass-panel rounded-[32px] p-8">
              <div className="text-sm font-semibold uppercase tracking-[0.28em] text-fuchsia-600 dark:text-fuchsia-300">
                Workflow
              </div>
              <h2 className="mt-4 text-3xl font-semibold">How the project works</h2>
              <div className="mt-6 space-y-4">
                {processSteps.map((step, index) => (
                  <div key={step} className="flex gap-4 rounded-2xl bg-slate-900/5 p-4 dark:bg-white/5">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-slate-950 text-sm font-semibold text-white dark:bg-white dark:text-slate-950">
                      {index + 1}
                    </div>
                    <p className="text-sm leading-7 text-slate-700 dark:text-slate-300">{step}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-panel rounded-[32px] p-8">
              <div className="text-sm font-semibold uppercase tracking-[0.28em] text-orange-500 dark:text-orange-300">
                Why it helps
              </div>
              <h2 className="mt-4 text-3xl font-semibold">What you get from this app</h2>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                {[
                  "Cleaner prep than random interview lists",
                  "Role-specific focus instead of generic advice",
                  "Actionable roadmap for the next few practice days",
                  "A downloadable PDF summary you can revise offline",
                  "Fast login and protected workspace flow",
                  "A theme toggle that works across the whole app"
                ].map((item) => (
                  <div key={item} className="flex items-start gap-3 rounded-2xl bg-slate-900/5 p-4 dark:bg-white/5">
                    <CheckCircle2 className="mt-1 text-emerald-500" size={18} />
                    <span className="text-sm leading-6 text-slate-700 dark:text-slate-300">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </main>

      <section id="contact" className="mt-8">
        <div className="glass-panel-strong rounded-[32px] p-8 max-w-4xl mx-auto">
          <div className="text-center max-w-2xl mx-auto">
            <div className="inline-flex items-center gap-2 rounded-full bg-fuchsia-500/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-fuchsia-600 dark:text-fuchsia-300">
              Get in touch
            </div>
            <h2 className="mt-4 text-3xl font-semibold">Have questions or feedback?</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-400">
              Drop us a message below and we will get back to you in your email inbox as soon as possible.
            </p>
          </div>

          {contactSuccess ? (
            <div className="mt-8 rounded-2xl border border-emerald-300/60 bg-emerald-50 px-6 py-5 text-center dark:border-emerald-500/20 dark:bg-emerald-500/10">
              <h3 className="text-base font-semibold text-emerald-700 dark:text-emerald-200">Message Sent!</h3>
              <p className="mt-2 text-sm leading-7 text-emerald-600 dark:text-emerald-300">
                {contactSuccess}
              </p>
            </div>
          ) : (
            <form onSubmit={handleContactSubmit} className="mt-8 space-y-4 max-w-xl mx-auto">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Name</span>
                  <input
                    type="text"
                    placeholder="Your name"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    className="w-full rounded-2xl border border-slate-300/70 bg-white/70 px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-fuchsia-400 focus:ring-4 focus:ring-fuchsia-500/10 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-100"
                    required
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Email</span>
                  <input
                    type="email"
                    placeholder="you@example.com"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    className="w-full rounded-2xl border border-slate-300/70 bg-white/70 px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-fuchsia-400 focus:ring-4 focus:ring-fuchsia-500/10 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-100"
                    required
                  />
                </label>
              </div>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Message</span>
                <textarea
                  placeholder="Type your message here (min. 10 characters)..."
                  value={contactMessage}
                  onChange={(e) => setContactMessage(e.target.value)}
                  rows={4}
                  className="w-full rounded-2xl border border-slate-300/70 bg-white/70 px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-fuchsia-400 focus:ring-4 focus:ring-fuchsia-500/10 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-100"
                  required
                />
              </label>

              {contactError && (
                <div className="rounded-2xl border border-rose-300/60 bg-rose-50 px-4 py-3 text-sm text-rose-600 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200">
                  {contactError}
                </div>
              )}

              <button
                type="submit"
                disabled={contactLoading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-fuchsia-500 to-orange-400 px-4 py-3.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-75"
              >
                <span>{contactLoading ? "Sending..." : "Send Message"}</span>
                {!contactLoading && <ArrowRight size={16} />}
              </button>
            </form>
          )}
        </div>
      </section>

      <footer className="glass-panel mt-8 rounded-[36px] px-8 py-12">
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-fuchsia-500 to-orange-400 text-white font-bold">
                P
              </div>
              <div className="text-lg font-bold">PrepWise AI</div>
            </div>
            <p className="mt-4 text-sm leading-7 text-slate-600 dark:text-slate-400">
              AI interview planning for modern developers. Practice technical and behavioral questions tailored to your exact target role.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-900 dark:text-slate-50">Platform</h3>
            <ul className="mt-4 space-y-2 text-sm">
              <li>
                <Link to={user ? "/workspace" : "/login"} className="text-slate-600 hover:text-slate-950 dark:text-slate-400 dark:hover:text-slate-50">
                  Workspace
                </Link>
              </li>
              <li>
                <a href="#features" className="text-slate-600 hover:text-slate-950 dark:text-slate-400 dark:hover:text-slate-50">
                  Features
                </a>
              </li>
              <li>
                <a href="#workflow" className="text-slate-600 hover:text-slate-950 dark:text-slate-400 dark:hover:text-slate-50">
                  Workflow
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-900 dark:text-slate-50">Resources</h3>
            <ul className="mt-4 space-y-2 text-sm">
              <li>
                <a href="#" className="text-slate-600 hover:text-slate-950 dark:text-slate-400 dark:hover:text-slate-50">
                  Documentation
                </a>
              </li>
              <li>
                <a href="#" className="text-slate-600 hover:text-slate-950 dark:text-slate-400 dark:hover:text-slate-50">
                  Prep Guides
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-900 dark:text-slate-50">Legal</h3>
            <ul className="mt-4 space-y-2 text-sm">
              <li>
                <a href="#" className="text-slate-600 hover:text-slate-950 dark:text-slate-400 dark:hover:text-slate-50">
                  Privacy Policy
                </a>
              </li>
              <li>
                <a href="#" className="text-slate-600 hover:text-slate-950 dark:text-slate-400 dark:hover:text-slate-50">
                  Terms of Service
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 border-t border-slate-200 pt-8 dark:border-white/10 flex flex-col md:flex-row items-center justify-between text-xs text-slate-500">
          <div>
            &copy; {new Date().getFullYear()} PrepWise AI. All rights reserved.
          </div>
          <div className="mt-4 md:mt-0 flex gap-4">
            <span>Made for Developers</span>
          </div>
        </div>
      </footer>
      </div>
    </div>
  );
};

export default Landing;
