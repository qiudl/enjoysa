import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { supplierAuth, isTokenPresent, type SupplierUserInfo, type SupplierInfo } from '../services/authService';

export type { SupplierInfo };

interface SupplierAuthContextType {
  supplier: SupplierUserInfo | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
}

const SupplierAuthContext = createContext<SupplierAuthContextType | undefined>(undefined);

const SUPPLIER_STORAGE_KEY = 'enjoysa_supplier';

export const SupplierAuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [supplier, setSupplier] = useState<SupplierUserInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // On init, check for existing token and load profile
  useEffect(() => {
    const init = async () => {
      // Try cached data first for instant display
      try {
        const saved = localStorage.getItem(SUPPLIER_STORAGE_KEY);
        if (saved) {
          setSupplier(JSON.parse(saved));
        }
      } catch {
        // Ignore parse errors
      }

      // If we have a token, validate by fetching profile
      if (isTokenPresent('supplier')) {
        try {
          const profile = await supplierAuth.getProfile();
          setSupplier(profile);
          localStorage.setItem(SUPPLIER_STORAGE_KEY, JSON.stringify(profile));
        } catch {
          // Token expired or invalid, clear everything
          supplierAuth.logout();
          localStorage.removeItem(SUPPLIER_STORAGE_KEY);
          setSupplier(null);
        }
      }

      setIsLoading(false);
    };

    init();
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      const supplierUser = await supplierAuth.login(email, password);
      setSupplier(supplierUser);
      localStorage.setItem(SUPPLIER_STORAGE_KEY, JSON.stringify(supplierUser));
      return true;
    } catch {
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    supplierAuth.logout();
    localStorage.removeItem(SUPPLIER_STORAGE_KEY);
    setSupplier(null);
  };

  return (
    <SupplierAuthContext.Provider
      value={{
        supplier,
        isAuthenticated: !!supplier,
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </SupplierAuthContext.Provider>
  );
};

export const useSupplierAuth = () => {
  const context = useContext(SupplierAuthContext);
  if (context === undefined) {
    throw new Error('useSupplierAuth must be used within a SupplierAuthProvider');
  }
  return context;
};

export default SupplierAuthContext;
