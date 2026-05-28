import React, { useState } from "react";
import { ArrowRight, Eye, EyeOff, LogIn, Sparkles } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import LoadingSpinner from "../../../components/ui/LoadingSpinner.jsx";
import ThemeToggle from "../../../components/ui/ThemeToggle.jsx";
import { useAuth } from "../hooks/useAuth";
import { getGoogleAuthUrl } from "../../../services/auth.api";

const Login = () => {
  const { loading, handleLogin, error } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState("");

  const onSubmit = async (event) => {
    event.preventDefault();
    setFormError("");

    if (!email.trim() || !password.trim()) {
      setFormError("Please enter both email and password.");
      return;
    }

    const result = await handleLogin({ email, password });
    if (result.success) {
      navigate("/workspace");
    } else if (result.requiresVerification) {
      // Email not verified — redirect to OTP page
      navigate("/verify-otp", { state: { email: result.email } });
    }
  };

  return (
    <div className="page-shell flex min-h-screen items-center justify-center px-4 py-8">
      <div className="w-full max-w-6xl overflow-hidden rounded-[36px] border border-slate-200/70 bg-white/75 shadow-[0_25px_80px_rgba(15,23,42,0.14)] backdrop-blur dark:border-white/10 dark:bg-slate-950/75">
        <div className="grid lg:grid-cols-[0.95fr,1.05fr]">
          <section className="hidden bg-gradient-to-br from-fuchsia-500 via-rose-500 to-orange-400 p-10 text-white lg:flex lg:flex-col lg:justify-between">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1 text-xs font-semibold uppercase tracking-[0.26em]">
              <Sparkles size={14} />
              PrepWise AI
            </div>

            <div>
              <h1 className="max-w-md text-5xl font-semibold leading-tight">
                Practice smarter with role-aware interview preparation.
              </h1>
              <p className="mt-5 max-w-md text-base leading-8 text-white/85">
                Login to access your workspace, generate custom interview reports, review skill gaps, and export prep PDFs.
              </p>
            </div>

            <div className="rounded-[28px] border border-white/20 bg-white/10 p-6">
              <div className="text-sm font-medium text-white/90">Inside your workspace</div>
              <ul className="mt-4 space-y-3 text-sm leading-7 text-white/80">
                <li>Technical and behavioral interview questions</li>
                <li>Match score and targeted skill-gap insights</li>
                <li>Preparation roadmap and downloadable report</li>
              </ul>
            </div>
          </section>

          <section className="p-6 sm:p-8 lg:p-10">
            <div className="mb-8 flex items-center justify-between">
              <Link to="/" className="text-sm font-medium text-slate-600 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
                Back to landing
              </Link>
              <ThemeToggle />
            </div>

            <div className="mx-auto max-w-md">
              <div className="inline-flex items-center gap-2 rounded-full bg-fuchsia-500/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-fuchsia-600 dark:text-fuchsia-300">
                <LogIn size={14} />
                Welcome back
              </div>
              <h2 className="mt-5 text-4xl font-semibold text-slate-950 dark:text-slate-50">Login to continue</h2>
              <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-400">
                Access your interview workspace and continue preparing for your target role.
              </p>

              <form onSubmit={onSubmit} className="mt-8 space-y-4">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Email</span>
                  <input
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="w-full rounded-2xl border border-slate-300/70 bg-white/70 px-4 py-3.5 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-fuchsia-400 focus:ring-4 focus:ring-fuchsia-500/10 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-100"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Password</span>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      className="w-full rounded-2xl border border-slate-300/70 bg-white/70 px-4 py-3.5 pr-12 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-fuchsia-400 focus:ring-4 focus:ring-fuchsia-500/10 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-100"
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

                <div className="text-right">
                  <Link to="/forgot-password" className="text-sm font-medium text-fuchsia-600 hover:underline dark:text-fuchsia-300">
                    Forgot Password?
                  </Link>
                </div>

                {(formError || error) && (
                  <div className="rounded-2xl border border-rose-300/60 bg-rose-50 px-4 py-3 text-sm text-rose-600 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200">
                    {formError || error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-fuchsia-500 to-orange-400 px-4 py-3.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-75"
                >
                  {loading && <LoadingSpinner size="sm" className="border-white/20 border-t-white" />}
                  <span>{loading ? "Logging in..." : "Login"}</span>
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
                <span>Sign in with Google</span>
              </button>

              <p className="mt-6 text-sm text-slate-600 dark:text-slate-400">
                Don't have an account?{" "}
                <Link to="/register" className="font-semibold text-fuchsia-600 hover:underline dark:text-fuchsia-300">
                  Register
                </Link>
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Login;
