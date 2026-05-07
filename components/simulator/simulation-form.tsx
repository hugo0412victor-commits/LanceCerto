"use client";

import { useEffect, useRef, useState } from "react";
import { LOT_ANALYSIS_DEFAULTS, calculateRecommendedBid, calculateVehicleFinancials } from "@/lib/calculations";
import { formatCurrency, formatPercent } from "@/lib/format";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

type VehicleOption = {
  id: string;
  stockCode?: string | null;
  brand?: string | null;
  model?: string | null;
  version?: string | null;
  modelYear?: number | null;
  fipeValue?: number | null;
  marketEstimatedValue?: number | null;
  bidValue?: number | null;
  auctionCommission?: number | null;
  administrativeFees?: number | null;
  yardCost?: number | null;
  towCost?: number | null;
  documentationExpected?: number | null;
  repairsExpected?: number | null;
  predictedSalePrice?: number | null;
  predictedMargin?: number | null;
  predictedRoi?: number | null;
};

type SimulationFormProps = {
  vehicles: VehicleOption[];
  action: (formData: FormData) => void | Promise<void>;
};

type FormState = {
  vehicleId: string;
  brand: string;
  model: string;
  version: string;
  year: string;
  fipeValue: string;
  marketAverageValue: string;
  intendedBid: string;
  auctionCommission: string;
  administrativeFees: string;
  yardCost: string;
  towCost: string;
  documentationCost: string;
  estimatedRepairs: string;
  desiredMargin: string;
  predictedSalePrice: string;
  desiredDiscountOnFipe: string;
  estimatedSellingDays: string;
};

const FIELD_LABELS: Array<[keyof Omit<FormState, "vehicleId">, string]> = [
  ["brand", "Marca"],
  ["model", "Modelo"],
  ["version", "Versão"],
  ["year", "Ano"],
  ["fipeValue", "FIPE"],
  ["marketAverageValue", "Valor médio de mercado"],
  ["intendedBid", "Lance pretendido"],
  ["auctionCommission", "Comissão do leilão"],
  ["administrativeFees", "Taxas administrativas"],
  ["yardCost", "Pátio"],
  ["towCost", "Guincho"],
  ["documentationCost", "Documentação"],
  ["estimatedRepairs", "Reparos estimados"],
  ["desiredMargin", "Margem desejada (%)"],
  ["predictedSalePrice", "Venda prevista"],
  ["desiredDiscountOnFipe", "Deságio sobre FIPE (%)"],
  ["estimatedSellingDays", "Prazo estimado de venda (dias)"]
];

function formatInputNumber(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "";
  }

  return String(Math.round(value * 100) / 100);
}

