import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

export interface AdminInfo {
  id: string;
  name: string;
  email: string;
  role: 'super_admin' | 'admin' | 'operator';
  avatar?: string;
  permissions: string[];
}

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

  // Load from localStorage on init
  useEffect(() => {
    try {
      const saved = localStorage.getItem(ADMIN_STORAGE_KEY);
      if (saved) {
        setAdmin(JSON.parse(saved));
      }
    } catch {
      // Ignore parse errors
    }
    setIsLoading(false);
  }, []);

  // Save to localStorage when admin changes
  useEffect(() => {
    if (admin) {
      localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(admin));
    } else {
      localStorage.removeItem(ADMIN_STORAGE_KEY);
    }
  }, [admin]);

  const login = async (email: string, password: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      // TODO: Replace with actual API call
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Demo: Accept admin login
      if (email && password.length >= 6) {
        const mockAdmin: AdminInfo = {
          id: 'admin_001',
          name: email.split('@')[0],
          email,
          role: 'super_admin',
          permissions: [
            'dashboard.view',
            'suppliers.view', 'suppliers.edit', 'suppliers.approve',
            'products.view', 'products.edit', 'products.approve',
            'orders.view', 'orders.edit',
            'users.view', 'users.edit',
            'finance.view', 'finance.edit',
            'settings.view', 'settings.edit',
          ],
        };
        setAdmin(mockAdmin);
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setAdmin(null);
  };

  const hasPermission = (permission: string): boolean => {
    if (!admin) return false;
    if (admin.role === 'super_admin') return true;
    return admin.permissions.includes(permission);
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
