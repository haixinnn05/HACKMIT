import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta", display: "swap" });

export const metadata: Metadata = {
  title: "Trial Passport",
  description:
    "Understand what taking part in a cancer trial would involve, and prepare a useful first conversation with a research coordinator.",
  // Launches full-screen from the iPhone home screen, without Safari's chrome.
  appleWebApp: { capable: true, title: "Trial Passport", statusBarStyle: "default" },
};

// viewport-fit=cover exposes the safe-area insets, so the bottom navigation
// clears the home indicator on notched phones.
export const viewport: Viewport = { themeColor: "#fde9d7", width: "device-width", initialScale: 1, viewportFit: "cover" };

/**
 * Root layout: document shell only. Navigation lives in the `(app)` route group
 * so routes read by someone other than the account holder, such as the scanned
 * passport view, can opt out of participant chrome entirely.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={jakarta.variable}>
      {/* Browser extensions add attributes to <body> before hydration. */}
      <body className="min-h-dvh" suppressHydrationWarning>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-full focus:bg-iris focus:px-4 focus:py-2 focus:text-sm focus:text-white"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
