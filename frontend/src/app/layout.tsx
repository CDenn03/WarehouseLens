import type { ReactNode } from "react";
import "./globals.css";

/**
 * Root layout — only provides <html>/<body> and global CSS.
 * Route groups provide their own segment layouts:
 *   (landing) > bare page (LandingPage has its own header/footer)
 *   (app)     > Sidebar + top header shell
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
