'use client';
import { useState, useEffect, createContext, useContext } from 'react';
import { getAuth, setAuth, clearAuth } from '../lib/auth';
import { authApi } from '../lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [token,   setToken]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [lang,    setLang]    = useState('en');

  useEffect(() => {
    const { token: storedToken, user: storedUser } = getAuth();
    const savedLang = localStorage.getItem('church_lang') || 'en';
    setLang(savedLang);

    if (storedToken && storedUser) {
      // Optimistically restore session so components see the user immediately.
      setToken(storedToken);
      setUser(storedUser);

      // Silently re-validate the token against the server.
      // ⚠️  setLoading(false) is INSIDE .finally() so the guarded pages
      //     (DashboardShell, etc.) never render until we know whether the
      //     token is still valid — prevents the race where ProfilePage fires
      //     userApi.getOne() just as clearAuth() wipes the token.
      authApi.me()
        .then(res => {
          setUser(res.data.user);
          setAuth(storedToken, res.data.user);
        })
        .catch(() => {
          // Token is invalid / expired — clear everything and let the
          // auth guard redirect the user to /get-account.
          clearAuth();
          setToken(null);
          setUser(null);
        })
        .finally(() => setLoading(false));  // ← only resolves AFTER me() settles
    } else {
      // No stored session at all — unlock immediately.
      setLoading(false);
    }
  }, []);

  /**
   * login — identifier + password (standard form).
   */
  const login = async (identifier, password) => {
    const res = await authApi.login({ identifier, password });
    setAuth(res.data.token, res.data.user);
    setToken(res.data.token);
    setUser(res.data.user);
    return res.data.user;
  };

  /**
   * loginWithToken — OTP / token-based login.
   * Called after the phone OTP flow receives token + user from the server.
   * Syncs both localStorage and in-memory context state so any component
   * reading useAuth() sees the user without a page reload.
   */
  const loginWithToken = (newToken, newUser) => {
    setAuth(newToken, newUser);   // persist to localStorage
    setToken(newToken);           // sync in-memory context
    setUser(newUser);
  };

  const logout = () => {
    clearAuth();
    setUser(null);
    setToken(null);
    window.location.href = '/get-account';
  };

  const switchLang = (l) => {
    setLang(l);
    localStorage.setItem('church_lang', l);
  };

  return (
    <AuthContext.Provider value={{
      user,
      token,
      loading,
      lang,
      switchLang,
      login,
      loginWithToken,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};