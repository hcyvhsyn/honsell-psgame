import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { CartProvider } from "@/lib/cart";
import { ModalProvider } from "@/lib/modals";
import AppModals from "@/components/AppModals";

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
  title: "Honsell PS Store",
  description: "PlayStation Store oyunlarını ",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="az" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} bg-[#0A0A0F] text-zinc-100 antialiased min-h-screen relative`}
      >
        {/* Global deep purple ambient glow */}
        <div className="pointer-events-none fixed inset-0 z-[-1] overflow-hidden">
          <div className="absolute -right-[20%] top-[20%] h-[800px] w-[800px] rounded-full bg-[radial-gradient(circle_at_center,rgba(88,28,135,0.15)_0%,transparent_60%)] blur-[100px]" />
          <div className="absolute -bottom-[20%] -left-[10%] h-[600px] w-[600px] rounded-full bg-[radial-gradient(circle_at_center,rgba(88,28,135,0.12)_0%,transparent_60%)] blur-[100px]" />
        </div>

        <ModalProvider>
          <CartProvider>
            {children}
            <AppModals />
          </CartProvider>
        </ModalProvider>
      </body>
    </html>
  );
}
