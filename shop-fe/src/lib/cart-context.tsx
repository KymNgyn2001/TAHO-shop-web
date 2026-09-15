// src/lib/cart-context.tsx
'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from './api-client';
import { useAuth } from './auth-context';

interface CartState {
  count: number;
  refresh: () => Promise<void>;
}

const CartContext = createContext<CartState | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [count, setCount] = useState(0);
  const { user } = useAuth();

  const refresh = useCallback(async () => {
    try {
      const cart = await api.getCart();
      setCount(cart.items.reduce((s, i) => s + i.quantity, 0));
    } catch {
      setCount(0);
    }
  }, []);

  useEffect(() => {
    function trigger() {
      refresh();
    }
    trigger();
  }, [refresh, user]);

  return <CartContext.Provider value={{ count, refresh }}>{children}</CartContext.Provider>;
}

export function useCart(): CartState {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart phai dung ben trong <CartProvider>.');
  return ctx;
}
