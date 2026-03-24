'use client';
import { useState, useEffect, createContext, useContext } from 'react';
import { getAuth, setAuth, clearAuth } from '../lib/auth';
import { authApi } from '../lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [lang,    setLang]    = useState('en');

  useEffect(() => {
    const { token, user: stored } = getAuth();
    const savedLang = localStorage.getItem('church_lang') || 'en';
    setLang(savedLang);
    if (token && stored) {
      setUser(stored);
      // Refresh user from API silently
      authApi.me().then(res => {
        setUser(res.data.user);
        setAuth(token, res.data.user);
      }).catch(() => clearAuth());
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    const res = await authApi.login({ email, password });
    setAuth(res.data.token, res.data.user);
    setUser(res.data.user);
    return res.data.user;
  };

  const logout = () => {
    clearAuth();
    setUser(null);
    window.location.href = '/auth/login';
  };

  const switchLang = (l) => {
    setLang(l);
    localStorage.setItem('church_lang', l);
  };

  return (
    <AuthContext.Provider value={{ user, loading, lang, switchLang, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
