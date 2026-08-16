import { createContext, useContext } from 'react';

export interface Toast {
  id: number;
  message: string;
  /** Optional short prefix rendered in the accent colour, e.g. `JUGAAD`. */
  tag?: string;
}

export interface ToastContextValue {
  toasts: Toast[];
  push: (message: string, tag?: string) => void;
  dismiss: (id: number) => void;
}

export const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const value = useContext(ToastContext);
  if (!value) throw new Error('useToast must be used inside <ToastProvider>.');
  return value;
}
