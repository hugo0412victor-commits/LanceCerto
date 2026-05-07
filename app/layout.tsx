import type { Metadata } from "next";
import { SessionProvider } from "@/components/providers/session-provider";
import { getBrandingSettings } from "@/lib/system-settings";
import "@/app/globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const { companyName } = await getBrandingSettings();

  return {
    title: "LanceCerto",
    description: `Sistema de gestão de leilão e vendas com foco em precisão, transparência e resultado para ${companyName}.`
  };
}

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="bg-background font-sans text-foreground antialiased">
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
