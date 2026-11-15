"use client";

import type { ReactNode } from "react";
import { AdminProvider } from "@/context/AdminContext";
import { AiProvider } from "@/context/AiContext";
import { DataProvider } from "@/context/DataContext";
import { FavoritesProvider } from "@/context/FavoritesContext";
import { ViewProvider } from "@/context/ViewContext";
import AdminLoginModal from "./AdminLoginModal";
import CompanyProfilePanel from "./CompanyProfilePanel";

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <AdminProvider>
      <DataProvider>
        <AiProvider>
          <FavoritesProvider>
            <ViewProvider>
              {children}
              <AdminLoginModal />
              <CompanyProfilePanel />
            </ViewProvider>
          </FavoritesProvider>
        </AiProvider>
      </DataProvider>
    </AdminProvider>
  );
}
