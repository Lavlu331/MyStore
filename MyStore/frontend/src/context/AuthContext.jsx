import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { api } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionError, setSessionError] = useState(false);
  const sessionRequest = useRef(0);

  const restoreSession = useCallback(async () => {
    const request = ++sessionRequest.current;
    setSessionError(false);
    if (!localStorage.getItem('token')) { setLoading(false); return; }
    setLoading(true);
    try {
      const me = await api('/auth/me');
      if (request === sessionRequest.current) setUser(me);
    } catch {
      if (request === sessionRequest.current) setSessionError(true);
    } finally {
      if (request === sessionRequest.current) setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    sessionRequest.current++;
    localStorage.removeItem('token');
    setUser(null);
    setSessionError(false);
    setLoading(false);
  }, []);

  useEffect(() => {
    window.addEventListener('auth:expired', logout);
    restoreSession();
    return () => {
      sessionRequest.current++;
      window.removeEventListener('auth:expired', logout);
    };
  }, [logout, restoreSession]);

  const startSession = async (token) => {
    localStorage.setItem('token', token);
    const me = await api('/auth/me');
    setUser(me);
    setSessionError(false);
    return me;
  };

  const login = async (email, password) => {
    const data = await api('/auth/login', { method: 'POST', body: { email, password } });
    return startSession(data.token);
  };

  const register = async (form) => {
    const data = await api('/auth/register', { method: 'POST', body: form });
    return startSession(data.token);
  };

  const refreshUser = async () => setUser(await api('/auth/me'));

  return (
    <AuthContext.Provider value={{ user, loading, sessionError, restoreSession, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
