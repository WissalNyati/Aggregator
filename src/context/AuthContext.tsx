import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { authApi } from '../lib/api';

interface User {
  id: string;
  email: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Clear any stale redirect flags on mount
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('auth_redirect_in_progress');
    }

    // AUTHENTICATION REQUIRED - Check auth status on mount
    const checkAuth = async () => {
      setLoading(true);
      
      try {
        const token = localStorage.getItem('auth_token');
        
        // NO TOKEN = NOT AUTHENTICATED
        if (!token || token === 'undefined' || token === 'null' || token.trim() === '') {
          setUser(null);
          setLoading(false);
          return;
        }
        
        // Validate token with backend - expired tokens will return 401
        try {
          const currentUser = await authApi.getCurrentUser();
          if (currentUser && currentUser.id) {
            setUser(currentUser);
          } else {
            // Token invalid or expired - already cleared by getCurrentUser
            setUser(null);
          }
        } catch (authError) {
          // For /auth/me endpoint, 401/403 means expired/invalid token
          // Token is already cleared by apiRequest, just set user to null
          const err = authError as Error & { status?: number; code?: string };
          if (err.status === 401 || err.status === 403) {
            // Token expired/invalid - already cleared, just update state
            setUser(null);
          } else {
            // Network or other errors - clear user
            setUser(null);
          }
        }
      } catch (error) {
        console.warn('Auth check failed:', error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    void checkAuth();
  }, []);

  const signUp = async (email: string, password: string) => {
    try {
      const { user, error } = await authApi.signUp(email, password);
      if (error) {
        return { error };
      }
      setUser(user);
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { user, error } = await authApi.signIn(email, password);
      if (error) {
        return { error };
      }
      setUser(user);
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signOut = async () => {
    try {
      // Clear token and user state
      authApi.signOut();
      setUser(null);
      
      // Redirect to login page
      if (typeof window !== 'undefined') {
        window.location.href = '/auth';
      }
    } catch (error) {
      // Even if signOut fails, clear local state and redirect
      console.warn('Error during sign out, clearing local state:', error);
      setUser(null);
      
      // Clear token manually as fallback
      try {
        localStorage.removeItem('auth_token');
      } catch (e) {
        // Ignore localStorage errors
      }
      
      // Still redirect to login
      if (typeof window !== 'undefined') {
        window.location.href = '/auth';
      }
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
