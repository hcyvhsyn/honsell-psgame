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
        className={`${geistSans.variable} ${geistMono.variable} bg-zinc-950 text-zinc-100 antialiased`}
      >
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
