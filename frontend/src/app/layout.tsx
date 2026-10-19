import type { ReactNode } from "react";
import type { Metadata } from "next";
import Providers from "@/components/Providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "WarehouseLens",
  description: "A clear view of inventory, procurement, fulfillment, demand and risk across every warehouse.",
  icons: {
    icon: [
      { url: "/brand/icons/favicon.ico", sizes: "any" },
      { url: "/brand/icons/favicon-light.svg", type: "image/svg+xml", media: "(prefers-color-scheme: light)" },
      { url: "/brand/icons/favicon-dark.svg", type: "image/svg+xml", media: "(prefers-color-scheme: dark)" },
    ],
    apple: [{ url: "/brand/icons/app-icon-180.png", sizes: "180x180", type: "image/png" }],
  },
  manifest: "/manifest.json",
  openGraph: {
    title: "WarehouseLens",
    description: "A clear view of operations across every warehouse.",
    images: [{ url: "/brand/social/social-card-1200x630.png", width: 1200, height: 630, alt: "WarehouseLens" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "WarehouseLens",
    description: "A clear view of operations across every warehouse.",
    images: ["/brand/social/social-card-1200x630.png"],
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
