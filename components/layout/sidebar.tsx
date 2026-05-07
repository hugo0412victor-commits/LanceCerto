"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { CarFront, ChartColumn, ClipboardList, FileText, HandCoins, Images, LayoutDashboard, Menu, Megaphone, NotebookTabs, Settings2, ShoppingCart, Users, X } from "lucide-react";
import { LanceCertoLogo } from "@/components/brand/lancecerto-logo";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const items = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/vehicles", label: "Lotes / Veículos", icon: CarFront },
  { href: "/simulator", label: "Simulador", icon: ShoppingCart },
  { href: "/market-research", label: "Pesquisa de mercado", icon: ChartColumn },
  { href: "/expenses", label: "Gastos", icon: HandCoins },
  { href: "/processes", label: "Processos", icon: ClipboardList },
  { href: "/documents", label: "Documentos", icon: FileText },
  { href: "/photos", label: "Fotos", icon: Images },
  { href: "/sales", label: "Vendas", icon: Megaphone },
  { href: "/suppliers", label: "Fornecedores", icon: Users },
  { href: "/reports", label: "Relatórios", icon: NotebookTabs },
  { href: "/settings", label: "Configurações", icon: Settings2 }
];

export function Sidebar({ systemName }: { systemName: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const content = (
    <>
      <div className="rounded-[2rem] border border-primary/10 bg-brand-mesh p-5 shadow-panel">
        <LanceCertoLogo showTagline />
        <div className="mt-5 rounded-[1.4rem] border border-primary/10 bg-white/80 p-4 shadow-sm">
          <p className="text-xs uppercase tracking-[0.26em] text-accent">Operação ativa</p>
          <p className="mt-2 text-sm leading-6 text-foreground/78">
            Gestão completa de leilões, lotes, vendas, documentos e retorno previsto em um só fluxo.
          </p>
          <div className="mt-4 flex items-center gap-2">
            <Badge tone="warning">SaaS Premium</Badge>
            <span className="text-xs text-muted">{systemName}</span>
          </div>
        </div>
      </div>

      <nav className="mt-6 flex flex-1 flex-col gap-2">
        {items.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={cn(
                "group flex items-center gap-3 rounded-2xl px-4 py-3.5 text-sm transition duration-200",
                active
                  ? "bg-gradient-to-r from-[#0D7A74] via-[#438967] to-[#F2B22B] text-white shadow-glow"
                  : "text-foreground/78 hover:bg-primary/6 hover:text-primary"
              )}
            >
              <span
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-xl border transition",
                  active
                    ? "border-white/20 bg-white/12"
                    : "border-primary/10 bg-white shadow-sm group-hover:border-primary/18 group-hover:bg-primary/5"
                )}
              >
                <Icon className="h-4 w-4" />
              </span>
              <span className="font-semibold">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="rounded-[1.8rem] border border-accent/20 bg-accent/8 p-5 text-sm text-foreground/82">
        <p className="text-xs uppercase tracking-[0.28em] text-accent">Diretriz operacional</p>
        <p className="mt-3 leading-6">
          Nenhum fluxo deve parar por falta de informação. Salve parcial, marque pendências e avance a operação.
        </p>
      </div>
    </>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed left-4 top-4 z-40 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-white shadow-float lg:hidden"
        aria-label="Abrir menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {open ? <div className="fixed inset-0 z-40 bg-[#071d2d]/28 backdrop-blur-sm lg:hidden" onClick={() => setOpen(false)} /> : null}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[300px] shrink-0 flex-col border-r border-border bg-white px-5 py-6 text-foreground transition-transform duration-300 lg:static lg:z-auto lg:w-[312px] lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="mb-4 flex items-center justify-between lg:hidden">
          <LanceCertoLogo compact />
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-background text-primary"
            aria-label="Fechar menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {content}
      </aside>
    </>
  );
}
