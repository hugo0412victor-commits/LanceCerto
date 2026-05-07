"use client";

import { Bar, BarChart, CartesianGrid, Cell, Funnel, FunnelChart, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { VEHICLE_STATUS_LABELS } from "@/lib/constants";
import { formatCompactCurrency, formatCurrency } from "@/lib/format";

const pieColors = ["#0D3B5C", "#E09A1A", "#2C6EA5", "#1F8C5C", "#8A94A6", "#C55A4F"];
const vehicleStageOrder = [
  "ANALISE_LOTE",
  "ARREMATADO",
  "AGUARDANDO_PAGAMENTO",
  "PAGO",
  "AGUARDANDO_RETIRADA",
  "RETIRADO",
  "VISTORIA_INICIAL",
  "ORCAMENTO_REPAROS",
  "MECANICA",
  "FUNILARIA",
  "PINTURA",
  "ESTETICA",
  "DOCUMENTACAO",
  "PRECIFICACAO",
  "FOTOS_ANUNCIO",
  "ANUNCIADO",
  "EM_NEGOCIACAO",
  "VENDIDO",
  "TRANSFERIDO",
  "FINALIZADO",
  "CANCELADO"
] as const;

function getVehicleStageLabel(status: string) {
  return VEHICLE_STATUS_LABELS[status as keyof typeof VEHICLE_STATUS_LABELS] ?? status;
}

export function DashboardCharts({
  profitByVehicle,
  expensesByCategory,
  capitalEvolution,
  statusFunnel
}: {
  profitByVehicle: Array<{ name: string; previsto: number; real: number }>;
  expensesByCategory: Array<{ name: string; value: number }>;
  capitalEvolution: Array<{ date: string; invested: number }>;
  statusFunnel: Array<{ status: string; total: number }>;
}) {
  const orderedStatusFunnel = statusFunnel
    .slice()
    .sort((first, second) => {
      const firstIndex = vehicleStageOrder.indexOf(first.status as (typeof vehicleStageOrder)[number]);
      const secondIndex = vehicleStageOrder.indexOf(second.status as (typeof vehicleStageOrder)[number]);
      return (firstIndex === -1 ? 999 : firstIndex) - (secondIndex === -1 ? 999 : secondIndex);
    })
    .map((entry, index) => ({
      ...entry,
      label: getVehicleStageLabel(entry.status),
      fill: pieColors[index % pieColors.length]
    }));

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <Card>
        <CardHeader title="Lucro previsto x real" description="Comparativo por veículo cadastrado." />
        <CardContent className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={profitByVehicle}>
              <CartesianGrid strokeDasharray="4 4" stroke="#E2E8F0" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#667085" }} />
              <YAxis tickFormatter={(value) => formatCompactCurrency(value)} tick={{ fill: "#667085" }} />
              <Tooltip formatter={(value: number) => formatCurrency(value)} />
              <Bar dataKey="previsto" fill="#0D3B5C" radius={[10, 10, 0, 0]} />
              <Bar dataKey="real" fill="#E09A1A" radius={[10, 10, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader title="Gastos por categoria" description="Composição dos custos do portfólio." />
        <CardContent className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={expensesByCategory} dataKey="value" nameKey="name" innerRadius={72} outerRadius={112} paddingAngle={3}>
                {expensesByCategory.map((entry, index) => (
                  <Cell key={entry.name} fill={pieColors[index % pieColors.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number) => formatCurrency(value)} />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader title="Evolução do capital investido" description="Acumulado por data de arremate." />
        <CardContent className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={capitalEvolution}>
              <CartesianGrid strokeDasharray="4 4" stroke="#E2E8F0" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#667085" }} />
              <YAxis tickFormatter={(value) => formatCompactCurrency(value)} tick={{ fill: "#667085" }} />
              <Tooltip formatter={(value: number) => formatCurrency(value)} />
              <Line type="monotone" dataKey="invested" stroke="#0D3B5C" strokeWidth={3} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader title="Veículos por etapa" description="Leitura do funil operacional com nome e volume por etapa." />
        <CardContent className="grid h-[320px] gap-4 xl:grid-cols-[minmax(0,1.1fr)_220px]">
          <div className="h-full">
            <ResponsiveContainer width="100%" height="100%">
              <FunnelChart>
                <Tooltip
                  formatter={(value: number, _name, item) => [
                    `${value} veículo(s)`,
                    (item?.payload as { label?: string } | undefined)?.label ?? "Etapa"
                  ]}
                />
                <Funnel dataKey="total" data={orderedStatusFunnel} isAnimationActive>
                  {orderedStatusFunnel.map((entry) => (
                    <Cell key={entry.status} fill={entry.fill} />
                  ))}
                </Funnel>
              </FunnelChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-2 overflow-y-auto rounded-[1.4rem] border border-border/70 bg-background/55 p-3">
            {orderedStatusFunnel.map((entry, index) => (
              <div key={entry.status} className="rounded-2xl border border-border/70 bg-white/85 px-3 py-2.5 shadow-sm">
                <div className="flex items-center gap-3">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: entry.fill }} />
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Etapa {index + 1}</p>
                </div>
                <p className="mt-2 text-sm font-semibold text-primary">{entry.label}</p>
                <p className="mt-1 text-xs text-muted">{entry.total} veículo(s)</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
