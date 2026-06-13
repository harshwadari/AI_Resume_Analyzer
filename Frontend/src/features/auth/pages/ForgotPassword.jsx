import React, { useState } from "react";
import { ArrowRight, Mail, ArrowLeft, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import LoadingSpinner from "../../../components/ui/LoadingSpinner.jsx";
import ThemeToggle from "../../../components/ui/ThemeToggle.jsx";
import { forgotPassword } from "../../../services/auth.api";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const onSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }

    try {
      setLoading(true);
      await forgotPassword({ email });
      setSuccess(true);
    } catch (err) {
      setError(err?.response?.data?.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-shell flex min-h-screen items-center justify-center px-4 py-8">
      <div className="w-full max-w-6xl overflow-hidden rounded-[36px] border border-slate-200/70 bg-white/75 shadow-[0_25px_80px_rgba(15,23,42,0.14)] backdrop-blur dark:border-white/10 dark:bg-slate-950/75">
        <div className="grid lg:grid-cols-[0.95fr,1.05fr]">
          {/* ── Left Panel: Decorative ── */}
          <section className="hidden bg-gradient-to-br from-violet-600 via-purple-500 to-fuchsia-500 p-10 text-white lg:flex lg:flex-col lg:justify-between">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1 text-xs font-semibold uppercase tracking-[0.26em]">
              <Sparkles size={14} />
              Account Recovery
            </div>

            <div>
              <h1 className="max-w-md text-5xl font-semibold leading-tight">
                Forgot your password? No worries.
              </h1>
              <p className="mt-5 max-w-md text-base leading-8 text-white/85">
                Enter your email and we'll send you a secure link to reset your password. The link expires in 15 minutes.
              </p>
            </div>

            <div className="rounded-[28px] border border-white/20 bg-white/10 p-6">
              <div className="text-sm font-medium text-white/90">How it works</div>
              <ul className="mt-4 space-y-3 text-sm leading-7 text-white/80">
                <li>1. Enter your registered email address</li>
                <li>2. Check your inbox for the reset link</li>
                <li>3. Click the link and set a new password</li>
              </ul>
            </div>
          </section>

          {/* ── Right Panel: Form ── */}
          <section className="p-6 sm:p-8 lg:p-10">
            <div className="mb-8 flex items-center justify-between">
              <Link to="/login" className="inline-flex items-center gap-1 text-sm font-medium text-slate-600 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
                <ArrowLeft size={14} />
                Back to login
              </Link>
              <ThemeToggle />
            </div>

            <div className="mx-auto max-w-md">
              <div className="inline-flex items-center gap-2 rounded-full bg-violet-500/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-violet-600 dark:text-violet-300">
                <Mail size={14} />
                Password recovery
              </div>
              <h2 className="mt-5 text-4xl font-semibold text-slate-950 dark:text-slate-50">Reset your password</h2>
              <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-400">
                Enter the email address associated with your account and we'll send you a password reset link.
              </p>

              {success ? (
                /* ── Success State ── */
                <div className="mt-8 space-y-4">
                  <div className="rounded-2xl border border-emerald-300/60 bg-emerald-50 px-6 py-5 dark:border-emerald-500/20 dark:bg-emerald-500/10">
                    <h3 className="text-base font-semibold text-emerald-700 dark:text-emerald-200">Check your email</h3>
                    <p className="mt-2 text-sm leading-7 text-emerald-600 dark:text-emerald-300">
                      If an account exists with <strong>{email}</strong>, we've sent a password reset link. Please check your inbox and spam folder.
                    </p>
                  </div>
                  <Link
                    to="/login"
                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-4 py-3.5 text-sm font-semibold text-white transition hover:-translate-y-0.5"
                  >
                    Back to Login
                    <ArrowRight size={16} />
                  </Link>
                </div>
              ) : (
                /* ── Form State ── */
                <form onSubmit={onSubmit} className="mt-8 space-y-4">
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Email</span>
                    <input
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full rounded-2xl border border-slate-300/70 bg-white/70 px-4 py-3.5 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:ring-4 focus:ring-violet-500/10 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-100"
                    />
                  </label>

                  {error && (
                    <div className="rounded-2xl border border-rose-300/60 bg-rose-50 px-4 py-3 text-sm text-rose-600 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200">
                      {error}
                    </div>
                  )}

                  {loading && (
                    <p className="text-center text-xs text-slate-500 dark:text-slate-400">
                      This may take up to a minute — please wait…
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-4 py-3.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-75"
                  >
                    {loading && <LoadingSpinner size="sm" className="border-white/20 border-t-white" />}
                    <span>{loading ? "Sending reset link..." : "Send Reset Link"}</span>
                    {!loading && <ArrowRight size={16} />}
                  </button>
                </form>
              )}

              <p className="mt-6 text-sm text-slate-600 dark:text-slate-400">
                Remember your password?{" "}
                <Link to="/login" className="font-semibold text-violet-600 hover:underline dark:text-violet-300">
                  Login
                </Link>
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
