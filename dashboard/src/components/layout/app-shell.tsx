"use client";

import { useState, useEffect, useCallback } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { AppModals } from "@/components/layout/app-modals";
import { PanelUrlSync } from "@/components/layout/panel-url-sync";
import { ModalProvider } from "@/context/modal-context";

const STORAGE_KEY = "aitrader_sidebar_collapsed";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY) === "true") {
      setSidebarCollapsed(true);
    }
  }, []);

  const handleSidebarClose = useCallback(() => setSidebarOpen(false), []);

  const handleMenuToggle = useCallback(() => {
    setSidebarOpen((prev) => !prev);
  }, []);

  const handleSidebarCollapsedChange = useCallback((collapsed: boolean) => {
    setSidebarCollapsed(collapsed);
    localStorage.setItem(STORAGE_KEY, String(collapsed));
  }, []);

  return (
    <ModalProvider>
      <PanelUrlSync />
      <div className="flex h-screen min-h-dvh bg-shell overflow-hidden">
        <Sidebar
          isOpen={sidebarOpen}
          collapsed={sidebarCollapsed}
          onClose={handleSidebarClose}
          onCollapsedChange={handleSidebarCollapsedChange}
        />

        <div
          className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${
            sidebarCollapsed ? "lg:ml-20" : "lg:ml-64"
          }`}
        >
          <Header
            sidebarOpen={sidebarOpen}
            sidebarCollapsed={sidebarCollapsed}
            onMenuToggle={handleMenuToggle}
          />

          <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-5 md:p-6 lg:p-8">
            <div className="container-content">{children}</div>
          </main>
        </div>
      </div>

      <AppModals />
    </ModalProvider>
  );
}
