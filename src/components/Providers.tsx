"use client";

import type { ReactNode } from "react";
import { AdminProvider } from "@/context/AdminContext";
import { DataProvider } from "@/context/DataContext";
import { FavoritesProvider } from "@/context/FavoritesContext";
import { ViewProvider } from "@/context/ViewContext";
import AdminLoginModal from "./AdminLoginModal";

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <AdminProvider>
      <DataProvider>
        <FavoritesProvider>
          <ViewProvider>
            {children}
            <AdminLoginModal />
          </ViewProvider>
        </FavoritesProvider>
      </DataProvider>
    </AdminProvider>
  );
}
