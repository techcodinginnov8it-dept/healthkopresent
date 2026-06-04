import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="en" className="scroll-smooth">
      <body className="font-sans antialiased text-slate-800 bg-[#FAFBFD]">{children}</body>
    </html>
  );
}
