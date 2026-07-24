import type { ReactNode } from "react";
import Providers from "@/components/Providers";
import "./globals.css";

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
