import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

export interface SupplierInfo {
  id: string;
  name: string;
  email: string;
  type: 'travel_agency' | 'hotel' | 'attraction' | 'restaurant' | 'car_rental';
  status: 'pending' | 'approved' | 'suspended';
}

interface SupplierAuthContextType {
  supplier: SupplierInfo | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
}

const SupplierAuthContext = createContext<SupplierAuthContextType | undefined>(undefined);

const SUPPLIER_STORAGE_KEY = 'enjoysa_supplier';

export const SupplierAuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [supplier, setSupplier] = useState<SupplierInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load from localStorage on init
  useEffect(() => {
    try {
      const saved = localStorage.getItem(SUPPLIER_STORAGE_KEY);
      if (saved) {
        setSupplier(JSON.parse(saved));
      }
    } catch {
      // Ignore parse errors
    }
    setIsLoading(false);
  }, []);

  // Save to localStorage when supplier changes
  useEffect(() => {
    if (supplier) {
      localStorage.setItem(SUPPLIER_STORAGE_KEY, JSON.stringify(supplier));
    } else {
      localStorage.removeItem(SUPPLIER_STORAGE_KEY);
    }
  }, [supplier]);

  const login = async (email: string, password: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      // TODO: Replace with actual API call
      // Simulating API call for demo
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Demo: Accept any login with valid format
      if (email && password.length >= 6) {
        const mockSupplier: SupplierInfo = {
          id: 'supplier_001',
          name: email.split('@')[0],
          email,
          type: 'travel_agency',
          status: 'approved',
        };
        setSupplier(mockSupplier);
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
