// AuthContext.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';

// Define the user payload structure matching your backend response
interface UserPayload {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  permissions?: Record<string, boolean>;
  // Buyer-specific fields (optional)
  companyName?: string;
  tier?: string;
  // Remove 'type' - we'll derive it from role
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

  // Initial Load - fetch current user from backend
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await fetch('/api/auth/me', {
          credentials: 'include', // Essential for HttpOnly cookies
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

  // Session Timeout Logic (15 Minutes Inactivity) - preserved as-is
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

  // Real login function - calls backend API
  // In AuthContext.tsx
const login = async (
  identifier: string,
  password: string,
  type: 'buyer' | 'seller'
): Promise<{ success: boolean; error?: string }> => {
  try {
    setIsLoading(true);

    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email: identifier, password, accountType: type }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return { success: false, error: errorData.error || 'Login failed' };
    }

    // ✅ CRITICAL: Refetch user AFTER login to ensure session is active
    const meResponse = await fetch('/api/auth/me', {
      credentials: 'include'
    });

    if (meResponse.ok) {
      const userData = await meResponse.json();
      setUser(userData);
      window.dispatchEvent(new Event('auth-change'));
      return { success: true };
    } else {
      return { success: false, error: 'Session not established' };
    }
  } catch (err: any) {
    console.error('Login error:', err);
    return { 
      success: false, 
      error: 'Network error. Please check your connection.' 
    };
  } finally {
    setIsLoading(false);
  }
};

  // Real logout function
  const logout = () => {
    // Clear user state
    setUser(null);
    
    // Call backend to clear cookie
    fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    }).catch(console.error);
    
    // Keep this if other parts of app listen to it
    window.dispatchEvent(new Event('auth-change'));
  };

  return (
    <AuthContext.Provider 
      value={{ 
        user, 
        isLoading, 
        login, 
        logout, 
        isAuthenticated: !!user 
      }}
    >
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
