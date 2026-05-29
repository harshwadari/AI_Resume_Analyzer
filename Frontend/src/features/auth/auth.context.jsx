import { createContext, useEffect, useState } from "react";
import { getMe, setToken } from "../../services/auth.api";

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const getAndSetUser = async () => {
      try {
        setInitialLoading(true);
        setError(null);

        // Check if there's a token in the URL (from Google OAuth redirect)
        const params = new URLSearchParams(window.location.search);
        const tokenFromUrl = params.get("token");

        if (tokenFromUrl) {
          // Send the token to the backend to set it as an httpOnly cookie
          await setToken(tokenFromUrl);

          // Clean the token from the URL so it's not visible/bookmarked
          const cleanUrl = window.location.pathname;
          window.history.replaceState({}, document.title, cleanUrl);
        }

        const data = await getMe();

        if (data?.user) {
          setUser(data.user);
        } else {
          setUser(null);
        }
      } catch (err) {
        console.error("GetMe error:", err);
        setUser(null);
      } finally {
        setInitialLoading(false);
      }
    };

    getAndSetUser();
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, setUser, loading, setLoading, initialLoading, setInitialLoading, error, setError }}
    >
      {children}
    </AuthContext.Provider>
  );
};
