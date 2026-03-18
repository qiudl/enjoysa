import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { adminAuth, isTokenPresent, type AdminInfo } from '../services/authService';

export type { AdminInfo };

interface AdminAuthContextType {
  admin: AdminInfo | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  hasPermission: (permission: string) => boolean;
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

const ADMIN_STORAGE_KEY = 'enjoysa_admin';

export const AdminAuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [admin, setAdmin] = useState<AdminInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // On init, check for existing token and load profile
  useEffect(() => {
    const init = async () => {
      const hasToken = isTokenPresent('admin');

      // Try cached data for instant display, but ONLY if token exists
      try {
        const saved = localStorage.getItem(ADMIN_STORAGE_KEY);
        if (saved && hasToken) {
          setAdmin(JSON.parse(saved));
        } else if (saved) {
          // Stale cached data without token — clean up
          localStorage.removeItem(ADMIN_STORAGE_KEY);
        }
      } catch {
        // Ignore parse errors
      }

      // If we have a token, validate by fetching profile
      if (hasToken) {
        try {
          const profile = await adminAuth.getProfile();
          setAdmin(profile);
          localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(profile));
        } catch {
          // Token expired or invalid, clear everything
          adminAuth.logout();
          localStorage.removeItem(ADMIN_STORAGE_KEY);
          setAdmin(null);
        }
      }

      setIsLoading(false);
    };

    init();
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      const adminInfo = await adminAuth.login(email, password);
      setAdmin(adminInfo);
      localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(adminInfo));
      return true;
    } catch {
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    adminAuth.logout();
    localStorage.removeItem(ADMIN_STORAGE_KEY);
    setAdmin(null);
  };

  const hasPermission = (permission: string): boolean => {
    if (!admin) return false;
    if (admin.role === 'super_admin') return true;
    // For now, admin role has all permissions in MVP
    return !!permission;
  };

  return (
    <AdminAuthContext.Provider
      value={{
        admin,
        isAuthenticated: !!admin,
        isLoading,
        login,
        logout,
        hasPermission,
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
};

export const useAdminAuth = () => {
  const context = useContext(AdminAuthContext);
  if (context === undefined) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  }
  return context;
};

export default AdminAuthContext;
