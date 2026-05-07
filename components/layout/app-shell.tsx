import type { Session } from "next-auth";
import Link from "next/link";
import { Bell, Plus, Search, UserCircle2 } from "lucide-react";
import { getServerAuthSession } from "@/lib/auth";
import { Sidebar } from "@/components/layout/sidebar";
import { Badge } from "@/components/ui/badge";
import { LanceCertoLogo } from "@/components/brand/lancecerto-logo";
import { USER_ROLE_LABELS } from "@/lib/constants";
import { LogoutButton } from "@/components/layout/logout-button";
import { getBrandingSettings } from "@/lib/system-settings";

async function UserHeader({ session }: { session: Session | null }) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-3 lg:flex-nowrap">
      <button
        type="button"
        className="hidden h-11 w-11 items-center justify-center rounded-2xl border border-border bg-white text-primary shadow-sm lg:flex"
        aria-label="Notificações"
      >
        <Bell className="h-4 w-4" />
      </button>
      <Badge tone="info" className="hidden md:inline-flex">
        {USER_ROLE_LABELS[(session?.user.role as keyof typeof USER_ROLE_LABELS) ?? "BUYER"]}
      </Badge>
      <div className="flex items-center gap-3 rounded-2xl border border-border bg-white px-4 py-2.5 shadow-sm">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/8 text-primary">
          <UserCircle2 className="h-5 w-5" />
        </div>
        <div className="text-left">
          <p className="whitespace-nowrap text-sm font-semibold text-foreground">{session?.user.name ?? "Admin Demo"}</p>
        </div>
      </div>
      <div className="shrink-0">
        <LogoutButton />
      </div>
    </div>
  );
}

export async function AppShell({
  children
}: {
  children: React.ReactNode;
}) {
  const session = await getServerAuthSession();
  const { systemName } = await getBrandingSettings();

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar systemName={systemName} />
      <div className="flex min-h-screen flex-1 flex-col">
        <header className="relative z-10 border-b border-border/70 bg-background px-5 py-5 lg:px-8">
          <div className="rounded-[2rem] border border-border/80 bg-white px-5 py-5 shadow-sm lg:px-6">
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(440px,0.9fr)] xl:items-start">
              <div className="min-w-0">
                <div className="flex items-center gap-3 lg:hidden">
                  <div className="pl-14">
                    <LanceCertoLogo compact />
                  </div>
                </div>

                <div className="hidden items-center gap-3 lg:flex">
                  <Badge tone="warning">Painel operacional</Badge>
                  <span className="text-sm text-muted">{systemName}</span>
                </div>

                <div className="mt-4 max-w-2xl">
                  <h1 className="max-w-xl font-display text-[2.05rem] font-bold leading-[1.02] tracking-[-0.06em] text-primary">
                    Gestão objetiva para leilões, lotes e vendas
                  </h1>
                  <p className="mt-3 max-w-xl text-sm leading-6 text-muted">
                    Controle operação, documentos, investimento, precificação e resultado em um fluxo claro.
                  </p>
                </div>
              </div>

              <div className="rounded-[1.4rem] border border-border/70 bg-background/55 p-3">
                <UserHeader session={session} />
              </div>
            </div>

            <div className="mt-5 rounded-[1.6rem] border border-border/70 bg-background/55 p-4">
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_190px]">
                <div className="flex items-center rounded-2xl border border-border bg-white px-4 py-3 text-sm text-muted shadow-sm">
                  <Search className="mr-2 h-4 w-4 shrink-0" />
                  <span className="truncate">Buscar lote, placa, modelo, cliente ou fornecedor</span>
                </div>
                <Link href="/vehicles/new" className="w-full">
                  <span className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-accent px-4 text-sm font-semibold text-white shadow-glow transition hover:bg-[#C88914]">
                    <Plus className="h-4 w-4" />
                    Novo lote
                  </span>
                </Link>
              </div>
            </div>
          </div>
        </header>
        <main className="flex-1 px-5 py-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