function toNumber(value: string) {
  if (!value.trim()) return 0;
  const normalized = value.replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildVehicleDefaults(vehicle?: VehicleOption): FormState {
  const fipeValue = vehicle?.fipeValue ?? 0;
  const marketAverageValue = vehicle?.marketEstimatedValue ?? vehicle?.predictedSalePrice ?? 0;
  const intendedBid = vehicle?.bidValue ?? 0;
  const desiredDiscountOnFipe = LOT_ANALYSIS_DEFAULTS.saleDiscountOnFipePercent;
  const predictedSalePrice =
    vehicle?.predictedSalePrice ??
    (fipeValue > 0 ? Number((fipeValue * (1 - desiredDiscountOnFipe / 100)).toFixed(2)) : marketAverageValue || 0);

  return {
    vehicleId: vehicle?.id ?? "",
    brand: vehicle?.brand ?? "",
    model: vehicle?.model ?? "",
    version: vehicle?.version ?? "",
    year: vehicle?.modelYear ? String(vehicle.modelYear) : "",
    fipeValue: formatInputNumber(fipeValue),
    marketAverageValue: formatInputNumber(marketAverageValue),
    intendedBid: formatInputNumber(intendedBid || vehicle?.bidValue),
    auctionCommission: formatInputNumber(vehicle?.auctionCommission ?? (intendedBid > 0 ? intendedBid * (LOT_ANALYSIS_DEFAULTS.auctioneerCommissionPercent / 100) : 0)),
    administrativeFees: formatInputNumber(vehicle?.administrativeFees ?? LOT_ANALYSIS_DEFAULTS.originExpensesCost),
    yardCost: formatInputNumber(vehicle?.yardCost ?? 0),
    towCost: formatInputNumber(vehicle?.towCost ?? 0),
    documentationCost: formatInputNumber(vehicle?.documentationExpected ?? undefined),
    estimatedRepairs: formatInputNumber(vehicle?.repairsExpected ?? 0),
    desiredMargin: formatInputNumber(LOT_ANALYSIS_DEFAULTS.desiredMarginPercent),
    predictedSalePrice: formatInputNumber(predictedSalePrice),
    desiredDiscountOnFipe: formatInputNumber(desiredDiscountOnFipe),
    estimatedSellingDays: ""
  };
}

export function SimulationForm({ vehicles, action }: SimulationFormProps) {
  const [form, setForm] = useState<FormState>(() => buildVehicleDefaults());
  const [manualSalePrice, setManualSalePrice] = useState(false);
  const [manualCommission, setManualCommission] = useState(false);
  const previousBidRef = useRef(form.intendedBid);

  useEffect(() => {
    const nextBid = toNumber(form.intendedBid);
    const previousBid = toNumber(previousBidRef.current);
    previousBidRef.current = form.intendedBid;

    if (!manualCommission && nextBid !== previousBid) {
      setForm((current) => ({
        ...current,
        auctionCommission: formatInputNumber(nextBid * (LOT_ANALYSIS_DEFAULTS.auctioneerCommissionPercent / 100))
      }));
    }
  }, [form.intendedBid, manualCommission]);

  useEffect(() => {
    if (manualSalePrice) return;

    const fipeValue = toNumber(form.fipeValue);
    const discount = toNumber(form.desiredDiscountOnFipe);
    const marketValue = toNumber(form.marketAverageValue);
    const nextSalePrice =
      fipeValue > 0 ? fipeValue * (1 - discount / 100) : marketValue > 0 ? marketValue : 0;

    setForm((current) => ({
      ...current,
      predictedSalePrice: formatInputNumber(nextSalePrice)
    }));
  }, [form.fipeValue, form.desiredDiscountOnFipe, form.marketAverageValue, manualSalePrice]);

  const selectedVehicle = vehicles.find((vehicle) => vehicle.id === form.vehicleId);

  const liveCalculations = calculateVehicleFinancials({
    fipeValue: toNumber(form.fipeValue),
    marketValue: toNumber(form.marketAverageValue),
    bidValue: toNumber(form.intendedBid),
    auctionCommission: toNumber(form.auctionCommission),
    administrativeFees: toNumber(form.administrativeFees),
    yardCost: toNumber(form.yardCost),
    towCost: toNumber(form.towCost),
    documentationCost: toNumber(form.documentationCost),
    repairCost: toNumber(form.estimatedRepairs),
    predictedSalePrice: toNumber(form.predictedSalePrice),
    desiredMarginPercent: toNumber(form.desiredMargin)
  });

  const liveRecommendedBid = calculateRecommendedBid({
    predictedSalePrice: toNumber(form.predictedSalePrice) || toNumber(form.marketAverageValue) || toNumber(form.fipeValue),
    desiredMarginPercent: toNumber(form.desiredMargin) || LOT_ANALYSIS_DEFAULTS.desiredMarginPercent,
    extraCosts:
      toNumber(form.auctionCommission) +
      toNumber(form.administrativeFees) +
      toNumber(form.yardCost) +
      toNumber(form.towCost) +
      toNumber(form.documentationCost) +
      toNumber(form.estimatedRepairs)
  });

  const previewRows = [
    { label: "Venda prevista", value: toNumber(form.predictedSalePrice) },
    { label: "Custo previsto", value: liveCalculations.totalPredictedCost },
    { label: "Lucro previsto", value: liveCalculations.predictedProfit },
    { label: "Margem prevista", value: liveCalculations.predictedMargin, type: "percent" as const },
    { label: "ROI previsto", value: liveCalculations.predictedRoi, type: "percent" as const },
    { label: "Preço mínimo", value: liveCalculations.priceMinimum },
    { label: "Lance máximo recomendado", value: liveRecommendedBid.moderate }
  ];

  function updateField(field: keyof FormState, value: string) {
    setForm((current) => ({
      ...current,
      [field]: value
    }));
  }

  function handleVehicleChange(vehicleId: string) {
    const vehicle = vehicles.find((item) => item.id === vehicleId);
    setManualSalePrice(false);
    setManualCommission(false);
    setForm(buildVehicleDefaults(vehicle));
  }

  return (
    <>
      <Card>
        <CardHeader title="Nova simulação" description="Pode ser independente ou vinculada a um veículo já cadastrado." />
        <CardContent>
          <form action={action} className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm md:col-span-2">
              <span className="font-medium">Veículo vinculado</span>
              <Select name="vehicleId" value={form.vehicleId} onChange={(event) => handleVehicleChange(event.target.value)}>
                <option value="">Somente simulação</option>
                {vehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.stockCode} • {[vehicle.brand, vehicle.model, vehicle.version].filter(Boolean).join(" ")}
                  </option>
                ))}
              </Select>
            </label>

            {FIELD_LABELS.map(([name, label]) => (
              <label key={name} className="space-y-2 text-sm">
                <span className="font-medium">{label}</span>
                <Input
                  name={name}
                  value={form[name]}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    if (name === "predictedSalePrice") setManualSalePrice(true);
                    if (name === "auctionCommission") setManualCommission(true);
                    updateField(name, nextValue);
                  }}
                />
              </label>
            ))}

            <div className="rounded-3xl border border-border bg-background/55 p-4 text-sm md:col-span-2">
              <p className="font-semibold text-primary">Base aplicada ao simulador</p>
              <p className="mt-2 text-muted">
                {selectedVehicle
                  ? `Valores iniciais puxados do veículo ${[selectedVehicle.brand, selectedVehicle.model, selectedVehicle.version].filter(Boolean).join(" ")}. Você pode editar margem, deságio, venda e custos para testar cenários diferentes.`
                  : "Selecione um veículo para carregar os valores base automaticamente ou preencha os campos manualmente."}
              </p>
            </div>

            <button type="submit" className="rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-white shadow-panel transition hover:bg-[#0A314C] md:col-span-2">
              Salvar simulação
            </button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader title="Leitura instantânea do simulador" description="Os resultados abaixo são recalculados enquanto você ajusta percentuais, custos e venda prevista." />
        <CardContent className="space-y-2.5">
          {previewRows.map((row) => (
            <div key={row.label} className="flex items-center justify-between rounded-2xl border border-border/80 bg-background/60 px-4 py-2.5">
              <span className="text-[0.92rem] text-muted">{row.label}</span>
              <span className="font-semibold text-primary">{row.type === "percent" ? formatPercent(row.value) : formatCurrency(row.value)}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </>
  );
}
