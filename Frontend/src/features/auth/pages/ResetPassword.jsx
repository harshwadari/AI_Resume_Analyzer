import React, { useState } from "react";
import { ArrowRight, Eye, EyeOff, KeyRound, Sparkles } from "lucide-react";
import { Link, useParams, useNavigate } from "react-router-dom";
import LoadingSpinner from "../../../components/ui/LoadingSpinner.jsx";
import ThemeToggle from "../../../components/ui/ThemeToggle.jsx";
import { resetPassword } from "../../../services/auth.api";

const ResetPassword = () => {
  const { token } = useParams(); // Get reset token from URL
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const onSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (!password.trim() || !confirmPassword.trim()) {
      setError("Please fill in both password fields.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    try {
      setLoading(true);
      await resetPassword({ token, password });
      setSuccess(true);
      // Auto-redirect to login after 3 seconds
      setTimeout(() => navigate("/login"), 3000);
    } catch (err) {
      setError(err?.response?.data?.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-shell flex min-h-screen items-center justify-center px-4 py-8">
      <div className="w-full max-w-6xl overflow-hidden rounded-[36px] border border-slate-200/70 bg-white/75 shadow-[0_25px_80px_rgba(15,23,42,0.14)] backdrop-blur dark:border-white/10 dark:bg-slate-950/75">
        <div className="grid lg:grid-cols-[1.02fr,0.98fr]">
          {/* ── Left Panel: Form ── */}
          <section className="p-6 sm:p-8 lg:p-10">
            <div className="mb-8 flex items-center justify-between">
              <Link to="/login" className="text-sm font-medium text-slate-600 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
                Back to login
              </Link>
              <ThemeToggle />
            </div>

            <div className="mx-auto max-w-md">
              <div className="inline-flex items-center gap-2 rounded-full bg-amber-500/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-amber-600 dark:text-amber-300">
                <KeyRound size={14} />
                New password
              </div>
              <h2 className="mt-5 text-4xl font-semibold text-slate-950 dark:text-slate-50">Set your new password</h2>
              <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-400">
                Choose a strong password with at least 8 characters, including uppercase, lowercase, and a number.
              </p>

              {success ? (
                /* ── Success State ── */
                <div className="mt-8 space-y-4">
                  <div className="rounded-2xl border border-emerald-300/60 bg-emerald-50 px-6 py-5 dark:border-emerald-500/20 dark:bg-emerald-500/10">
                    <h3 className="text-base font-semibold text-emerald-700 dark:text-emerald-200">Password reset successful!</h3>
                    <p className="mt-2 text-sm leading-7 text-emerald-600 dark:text-emerald-300">
                      Your password has been updated. Redirecting you to login...
                    </p>
                  </div>
                  <Link
                    to="/login"
                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-3.5 text-sm font-semibold text-white transition hover:-translate-y-0.5"
                  >
                    Go to Login
                    <ArrowRight size={16} />
                  </Link>
                </div>
              ) : (
                /* ── Form State ── */
                <form onSubmit={onSubmit} className="mt-8 space-y-4">
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">New Password</span>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter new password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full rounded-2xl border border-slate-300/70 bg-white/70 px-4 py-3.5 pr-12 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-amber-400 focus:ring-4 focus:ring-amber-500/10 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-100"
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

                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Confirm Password</span>
                    <div className="relative">
                      <input
                        type={showConfirm ? "text" : "password"}
                        placeholder="Confirm new password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full rounded-2xl border border-slate-300/70 bg-white/70 px-4 py-3.5 pr-12 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-amber-400 focus:ring-4 focus:ring-amber-500/10 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-100"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirm(!showConfirm)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400"
                      >
                        {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </label>

                  {error && (
                    <div className="rounded-2xl border border-rose-300/60 bg-rose-50 px-4 py-3 text-sm text-rose-600 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200">
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-3.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-75"
                  >
                    {loading && <LoadingSpinner size="sm" className="border-white/20 border-t-white" />}
                    <span>{loading ? "Resetting..." : "Reset Password"}</span>
                    {!loading && <ArrowRight size={16} />}
                  </button>
                </form>
              )}
            </div>
          </section>

          {/* ── Right Panel: Decorative ── */}
          <section className="hidden bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500 p-10 text-white lg:flex lg:flex-col lg:justify-between">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1 text-xs font-semibold uppercase tracking-[0.26em]">
              <Sparkles size={14} />
              Security first
            </div>

            <div>
              <h1 className="max-w-md text-5xl font-semibold leading-tight">
                Create a strong, unique password.
              </h1>
              <p className="mt-5 max-w-md text-base leading-8 text-white/85">
                A good password is at least 8 characters long and includes a mix of uppercase, lowercase, and numbers.
              </p>
            </div>

            <div className="rounded-[28px] border border-white/20 bg-white/10 p-6">
              <div className="text-sm font-medium text-white/90">Password tips</div>
              <ul className="mt-4 space-y-3 text-sm leading-7 text-white/80">
                <li>Don't reuse passwords from other sites</li>
                <li>Use a password manager for best security</li>
                <li>Avoid personal info like birthdays or names</li>
              </ul>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
