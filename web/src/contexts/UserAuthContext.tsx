import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { userAuth, isTokenPresent, type UserInfo } from '../services/authService';

export type { UserInfo };

interface UserAuthContextType {
  user: UserInfo | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  register: (email: string, password: string, name: string) => Promise<boolean>;
  googleLogin: (idToken: string) => Promise<boolean>;
  updateProfile: (updates: { name?: string; phone?: string; language?: string }) => Promise<boolean>;
  logout: () => void;
}

const UserAuthContext = createContext<UserAuthContextType | undefined>(undefined);

const USER_STORAGE_KEY = 'enjoysa_user';

export const UserAuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      // Try cached data first
      try {
        const saved = localStorage.getItem(USER_STORAGE_KEY);
        if (saved) {
          setUser(JSON.parse(saved));
        }
      } catch {
        // Ignore
      }

      // Validate token by fetching profile
      if (isTokenPresent('user')) {
        try {
          const profile = await userAuth.getProfile();
          setUser(profile);
          localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(profile));
        } catch {
          userAuth.logout();
          localStorage.removeItem(USER_STORAGE_KEY);
          setUser(null);
        }
      }

      setIsLoading(false);
    };

    init();
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      const userInfo = await userAuth.login(email, password);
      setUser(userInfo);
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(userInfo));
      return true;
    } catch {
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (email: string, password: string, name: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      const userInfo = await userAuth.register(email, password, name);
      setUser(userInfo);
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(userInfo));
      return true;
    } catch {
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const googleLogin = async (idToken: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      const userInfo = await userAuth.googleLogin(idToken);
      setUser(userInfo);
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(userInfo));
      return true;
    } catch {
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const updateProfile = async (updates: { name?: string; phone?: string; language?: string }): Promise<boolean> => {
    try {
      const updatedUser = await userAuth.updateProfile(updates);
      setUser(updatedUser);
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(updatedUser));
      return true;
    } catch {
      return false;
    }
  };

  const logout = () => {
    userAuth.logout();
    localStorage.removeItem(USER_STORAGE_KEY);
    setUser(null);
  };

  return (
    <UserAuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        googleLogin,
        updateProfile,
        logout,
      }}
    >
      {children}
    </UserAuthContext.Provider>
  );
};

export const useUserAuth = () => {
  const context = useContext(UserAuthContext);
  if (context === undefined) {
    throw new Error('useUserAuth must be used within a UserAuthProvider');
  }
  return context;
};

export default UserAuthContext;
