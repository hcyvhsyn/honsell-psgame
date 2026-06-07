import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { CartProvider } from "@/lib/cart";
import { ModalProvider } from "@/lib/modals";
import { DialogProvider } from "@/lib/dialogs";
import { ThemeProvider, THEME_BOOTSTRAP_SCRIPT } from "@/lib/theme";
import ThemeToggle from "@/components/ThemeToggle";
import AppModals from "@/components/AppModals";
import FavoritesBootstrap from "@/components/FavoritesBootstrap";
import FavoriteIntroModal from "@/components/FavoriteIntroModal";
import AskAiFloat from "@/components/AskAiFloat";
import TopLoader from "@/components/TopLoader";
import { Suspense } from "react";
import { SITE_URL, SITE_NAME, SITE_DESCRIPTION } from "@/lib/site";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — Azərbaycanda PlayStation oyunları`,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    "PlayStation",
    "PS5",
    "PS4",
    "PS Plus",
    "PSN",
    "PS Store Azərbaycan",
    "oyun almaq",
    "hədiyyə kartı",
    "Türkiyə PSN hesabı",
    "PlayStation Türkiye",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "az_AZ",
    siteName: SITE_NAME,
    url: SITE_URL,
    title: `${SITE_NAME} — Azərbaycanda PlayStation oyunları`,
    description: SITE_DESCRIPTION,
    images: [
      {
        url: "/icon.png",
        width: 512,
        height: 512,
        alt: SITE_NAME,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — Azərbaycanda PlayStation oyunları`,
    description: SITE_DESCRIPTION,
    images: ["/icon.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  icons: {
    icon: "/icon.png",
    apple: "/icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#0A0A0F",
  colorScheme: "light dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="az" suppressHydrationWarning>
      <head>
        {/* Sync ilkin tema seçimi (localStorage / system pref) — render-dən
            əvvəl <html> üzərinə .dark / .light qoyub palet flash-ını qarşılayır. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen bg-[var(--background)] text-[var(--foreground)] antialiased relative`}
      >
        {/* Global deep purple ambient glow */}
        <div className="pointer-events-none fixed inset-0 z-[-1] overflow-hidden">
          <div className="absolute -right-[20%] top-[20%] h-[800px] w-[800px] rounded-full bg-[radial-gradient(circle_at_center,var(--ambient-1)_0%,transparent_60%)] blur-[100px]" />
          <div className="absolute -bottom-[20%] -left-[10%] h-[600px] w-[600px] rounded-full bg-[radial-gradient(circle_at_center,var(--ambient-2)_0%,transparent_60%)] blur-[100px]" />
        </div>

        <Suspense fallback={null}>
          <TopLoader />
        </Suspense>

        <ThemeProvider>
          <DialogProvider>
            <ModalProvider>
              <FavoritesBootstrap>
                <CartProvider>
                  {children}
                  <AppModals />
                  <FavoriteIntroModal />
                  <AskAiFloat />
                  <ThemeToggle />
                </CartProvider>
              </FavoritesBootstrap>
            </ModalProvider>
          </DialogProvider>
        </ThemeProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
