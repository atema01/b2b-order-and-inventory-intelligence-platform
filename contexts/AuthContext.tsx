// AuthContext.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';

// Removed fake db and auth utils
// import { db } from '../services/databaseService';
// import { generateToken, parseToken, UserPayload, hashPassword } from '../utils/auth';

// Define types based on your backend response
interface UserPayload {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'staff' | 'buyer';
  // Add buyer-specific fields if needed
  companyName?: string;
  tier?: string;
}

interface AuthContextType {
  user: UserPayload | null;
  isLoading: boolean;
  login: (identifier: string, password: string, type: 'buyer' | 'seller') => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 🆕 FETCH CURRENT USER ON APP LOAD (replaces localStorage check)
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await fetch('/api/auth/me', {
          credentials: 'include', // ← Critical: sends HttpOnly cookie
        });

        if (response.ok) {
          const userData = await response.json();
          setUser(userData);
        }
        // If not authenticated, user remains null
      } catch (err) {
        console.error('Failed to fetch user:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUser();
  }, []);

  // Session Timeout Logic (15 Minutes Inactivity) — keep as-is
  useEffect(() => {
    if (!user) return;

    const TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes
    let timeoutId: any;

    const logoutUser = () => {
      logout();
      alert("Session timed out due to inactivity.");
    };

    const resetTimer = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(logoutUser, TIMEOUT_MS);
    };

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'mousemove'];
    events.forEach(event => document.addEventListener(event, resetTimer));
    
    resetTimer(); // Start initial timer

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      events.forEach(event => document.removeEventListener(event, resetTimer));
    };
  }, [user]);

  // 🆕 REAL LOGIN FUNCTION (calls backend API)
  const login = async (
    identifier: string,
    password: string,
    type: 'buyer' | 'seller'
  ): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    

    try {
      // Map frontend 'type' to backend 'role'
      // Your backend expects 'admin', 'staff', or 'buyer'
      // But your UI uses 'seller' → map to 'staff' (or 'admin')
      // For now, assume 'seller' = 'staff'
      const role = type === 'buyer' ? 'buyer' : 'staff';

      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // ← Sends/sets HttpOnly cookie
        body: JSON.stringify({ email: identifier, password }),
      });

      if (response.ok) {
        const data = await response.json();
        
        // Hydrate user from API response
        setUser(data.user);
        
        // No localStorage! Cookie handles session
        // Remove these legacy lines:
        // localStorage.setItem('userType', type);
        // localStorage.setItem('userId', data.user.id);
        
        // Keep this if other parts of app listen to it
        window.dispatchEvent(new Event('auth-change'));
        
        return { success: true };
      } else {
        const errorData = await response.json();
        return { success: false, error: errorData.error || 'Login failed' };
      }
    } catch (err) {
      console.error('Login network error:', err);
      return { success: false, error: 'Network error. Please check your connection.' };
    } finally {
      setIsLoading(false);
    }
  };

  // 🆕 REAL LOGOUT FUNCTION
  const logout = () => {
    // Clear user state
    setUser(null);
    
    // Call backend to clear cookie
    fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    }).catch(console.error);
    
    // Remove legacy localStorage
    // localStorage.removeItem('auth_token');
    // localStorage.removeItem('userType');
    // localStorage.removeItem('userId');
    
    window.dispatchEvent(new Event('auth-change'));
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};