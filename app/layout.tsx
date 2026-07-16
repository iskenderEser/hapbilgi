import type { Metadata } from "next";
import { Nunito } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/app/providers/AuthProvider";
import { PushAbonelik } from "@/app/providers/PushAbonelik";

const nunito = Nunito({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-nunito",
});

export const metadata: Metadata = {
  title: "HapBilgi",
  description: "v-learning",
  // PWA/push zemini (P1): manifest yüklenebilirlik + iOS "Ana Ekrana Ekle"
  // (iOS Safari push'u yalnız PWA kurulumunda destekler — plan A.5).
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "HapBilgi",
    statusBarStyle: "default",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body className={`${nunito.variable}`} style={{ fontFamily: "var(--font-nunito), sans-serif" }}>
        <AuthProvider>
          {children}
          <PushAbonelik />
        </AuthProvider>
      </body>
    </html>
  );
}