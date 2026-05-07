import { LoginForm } from "@/components/auth/login-form";
import { Award, BarChart3, CheckCircle2, ShieldCheck } from "lucide-react";
import { LanceCertoLogo } from "@/components/brand/lancecerto-logo";
import { Suspense } from "react";

export default async function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="grid w-full max-w-6xl gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="surface-card brand-pattern overflow-hidden rounded-[2rem] bg-brand-mesh p-8">
          <BadgeSection />
          <LanceCertoLogo showTagline className="mt-6" />
          <h1 className="mt-8 max-w-2xl font-display text-4xl font-bold leading-tight tracking-[-0.05em] text-primary md:text-[3.35rem]">
            Gestão inteligente para leilões, lotes, vendas e retorno previsto.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-slate-700">
            LanceCerto reúne operação, documentos, compras, investimento, análise de risco e previsões de margem em uma interface corporativa clara e confiável.
          </p>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {[
              { icon: ShieldCheck, text: "Transparência operacional com histórico completo do lote" },
              { icon: CheckCircle2, text: "Fluxo resiliente a dados incompletos e pendências" },
              { icon: BarChart3, text: "Indicadores de lucro, ROI, capital investido e giro" },
              { icon: Award, text: "Base preparada para crescimento com vendas e performance" }
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="rounded-[1.6rem] border border-white/80 bg-white/80 p-4 text-sm text-slate-700 shadow-sm">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/8 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <p className="mt-4 leading-6">{text}</p>
              </div>
            ))}
          </div>
        </section>
        <section className="surface-card rounded-[2rem] p-8">
          <p className="text-sm font-medium uppercase tracking-[0.24em] text-accent">Acesso seguro</p>
          <h2 className="mt-2 font-display text-3xl font-bold tracking-[-0.04em] text-primary">Entrar no LanceCerto</h2>
          <p className="mt-3 text-sm text-muted">
            Use uma conta cadastrada para acessar o painel de gestão, operação e performance comercial.
          </p>
          <div className="mt-8">
            <Suspense fallback={null}>
              <LoginForm />
            </Suspense>
          </div>
        </section>
      </div>
    </main>
  );
}

function BadgeSection() {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-primary/10 bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-primary shadow-sm">
      <ShieldCheck className="h-4 w-4 text-accent" />
      SaaS de Gestão de Leilão e Vendas
    </div>
  );
}
