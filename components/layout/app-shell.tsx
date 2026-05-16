import type { Session } from "next-auth";
import { Bell, UserCircle2 } from "lucide-react";
import { getServerAuthSession } from "@/lib/auth";
import { Sidebar } from "@/components/layout/sidebar";
import { Badge } from "@/components/ui/badge";
import { LanceCertoLogo } from "@/components/brand/lancecerto-logo";
import { USER_ROLE_LABELS } from "@/lib/constants";
import { LogoutButton } from "@/components/layout/logout-button";
import { getBrandingSettings } from "@/lib/system-settings";
import { canWrite } from "@/lib/permissions";
import { GlobalSearchBar } from "@/components/layout/global-search-bar";

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
        {USER_ROLE_LABELS[(session?.user.role as keyof typeof USER_ROLE_LABELS) ?? "VIEWER"]}
      </Badge>
      <div className="flex items-center gap-3 rounded-2xl border border-border bg-white px-4 py-2.5 shadow-sm">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/8 text-primary">
          <UserCircle2 className="h-5 w-5" />
        </div>
        <div className="text-left">
          <p className="whitespace-nowrap text-sm font-semibold text-foreground">{session?.user.name ?? "Usuario"}</p>
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
  const userCanWrite = canWrite(session?.user.role);

  return (
    <div className="flex min-h-screen w-full max-w-full overflow-x-hidden bg-background">
      <Sidebar systemName={systemName} />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col overflow-x-hidden">
        <header className="relative z-10 min-w-0 border-b border-border/70 bg-background px-4 py-5 lg:px-6">
          <div className="min-w-0 rounded-[2rem] border border-border/80 bg-white px-4 py-5 shadow-sm lg:px-5">
            <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(280px,0.75fr)] xl:items-start">
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

              <div className="min-w-0 rounded-[1.4rem] border border-border/70 bg-background/55 p-3">
                <UserHeader session={session} />
              </div>
            </div>

            <div className="mt-5 min-w-0 rounded-[1.6rem] border border-border/70 bg-background/55 p-4">
              <GlobalSearchBar userCanWrite={userCanWrite} />
            </div>
          </div>
        </header>
        <main className="min-w-0 max-w-full flex-1 overflow-x-hidden px-4 py-6 lg:px-6">{children}</main>
      </div>
    </div>
  );
}
