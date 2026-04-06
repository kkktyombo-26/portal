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
      setToken(storedToken);
      setUser(storedUser);
      // Refresh user from API silently
      authApi.me().then(res => {
        setUser(res.data.user);
        setAuth(storedToken, res.data.user);
      }).catch(() => {
        clearAuth();
        setToken(null);
        setUser(null);
      });
    }
    setLoading(false);
  }, []);

  const login = async (identifier, password) => {
    const res = await authApi.login({ identifier, password });
    setAuth(res.data.token, res.data.user);
    setToken(res.data.token);
    setUser(res.data.user);
    return res.data.user;
  };

  const logout = () => {
    clearAuth();
    setUser(null);
    setToken(null);
    window.location.href = '/auth/login';
  };

  const switchLang = (l) => {
    setLang(l);
    localStorage.setItem('church_lang', l);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, lang, switchLang, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};