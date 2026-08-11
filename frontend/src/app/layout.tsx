import type { ReactNode } from "react";
import type { Metadata } from "next";
import Providers from "@/components/Providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "WarehouseLens",
  description: "AI-powered multi-warehouse operations platform",
  icons: {
    icon: [
      { url: "/brand/warehouse-lens/favicon.svg", type: "image/svg+xml" },
    ],
    apple: [
      { url: "/brand/warehouse-lens/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
  },
  manifest: "/manifest.json",
};

/**
 * Root layout — provides <html>/<body>, global CSS, and session context.
 * Route groups provide their own segment layouts:
 *   (landing) > bare page (LandingPage has its own header/footer)
 *   (app)     > Sidebar + top header shell
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
