import type { Metadata, Viewport } from "next";
import Header from "@/components/Header";
import Providers from "@/components/Providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "GoodSales – ehituse müügivihjed",
  description: "Varajased müügivihjed Eesti ehitus- ja arhitektuurisektorile Ehitisregistri projekteerimistingimuste taotlustest.",
  applicationName: "GoodSales",
  appleWebApp: { capable: true, title: "GoodSales", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#005AA3",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="et">
      <body className="min-h-dvh bg-page font-sans antialiased">
        <Providers>
          <Header />
          <main>{children}</main>
        </Providers>
      </body>
    </html>
  );
}
