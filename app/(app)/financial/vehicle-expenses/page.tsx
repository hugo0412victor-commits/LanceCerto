import Link from "next/link";
import { AlertTriangle, ArrowUpRight, Banknote, CalendarClock, CarFront, FileText, ImageIcon, Landmark, LineChart, ReceiptText, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { EmptyFinancialState } from "@/components/financial/empty-financial-state";
import { FinancialPageHeader } from "@/components/financial/financial-page-header";
import { VehicleExpenseForm } from "@/components/financial/financial-sections";
import { FinancialSummaryCard } from "@/components/financial/financial-summary-card";
import { VehicleExpensesTable } from "@/components/financial/vehicle-expenses-table";
import { PAYMENT_METHOD_OPTIONS, PAYMENT_STATUS_OPTIONS, VEHICLE_STATUS_LABELS } from "@/lib/constants";
import { getExpensesOverview } from "@/lib/data";
import { formatCurrency, formatPercent } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { ExpenseCategoryType, PaymentStatus } from "@prisma/client";

type PageProps = {
  searchParams?: {
    vehicleId?: string;
    categoryId?: string;
    paymentStatus?: string;
    supplierId?: string;
    from?: string;
    to?: string;
  };
};

const toNumber = (value?: number | string | null) => {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

function getVehicleName(vehicle: any) {
  return vehicle.displayName || vehicle.title || [vehicle.brand, vehicle.model, vehicle.version].filter(Boolean).join(" ") || "Veiculo sem nome";
}

function buildVehicleOptionLabel(vehicle: any) {
  return [
    getVehicleName(vehicle),
    vehicle.lotCode ? `Lote ${vehicle.lotCode}` : null,
    vehicle.plate ? `Placa ${vehicle.plate}` : null,
    vehicle.stockCode ? `Cod. ${vehicle.stockCode}` : null,
    vehicle.sourceProvider ? `Origem ${vehicle.sourceProvider}` : null,
    VEHICLE_STATUS_LABELS[vehicle.status as keyof typeof VEHICLE_STATUS_LABELS] ?? vehicle.status
  ].filter(Boolean).join(" - ");
}

function getActiveAuctionExpenses(expenses: any[]) {
  return expenses.filter((expense) => expense.paymentStatus !== PaymentStatus.CANCELLED && expense.category?.code === ExpenseCategoryType.ARREMATE);
}

function getDisplayExpenses(expenses: any[]) {
  let auctionAlreadyDisplayed = false;

  return expenses.filter((expense) => {
    if (expense.paymentStatus === PaymentStatus.CANCELLED) {
      return false;
    }

    if (expense.category?.code !== ExpenseCategoryType.ARREMATE || expense.paymentStatus === PaymentStatus.CANCELLED) {
      return true;
    }

    if (auctionAlreadyDisplayed) {
      return false;
    }

    auctionAlreadyDisplayed = true;
    return true;
  });
}

function VehicleSelector({ vehicles, selectedVehicleId }: { vehicles: any[]; selectedVehicleId?: string }) {
  return (
    <Card>
      <CardHeader title="Selecionar veiculo/lote" description="Escolha por nome, lote, placa, status, origem ou codigo interno." />
      <CardContent>
        <form action="/financial/vehicle-expenses" className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
          <Select name="vehicleId" defaultValue={selectedVehicleId ?? ""} required>
            <option value="">Selecione um veiculo ou lote</option>
            {vehicles.map((vehicle) => (
              <option key={vehicle.id} value={vehicle.id}>{buildVehicleOptionLabel(vehicle)}</option>
            ))}
          </Select>
          <Button type="submit" variant="primary">
            <CarFront className="h-4 w-4" />
            Visualizar despesas
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function VehicleExpenseFilters({ vehicleId, categories, suppliers, searchParams }: { vehicleId: string; categories: any[]; suppliers: any[]; searchParams: PageProps["searchParams"] }) {
  return (
    <Card>
      <CardHeader title="Filtros do veiculo" description="Filtre apenas as despesas deste veiculo/lote selecionado." />
      <CardContent>
        <form action="/financial/vehicle-expenses" className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <input type="hidden" name="vehicleId" value={vehicleId} />
          <Select name="categoryId" defaultValue={searchParams?.categoryId ?? ""} aria-label="Categoria">
            <option value="">Categoria</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </Select>
          <Select name="paymentStatus" defaultValue={searchParams?.paymentStatus ?? ""} aria-label="Status">
            <option value="">Status</option>
            {PAYMENT_STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </Select>
          <Select name="supplierId" defaultValue={searchParams?.supplierId ?? ""} aria-label="Fornecedor">
            <option value="">Fornecedor</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
            ))}
          </Select>
          <Input name="from" type="date" defaultValue={searchParams?.from ?? ""} aria-label="Periodo inicial" />
          <Input name="to" type="date" defaultValue={searchParams?.to ?? ""} aria-label="Periodo final" />
          <Button type="submit" variant="secondary">Aplicar filtros</Button>
        </form>
      </CardContent>
    </Card>
  );
}

function VehicleHeader({ vehicle }: { vehicle: any }) {
  const photo =
    vehicle.photos?.[0]?.publicUrl ||
    vehicle.photos?.[0]?.thumbnailUrl ||
    vehicle.photos?.[0]?.storagePath ||
    vehicle.mainPhotoUrl ||
    vehicle.lotSnapshots?.[0]?.photoUrls?.[0];

  return (
    <Card>
      <CardContent className="grid gap-5 p-5 md:grid-cols-[132px_minmax(0,1fr)_auto]">
        <div className="flex h-28 w-full items-center justify-center overflow-hidden rounded-2xl border border-border bg-background md:w-32">
          {photo ? (
            <div
              className="h-full w-full bg-cover bg-center"
              style={{ backgroundImage: `url(${photo})` }}
              role="img"
              aria-label={`Foto de ${getVehicleName(vehicle)}`}
            />
          ) : (
            <ImageIcon className="h-8 w-8 text-muted" />
          )}
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-2xl font-semibold tracking-normal text-primary">{getVehicleName(vehicle)}</h2>
            <Badge tone="info">{VEHICLE_STATUS_LABELS[vehicle.status as keyof typeof VEHICLE_STATUS_LABELS] ?? vehicle.status}</Badge>
          </div>
          <div className="mt-3 grid gap-2 text-sm text-muted md:grid-cols-2 xl:grid-cols-4">
            <span>Lote: <strong className="text-foreground">{vehicle.lotCode ?? "Pendente"}</strong></span>
            <span>Codigo: <strong className="text-foreground">{vehicle.stockCode ?? "Pendente"}</strong></span>
            <span>Placa: <strong className="text-foreground">{vehicle.plate ?? "Pendente"}</strong></span>
            <span>Origem: <strong className="text-foreground">{vehicle.sourceProvider ?? vehicle.auctionHouse?.name ?? "Manual"}</strong></span>
          </div>
        </div>
        <div className="flex flex-wrap items-start gap-2 md:justify-end">
          <Link href={`/vehicles/${vehicle.id}`} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-primary/18 bg-white px-4 py-2.5 text-sm font-semibold text-primary transition hover:border-primary/35 hover:bg-primary/5">
            <CarFront className="h-4 w-4" />
            Ver veiculo
          </Link>
          {vehicle.lotUrl ? (
            <a href={vehicle.lotUrl} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-transparent bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground shadow-glow transition hover:bg-[#C88914]">
              <ArrowUpRight className="h-4 w-4" />
              Abrir lote na Copart
            </a>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

export default async function VehicleExpensesPage({ searchParams }: PageProps) {
  const selectedVehicleId = searchParams?.vehicleId?.trim();
  const [vehicles, legacy] = await Promise.all([
    prisma.vehicle.findMany({
      select: {
        id: true,
        title: true,
        displayName: true,
        stockCode: true,
        lotCode: true,
        plate: true,
        brand: true,
        model: true,
        version: true,
        status: true,
        sourceProvider: true
      },
      orderBy: [{ updatedAt: "desc" }]
    }),
    getExpensesOverview()
  ]);

  const selectedVehicle = selectedVehicleId
    ? await prisma.vehicle.findUnique({
        where: { id: selectedVehicleId },
        include: {
          auctionHouse: true,
          financialSummary: true,
          lotSnapshots: {
            orderBy: {
              capturedAt: "desc"
            },
            take: 1
          },
          photos: {
            orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
            take: 1
          },
          expenses: {
            where: {
              categoryId: searchParams?.categoryId || undefined,
              supplierId: searchParams?.supplierId || undefined,
              paymentStatus: searchParams?.paymentStatus ? searchParams.paymentStatus as PaymentStatus : undefined,
              NOT: {
                paymentStatus: PaymentStatus.CANCELLED
              },
              date: {
                gte: searchParams?.from ? new Date(searchParams.from) : undefined,
                lte: searchParams?.to ? new Date(searchParams.to) : undefined
              }
            },
            include: {
              category: true,
              supplier: true
            },
            orderBy: [{ createdAt: "asc" }]
          },
        }
      })
    : null;

  const activeAuctionExpenses = selectedVehicle ? getActiveAuctionExpenses(selectedVehicle.expenses) : [];
  const displayExpenses = selectedVehicle ? getDisplayExpenses(selectedVehicle.expenses) : [];
  const totalPredicted = displayExpenses.reduce((total, expense) => total + toNumber(expense.predictedAmount ?? expense.actualAmount), 0);
  const totalActual = displayExpenses.reduce((total, expense) => total + toNumber(expense.actualAmount ?? expense.predictedAmount), 0);
  const paid = displayExpenses.filter((expense) => expense.paymentStatus === PaymentStatus.PAID).reduce((total, expense) => total + toNumber(expense.actualAmount ?? expense.predictedAmount), 0);
  const pending = displayExpenses.filter((expense) => expense.paymentStatus !== PaymentStatus.PAID && expense.paymentStatus !== PaymentStatus.CANCELLED).reduce((total, expense) => total + toNumber(expense.actualAmount ?? expense.predictedAmount), 0);
  const summary = selectedVehicle?.financialSummary;
  const tableExpenses = displayExpenses.map((expense) => ({
    id: expense.id,
    vehicleId: expense.vehicleId,
    categoryId: expense.categoryId,
    categoryCode: expense.category?.code ?? null,
    categoryName: expense.category?.name ?? "Sem categoria",
    supplierId: expense.supplierId,
    supplierName: expense.supplier?.name ?? null,
    description: expense.description,
    predictedAmount: Number(expense.predictedAmount ?? 0),
    actualAmount: Number(expense.actualAmount ?? 0),
    paymentStatus: expense.paymentStatus,
    paymentMethod: expense.paymentMethod,
    dueDate: expense.dueDate ? expense.dueDate.toISOString().slice(0, 10) : null,
    date: expense.date ? expense.date.toISOString().slice(0, 10) : null,
    proofPath: expense.proofPath,
    note: expense.note
  }));

  return (
    <div className="space-y-6">
      <FinancialPageHeader
        title="Despesas por Veiculo"
        description="Selecione um veiculo ou lote para visualizar e gerenciar suas despesas individuais."
      />

      <VehicleSelector vehicles={vehicles} selectedVehicleId={selectedVehicleId} />

      {!selectedVehicleId ? (
        <EmptyFinancialState
          title="Nenhum veiculo selecionado"
          description="Escolha um lote acima para carregar apenas as despesas, taxas, frete, documentacao, reparos e lancamentos financeiros vinculados a ele."
        />
      ) : null}

      {selectedVehicleId && !selectedVehicle ? (
        <EmptyFinancialState title="Veiculo nao encontrado" description="Confira o identificador informado e selecione outro veiculo/lote." />
      ) : null}

      {selectedVehicle ? (
        <>
          <VehicleHeader vehicle={selectedVehicle} />
          <VehicleExpenseFilters vehicleId={selectedVehicle.id} categories={legacy.categories} suppliers={legacy.suppliers} searchParams={searchParams} />

          <div className="grid auto-rows-fr gap-3 md:grid-cols-3 xl:grid-cols-5">
            <FinancialSummaryCard label="Valor de arremate" value={formatCurrency(Number(selectedVehicle.bidValue ?? 0))} icon={Landmark} />
            <FinancialSummaryCard label="Despesas previstas" value={formatCurrency(totalPredicted)} icon={ReceiptText} />
            <FinancialSummaryCard label="Despesas realizadas" value={formatCurrency(totalActual)} icon={Banknote} />
            <FinancialSummaryCard label="Despesas pagas" value={formatCurrency(paid)} icon={FileText} tone="good" />
            <FinancialSummaryCard label="Despesas pendentes" value={formatCurrency(pending)} icon={CalendarClock} tone="alert" />
            <FinancialSummaryCard label="Custo total" value={formatCurrency(Number(summary?.totalCost ?? selectedVehicle.totalActualCost ?? totalActual))} icon={CarFront} />
            <FinancialSummaryCard label="Venda prevista" value={formatCurrency(Number(summary?.expectedSalePrice ?? selectedVehicle.predictedSalePrice ?? 0))} icon={TrendingUp} />
            <FinancialSummaryCard label="Lucro estimado" value={formatCurrency(Number(summary?.netProfit ?? selectedVehicle.predictedProfit ?? 0))} icon={TrendingUp} tone="good" />
            <FinancialSummaryCard label="Margem estimada" value={formatPercent(Number(summary?.marginPercent ?? selectedVehicle.predictedMargin ?? 0))} icon={LineChart} />
            <FinancialSummaryCard label="ROI estimado" value={formatPercent(Number(summary?.roiPercent ?? selectedVehicle.predictedRoi ?? 0))} icon={LineChart} />
          </div>

          <div id="nova-despesa">
            <VehicleExpenseForm legacy={legacy} selectedVehicleId={selectedVehicle.id} />
          </div>

          <Card>
            <CardHeader title="Despesas individuais do veiculo" description="Somente despesas vinculadas ao vehicleId selecionado." />
            <CardContent>
              {displayExpenses.length > 0 ? (
                <VehicleExpensesTable
                  expenses={tableExpenses}
                  vehicleId={selectedVehicle.id}
                  categories={legacy.categories.map((category) => ({ id: category.id, name: category.name }))}
                  suppliers={legacy.suppliers.map((supplier) => ({ id: supplier.id, name: supplier.name }))}
                  paymentStatuses={PAYMENT_STATUS_OPTIONS}
                  paymentMethods={PAYMENT_METHOD_OPTIONS}
                />
              ) : (
                <EmptyFinancialState title="Este veiculo ainda nao possui despesas cadastradas." description="Use o formulario acima para adicionar a primeira despesa deste lote." />
              )}
            </CardContent>
          </Card>

          {activeAuctionExpenses.length > 1 ? (
            <Card className="border-amber-200 bg-amber-50">
              <CardContent className="flex gap-3 p-5 text-amber-900">
                <AlertTriangle className="mt-1 h-5 w-5 shrink-0" />
                <div>
                  <p className="font-semibold">Foram encontrados lancamentos duplicados de arremate para este veiculo.</p>
                  <p className="mt-1 text-sm leading-6">
                    A tela exibiu apenas um arremate consolidado e nao somou os duplicados no resumo. Os registros antigos foram preservados para revisao administrativa.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
