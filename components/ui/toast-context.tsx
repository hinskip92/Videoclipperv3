import React, { createContext, useContext, useState } from "react";
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "./toast";

interface ToastContextType {
  toast: (title: string, description?: string, variant?: "default" | "destructive") => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastContainer({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Array<{
    id: string;
    title: string;
    description?: string;
    variant?: "default" | "destructive";
  }>>([]);

  const addToast = (title: string, description?: string, variant: "default" | "destructive" = "default") => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, title, description, variant }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 5000);
  };

  return (
    <ToastContext.Provider value={{ toast: addToast }}>
      <ToastProvider>
        {children}
        {toasts.map(({ id, title, description, variant }) => (
          <Toast key={id} variant={variant}>
            <div className="grid gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            <ToastClose />
          </Toast>
        ))}
        <ToastViewport />
      </ToastProvider>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
} 