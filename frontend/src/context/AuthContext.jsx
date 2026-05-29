import React, { createContext, useContext, useState } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => sessionStorage.getItem('ck_token'));
  const [user,  setUser]  = useState(() => {
    try {
      const u = sessionStorage.getItem('ck_user');
      return u ? JSON.parse(u) : null;
    } catch { return null; }
  });

  const login = (token, userData) => {
    sessionStorage.setItem('ck_token', token);
    sessionStorage.setItem('ck_user', JSON.stringify(userData));
    setToken(token);
    setUser(userData);
  };

  const logout = () => {
    sessionStorage.removeItem('ck_token');
    sessionStorage.removeItem('ck_user');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ token, user, login, logout, isLoggedIn: !!token }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
