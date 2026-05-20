import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "HealthKo - Premium Telehealth & Healthcare Anywhere",
  description: "Connect with top certified doctors online. Schedule appointments, consult via secure video, access medical records, and manage prescriptions—all in one place.",
  keywords: ["telehealth", "online doctor", "medical records", "virtual care", "HealthKo", "doctor scheduling"],
  authors: [{ name: "HealthKo Team" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${outfit.variable} scroll-smooth`}>
      <body className="font-sans antialiased text-slate-800 bg-[#FAFBFD]">{children}</body>
    </html>
  );
}
