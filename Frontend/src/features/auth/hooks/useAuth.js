import { useContext } from "react";
import { AuthContext } from "../auth.state";
import { login, logout, register, verifyOtp, resendOtp, getMe } from "../../../services/auth.api";

export const useAuth = () => {
  const context = useContext(AuthContext);
  const { user, setUser, loading, setLoading, initialLoading, error, setError } = context;

  const confirmSession = async () => {
    try {
      const session = await getMe();
      if (!session?.user) throw new Error('Missing session');
      setUser(session.user, { celebrate: true });
    } catch {
      throw new Error('Your session could not be confirmed. Please check your connection and cookie settings, then sign in again.');
    }
  };

  const handleLogin = async ({ email, password }) => {
    try {
      setLoading(true);
      setError(null);
      const data = await login({ email, password });

      if (data?.user) {
        await confirmSession();
        return { success: true };
      }

      return { success: false };
    } catch (err) {
      const errorData = err?.response?.data;

      // If server says email not verified, pass that info to the caller
      if (errorData?.requiresVerification) {
        setError(errorData.message);
        return { success: false, requiresVerification: true, email: errorData.email || email };
      }

      setError(errorData?.message || err.message || "Unable to login right now");
      return { success: false };
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async ({ username, email, password }) => {
    try {
      setLoading(true);
      setError(null);
      const data = await register({ username, email, password });

      // Registration now requires OTP verification — don't set user yet
      if (data?.requiresVerification) {
        return { success: true, requiresVerification: true, email: data.email || email };
      }

      // Fallback: if somehow user is returned directly (shouldn't happen now)
      if (data?.user) {
        await confirmSession();
        return { success: true };
      }

      return { success: false };
    } catch (err) {
      setError(err?.response?.data?.message || "Unable to register right now");
      return { success: false };
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async ({ email, otp }) => {
    try {
      setLoading(true);
      setError(null);
      const data = await verifyOtp({ email, otp });

      if (data?.user) {
        await confirmSession();
        return { success: true };
      }

      return { success: false };
    } catch (err) {
      setError(err?.response?.data?.message || err.message || "OTP verification failed");
      return { success: false };
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async ({ email }) => {
    try {
      setLoading(true);
      setError(null);
      const data = await resendOtp({ email });
      return { success: true, message: data.message };
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to resend OTP");
      return { success: false };
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      setLoading(true);
      setError(null);
      await logout();
      return { success: true };
    } catch (err) {
      setError(err?.response?.data?.message || "Unable to confirm server logout. Close this browser and try again later.");
      return { success: false };
    } finally {
      try {
        localStorage.removeItem('token');
        localStorage.removeItem('pendingVerificationEmail');
      } catch { /* Disabled storage must not prevent clearing private state. */ }
      setUser(null);
      setLoading(false);
    }
  };

  return {
    user,
    loading,
    initialLoading,
    error,
    handleLogin,
    handleRegister,
    handleLogout,
    handleVerifyOtp,
    handleResendOtp,
  };
};
