import React, { createContext, useContext, useState, useEffect } from 'react';

interface AuthContextType {
  userEmail: string | null;
  isAuthenticated: boolean;
  login: (email: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    // Check if user is already logged in
    const savedEmail = localStorage.getItem('userEmail');
    if (savedEmail) {
      setUserEmail(savedEmail);
    }
  }, []);

  const login = (email: string) => {
    setUserEmail(email);
    localStorage.setItem('userEmail', email);
  };

  const logout = () => {
    setUserEmail(null);
    localStorage.removeItem('userEmail');
  };

  return (
    <AuthContext.Provider value={{
      userEmail,
      isAuthenticated: !!userEmail,
      login,
      logout
    }}>
      {children}
    </AuthContext.Provider>
  );
} 