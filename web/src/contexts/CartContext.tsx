import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { Product } from '../types';

export interface CartItem {
  product: Product;
  quantity: number;
  selectedDate?: string;
  selectedTime?: string;
  packageId?: number;
  scheduleId?: number;
}

interface CartContextType {
  items: CartItem[];
  addToCart: (product: Product, quantity?: number, selectedDate?: string, selectedTime?: string, packageId?: number, scheduleId?: number) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  getCartCount: () => number;
  getCartTotal: () => number;
  /** Timestamp of last addToCart call; components can react to changes */
  lastAddedAt: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const CART_STORAGE_KEY = 'enjoysa_cart';

export const CartProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [lastAddedAt, setLastAddedAt] = useState(0);

  const [items, setItems] = useState<CartItem[]>(() => {
    // Load from localStorage on init
    try {
      const saved = localStorage.getItem(CART_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Save to localStorage when items change
  useEffect(() => {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const addToCart = (
    product: Product,
    quantity: number = 1,
    selectedDate?: string,
    selectedTime?: string,
    packageId?: number,
    scheduleId?: number
  ) => {
    setItems((prev) => {
      const existingIndex = prev.findIndex((item) => item.product.id === product.id);

      if (existingIndex >= 0) {
        // Update existing item
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: updated[existingIndex].quantity + quantity,
          selectedDate: selectedDate || updated[existingIndex].selectedDate,
          selectedTime: selectedTime || updated[existingIndex].selectedTime,
          packageId: packageId ?? updated[existingIndex].packageId,
          scheduleId: scheduleId ?? updated[existingIndex].scheduleId,
        };
        return updated;
      } else {
        // Add new item
        return [...prev, { product, quantity, selectedDate, selectedTime, packageId, scheduleId }];
      }
    });
    setLastAddedAt(Date.now());
  };

  const removeFromCart = (productId: string) => {
    setItems((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }

    setItems((prev) =>
      prev.map((item) =>
        item.product.id === productId ? { ...item, quantity } : item
      )
    );
  };

  const clearCart = () => {
    setItems([]);
  };

  const getCartCount = () => {
    return items.reduce((sum, item) => sum + item.quantity, 0);
  };

  const getCartTotal = () => {
    return items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  };

  return (
    <CartContext.Provider
      value={{
        items,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        getCartCount,
        getCartTotal,
        lastAddedAt,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};

export default CartContext;
