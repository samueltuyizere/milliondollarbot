"use client";

import { createContext, useCallback, useContext, useState } from "react";

export type AppModal = "bot" | "config";

interface ModalContextValue {
  modal: AppModal | null;
  openModal: (id: AppModal) => void;
  closeModal: () => void;
}

const ModalContext = createContext<ModalContextValue | null>(null);

export function ModalProvider({ children }: { children: React.ReactNode }) {
  const [modal, setModal] = useState<AppModal | null>(null);

  const openModal = useCallback((id: AppModal) => setModal(id), []);
  const closeModal = useCallback(() => setModal(null), []);

  return (
    <ModalContext.Provider value={{ modal, openModal, closeModal }}>
      {children}
    </ModalContext.Provider>
  );
}

export function useModals() {
  const ctx = useContext(ModalContext);
  if (!ctx) throw new Error("useModals must be used within ModalProvider");
  return ctx;
}
