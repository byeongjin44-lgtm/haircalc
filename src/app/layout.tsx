import type { Metadata, Viewport } from "next";
import "./globals.css";
import BottomNav from "@/components/BottomNav";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import { SuccessOverlayProvider } from "@/components/SuccessOverlay";
import { APP_DESCRIPTION, APP_NAME, APP_THEME_COLOR } from "@/lib/branding";

export const metadata: Metadata = {
  title: APP_NAME,
  description: APP_DESCRIPTION,
  applicationName: APP_NAME,
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: APP_NAME,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: APP_THEME_COLOR,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full">
      <body className="flex min-h-full flex-col bg-zinc-50 text-zinc-900 antialiased">
        <SuccessOverlayProvider>
          <main className="mx-auto w-full max-w-md flex-1 px-4 pb-24 pt-4">
            {children}
          </main>
          <BottomNav />
        </SuccessOverlayProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
