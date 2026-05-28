import React, { useState } from "react";
import { ArrowRight, Eye, EyeOff, Sparkles, UserPlus } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import LoadingSpinner from "../../../components/ui/LoadingSpinner.jsx";
import ThemeToggle from "../../../components/ui/ThemeToggle.jsx";
import { useAuth } from "../hooks/useAuth";
import { getGoogleAuthUrl } from "../../../services/auth.api";

const Register = () => {
  const { loading, handleRegister, error } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState("");

  const onSubmit = async (event) => {
    event.preventDefault();
    setFormError("");

    if (!username.trim() || !email.trim() || !password.trim()) {
      setFormError("Please fill in username, email, and password.");
      return;
    }

    const result = await handleRegister({ username, email, password });
    if (result.success && result.requiresVerification) {
      // Navigate to OTP verification page, passing email in route state
      navigate("/verify-otp", { state: { email } });
    } else if (result.success) {
      navigate("/workspace");
    }
  };

  return (
    <div className="page-shell flex min-h-screen items-center justify-center px-4 py-8">
      <div className="w-full max-w-6xl overflow-hidden rounded-[36px] border border-slate-200/70 bg-white/75 shadow-[0_25px_80px_rgba(15,23,42,0.14)] backdrop-blur dark:border-white/10 dark:bg-slate-950/75">
        <div className="grid lg:grid-cols-[1.02fr,0.98fr]">
          <section className="p-6 sm:p-8 lg:p-10">
            <div className="mb-8 flex items-center justify-between">
              <Link to="/" className="text-sm font-medium text-slate-600 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
                Back to landing
              </Link>
              <ThemeToggle />
            </div>

            <div className="mx-auto max-w-md">
              <div className="inline-flex items-center gap-2 rounded-full bg-orange-500/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-orange-500 dark:text-orange-300">
                <UserPlus size={14} />
                Create account
              </div>
              <h2 className="mt-5 text-4xl font-semibold text-slate-950 dark:text-slate-50">Start your prep workspace</h2>
              <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-400">
                Register once, then generate interview plans, compare role fit, and export clean reports whenever you need them.
              </p>

              <form onSubmit={onSubmit} className="mt-8 space-y-4">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Username</span>
                  <input
                    type="text"
                    placeholder="Your name"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    className="w-full rounded-2xl border border-slate-300/70 bg-white/70 px-4 py-3.5 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-orange-400 focus:ring-4 focus:ring-orange-500/10 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-100"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Email</span>
                  <input
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="w-full rounded-2xl border border-slate-300/70 bg-white/70 px-4 py-3.5 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-orange-400 focus:ring-4 focus:ring-orange-500/10 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-100"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Password</span>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="Create a password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      className="w-full rounded-2xl border border-slate-300/70 bg-white/70 px-4 py-3.5 pr-12 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-orange-400 focus:ring-4 focus:ring-orange-500/10 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-100"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </label>

                {(formError || error) && (
                  <div className="rounded-2xl border border-rose-300/60 bg-rose-50 px-4 py-3 text-sm text-rose-600 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200">
                    {formError || error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-orange-400 to-fuchsia-500 px-4 py-3.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-75"
                >
                  {loading && <LoadingSpinner size="sm" className="border-white/20 border-t-white" />}
                  <span>{loading ? "Creating account..." : "Register"}</span>
                  {!loading && <ArrowRight size={16} />}
                </button>
              </form>

              <div className="relative my-6 flex items-center justify-center">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200 dark:border-white/10"></div>
                </div>
                <span className="relative bg-white px-4 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:bg-slate-950 dark:text-slate-400">
                  Or continue with
                </span>
              </div>

              <button
                type="button"
                onClick={() => {
                  window.location.href = getGoogleAuthUrl();
                }}
                className="inline-flex w-full items-center justify-center gap-2.5 rounded-2xl border border-slate-300/80 bg-white/70 px-4 py-3.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 hover:-translate-y-0.5 dark:border-white/10 dark:bg-slate-900/50 dark:text-slate-200 dark:hover:bg-slate-900/80"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    fill="#EA4335"
                  />
                </svg>
                <span>Sign up with Google</span>
              </button>

              <p className="mt-6 text-sm text-slate-600 dark:text-slate-400">
                Already have an account?{" "}
                <Link to="/login" className="font-semibold text-orange-500 hover:underline dark:text-orange-300">
                  Login
                </Link>
              </p>
            </div>
          </section>

          <section className="hidden bg-gradient-to-br from-slate-950 via-slate-900 to-fuchsia-950 p-10 text-white lg:flex lg:flex-col lg:justify-between">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.26em]">
              <Sparkles size={14} />
              Build your prep hub
            </div>

            <div>
              <h1 className="max-w-md text-5xl font-semibold leading-tight">
                Create your account and turn every job application into a prep plan.
              </h1>
              <p className="mt-5 max-w-md text-base leading-8 text-white/75">
                Your workspace helps you move from job description to focused practice questions, roadmap, and downloadable review material.
              </p>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-white/5 p-6">
              <div className="text-sm font-medium text-white/90">What changes after signup</div>
              <ul className="mt-4 space-y-3 text-sm leading-7 text-white/75">
                <li>Protected workspace for your reports</li>
                <li>Cleaner question review with section navigation</li>
                <li>PDF export and improved loading experience</li>
              </ul>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Register;
