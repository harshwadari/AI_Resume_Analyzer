import React, { useState, useEffect, useRef } from "react";
import { ArrowRight, ShieldCheck, RotateCcw, Sparkles } from "lucide-react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import LoadingSpinner from "../../../components/ui/LoadingSpinner.jsx";
import ThemeToggle from "../../../components/ui/ThemeToggle.jsx";
import { useAuth } from "../hooks/useAuth";

const VerifyOtp = () => {
  const { loading, handleVerifyOtp, handleResendOtp, error } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Get email from navigation state (passed by Register or Login page)
  const email = location.state?.email || "";

  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [formError, setFormError] = useState("");
  const [resendMessage, setResendMessage] = useState("");
  const [countdown, setCountdown] = useState(60); // 60-second cooldown before resend
  const inputRefs = useRef([]);

  // If no email was passed, redirect to register
  useEffect(() => {
    if (!email) {
      navigate("/register", { replace: true });
    }
  }, [email, navigate]);

  // Countdown timer for resend button
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  // Handle input in each OTP box
  const handleChange = (index, value) => {
    // Allow only digits
    if (value && !/^\d$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  // Handle backspace — move focus to previous input
  const handleKeyDown = (index, e) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  // Handle paste — distribute digits across boxes
  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").trim();
    if (!/^\d{6}$/.test(pastedData)) return;

    const digits = pastedData.split("");
    setOtp(digits);
    inputRefs.current[5]?.focus();
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setFormError("");
    setResendMessage("");

    const otpString = otp.join("");
    if (otpString.length !== 6) {
      setFormError("Please enter the complete 6-digit OTP.");
      return;
    }

    const result = await handleVerifyOtp({ email, otp: otpString });
    if (result.success) {
      navigate("/workspace");
    }
  };

  const onResend = async () => {
    setFormError("");
    setResendMessage("");

    const result = await handleResendOtp({ email });
    if (result.success) {
      setResendMessage(result.message || "New OTP sent to your email!");
      setCountdown(60); // Reset cooldown
      setOtp(["", "", "", "", "", ""]); // Clear OTP inputs
      inputRefs.current[0]?.focus();
    }
  };

  return (
    <div className="page-shell flex min-h-screen items-center justify-center px-4 py-8">
      <div className="w-full max-w-6xl overflow-hidden rounded-[36px] border border-slate-200/70 bg-white/75 shadow-[0_25px_80px_rgba(15,23,42,0.14)] backdrop-blur dark:border-white/10 dark:bg-slate-950/75">
        <div className="grid lg:grid-cols-[0.95fr,1.05fr]">
          {/* ── Left Panel: Decorative ── */}
          <section className="hidden bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500 p-10 text-white lg:flex lg:flex-col lg:justify-between">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1 text-xs font-semibold uppercase tracking-[0.26em]">
              <Sparkles size={14} />
              Almost there
            </div>

            <div>
              <h1 className="max-w-md text-5xl font-semibold leading-tight">
                One last step — verify your email.
              </h1>
              <p className="mt-5 max-w-md text-base leading-8 text-white/85">
                We've sent a 6-digit code to <strong>{email}</strong>. Enter it below to activate your account.
              </p>
            </div>

            <div className="rounded-[28px] border border-white/20 bg-white/10 p-6">
              <div className="text-sm font-medium text-white/90">Why verification?</div>
              <ul className="mt-4 space-y-3 text-sm leading-7 text-white/80">
                <li>Protects your account from unauthorized access</li>
                <li>Ensures password recovery works properly</li>
                <li>Confirms you own this email address</li>
              </ul>
            </div>
          </section>

          {/* ── Right Panel: OTP Form ── */}
          <section className="p-6 sm:p-8 lg:p-10">
            <div className="mb-8 flex items-center justify-between">
              <Link to="/register" className="text-sm font-medium text-slate-600 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
                Back to register
              </Link>
              <ThemeToggle />
            </div>

            <div className="mx-auto max-w-md">
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-emerald-600 dark:text-emerald-300">
                <ShieldCheck size={14} />
                Verify email
              </div>
              <h2 className="mt-5 text-4xl font-semibold text-slate-950 dark:text-slate-50">Enter verification code</h2>
              <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-400">
                We sent a 6-digit code to <strong className="text-slate-800 dark:text-slate-200">{email}</strong>. It expires in 5 minutes.
              </p>

              <form onSubmit={onSubmit} className="mt-8 space-y-6">
                {/* ── OTP Input Boxes ── */}
                <div className="flex items-center justify-center gap-3">
                  {otp.map((digit, index) => (
                    <input
                      key={index}
                      ref={(el) => (inputRefs.current[index] = el)}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleChange(index, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(index, e)}
                      onPaste={index === 0 ? handlePaste : undefined}
                      className="h-14 w-12 rounded-xl border border-slate-300/70 bg-white/70 text-center text-xl font-bold text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/10 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-100"
                    />
                  ))}
                </div>

                {/* ── Success message for resend ── */}
                {resendMessage && (
                  <div className="rounded-2xl border border-emerald-300/60 bg-emerald-50 px-4 py-3 text-sm text-emerald-600 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200">
                    {resendMessage}
                  </div>
                )}

                {/* ── Error display ── */}
                {(formError || error) && (
                  <div className="rounded-2xl border border-rose-300/60 bg-rose-50 px-4 py-3 text-sm text-rose-600 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200">
                    {formError || error}
                  </div>
                )}

                {/* ── Submit Button ── */}
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-3.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-75"
                >
                  {loading && <LoadingSpinner size="sm" className="border-white/20 border-t-white" />}
                  <span>{loading ? "Verifying..." : "Verify Email"}</span>
                  {!loading && <ArrowRight size={16} />}
                </button>
              </form>

              {/* ── Resend OTP ── */}
              <div className="mt-6 text-center">
                {countdown > 0 ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Resend code in <span className="font-semibold text-slate-700 dark:text-slate-200">{countdown}s</span>
                  </p>
                ) : (
                  <button
                    onClick={onResend}
                    disabled={loading}
                    className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-600 transition hover:underline dark:text-emerald-300 disabled:opacity-50"
                  >
                    <RotateCcw size={14} />
                    Resend OTP
                  </button>
                )}
              </div>

              <p className="mt-4 text-center text-sm text-slate-600 dark:text-slate-400">
                Wrong email?{" "}
                <Link to="/register" className="font-semibold text-emerald-600 hover:underline dark:text-emerald-300">
                  Go back and register again
                </Link>
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default VerifyOtp;
