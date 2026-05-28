import { createContext, useEffect, useState } from "react";
import { getMe } from "../../services/auth.api";

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
