import { useContext } from "react";
import { AuthContext } from "../auth.context";
import { login, logout, register, verifyOtp, resendOtp } from "../../../services/auth.api";

export const useAuth = () => {
  const context = useContext(AuthContext);
  const { user, setUser, loading, setLoading, initialLoading, error, setError } = context;

  const handleLogin = async ({ email, password }) => {
    try {
      setLoading(true);
      setError(null);
      const data = await login({ email, password });

      if (data?.user) {
        setUser(data.user);
        return { success: true };
      }

      return { success: false };
    } catch (err) {
      console.error("Login error:", err);
      const errorData = err?.response?.data;

      // If server says email not verified, pass that info to the caller
      if (errorData?.requiresVerification) {
        setError(errorData.message);
        return { success: false, requiresVerification: true, email: errorData.email || email };
      }

      setError(errorData?.message || "Unable to login right now");
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
        setUser(data.user);
        return { success: true };
      }

      return { success: false };
    } catch (err) {
      console.error("Register error:", err);
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
        setUser(data.user);
        return { success: true };
      }

      return { success: false };
    } catch (err) {
      console.error("VerifyOtp error:", err);
      setError(err?.response?.data?.message || "OTP verification failed");
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
      console.error("ResendOtp error:", err);
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
      setUser(null);
    } catch (err) {
      console.error("Logout error:", err);
      setError(err?.response?.data?.message || "Unable to logout right now");
    } finally {
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
