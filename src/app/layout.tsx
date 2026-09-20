import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import Script from "next/script";
import { HydrationGuard } from "@/components/HydrationGuard";
import { TouchActive } from "@/components/TouchActive";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta", display: "swap" });

export const metadata: Metadata = {
  title: "Mozaic",
  description:
    "Understand what taking part in a cancer trial would involve, and prepare a useful first conversation with a research coordinator.",
  // Launches full-screen from the iPhone home screen, without Safari's chrome.
  appleWebApp: { capable: true, title: "Mozaic", statusBarStyle: "default" },
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
    <html lang="en" className={jakarta.variable} suppressHydrationWarning>
      {/* Extensions and the embedded browser add attributes before hydration. */}
      <body className="min-h-dvh" suppressHydrationWarning>
        <Script id="cursor-ref-strip" strategy="beforeInteractive">
          {`(function(){function s(){document.querySelectorAll("[data-cursor-ref]").forEach(function(el){el.removeAttribute("data-cursor-ref")})}s();var o=new MutationObserver(s);o.observe(document.documentElement,{attributes:true,attributeFilter:["data-cursor-ref"],subtree:true,childList:true});window.__stopCursorRefStrip=function(){o.disconnect()}})();`}
        </Script>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-full focus:bg-iris focus:px-4 focus:py-2 focus:text-sm focus:text-white"
        >
          Skip to content
        </a>
        <TouchActive />
        <HydrationGuard />
        {children}
      </body>
    </html>
  );
}
