import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pleno CRM",
  description: "Plataforma de operações comerciais — Meu Cuidado Essencial",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className="font-sans">{children}</body>
    </html>
  );
}
