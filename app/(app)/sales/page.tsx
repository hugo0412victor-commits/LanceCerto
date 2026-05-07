import { saveSaleAction } from "@/app/actions";
import { PageHeader } from "@/components/common/page-header";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PAYMENT_METHOD_OPTIONS } from "@/lib/constants";
import { getSalesOverview } from "@/lib/data";
import { formatCurrency, formatDate, formatPercent } from "@/lib/format";
import { buildDocumentMessage, buildFollowUpMessage, buildInterestedCustomerMessage, buildNegotiationMessage } from "@/lib/whatsapp";

export default async function SalesPage() {
  const { vehicles, sales, leads, ads } = await getSalesOverview();
  const templateVehicle = vehicles[0];
  const vehicleLabel = templateVehicle
    ? [templateVehicle.brand, templateVehicle.model, templateVehicle.version].filter(Boolean).join(" ")
    : "veiculo";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Comercial"
        title="Vendas e anuncios"
        description="Controle de negociacao, registro de venda, leads e estrutura futura para integracao com portais e WhatsApp."
      />

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader title="Registrar venda" description="Use para fechamento rapido de um veiculo diretamente pelo modulo comercial." />
          <CardContent>
            <form action={saveSaleAction} className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2 text-sm md:col-span-2">
                <span className="font-medium">Veiculo</span>
                <Select name="vehicleId" required>
                  {vehicles.map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.id}>
                      {vehicle.stockCode} • {[vehicle.brand, vehicle.model, vehicle.version].filter(Boolean).join(" ")}
                    </option>
                  ))}
                </Select>
              </label>
              {[
                ["soldAt", "Data da venda", "date"],
                ["listedPrice", "Valor anunciado", "text"],
                ["soldPrice", "Valor vendido", "text"],
                ["discountGranted", "Desconto concedido", "text"],
                ["buyerName", "Comprador", "text"],
                ["saleChannel", "Canal de venda", "text"],
                ["salesCommission", "Comissao de venda", "text"],
                ["taxes", "Impostos e taxas", "text"],
                ["transferDate", "Data de transferencia", "date"],
                ["transferStatus", "Status da transferencia", "text"]
              ].map(([name, label, type]) => (
                <label key={name} className="space-y-2 text-sm">
                  <span className="font-medium">{label}</span>
                  <Input name={name} type={type} />
                </label>
              ))}
              <label className="space-y-2 text-sm">
                <span className="font-medium">Forma de pagamento</span>
                <Select name="paymentMethod">
                  <option value="">Selecione</option>
                  {PAYMENT_METHOD_OPTIONS.map((method) => (
                    <option key={method} value={method}>
                      {method}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="space-y-2 text-sm md:col-span-2">
                <span className="font-medium">Observacoes</span>
                <Textarea name="notes" />
              </label>
              <button type="submit" className="rounded-2xl bg-accent px-4 py-3 text-sm font-semibold text-white md:col-span-2">
                Salvar venda
              </button>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Vendas registradas" description="Lucro liquido e ROI por fechamento." />
            <CardContent className="space-y-3">
              {sales.map((sale) => (
                <div key={sale.id} className="rounded-3xl border border-border bg-white/75 p-4">
                  <div className="grid gap-3 md:grid-cols-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-muted">Veiculo</p>
                      <p className="font-semibold">
                        {[sale.vehicle.brand, sale.vehicle.model].filter(Boolean).join(" ")}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-muted">Valor vendido</p>
                      <p className="font-semibold">{formatCurrency(Number(sale.soldPrice ?? 0))}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-muted">Margem liquida</p>
                      <p className="font-semibold">{formatPercent(Number(sale.netMargin ?? 0))}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-muted">Data</p>
                      <p className="font-semibold">{formatDate(sale.soldAt)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader title="Leads e anuncios" description="Base comercial pronta para futura integracao com portais e WhatsApp." />
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="rounded-3xl border border-border bg-white/75 p-4">
                <p className="text-sm font-semibold">Anuncios ativos</p>
                <p className="mt-3 text-3xl font-semibold">{ads.length}</p>
              </div>
              <div className="rounded-3xl border border-border bg-white/75 p-4">
                <p className="text-sm font-semibold">Leads registrados</p>
                <p className="mt-3 text-3xl font-semibold">{leads.length}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader title="WhatsApp assistido" description="Mensagens prontas para contato, follow-up, negociacao e envio de documentos." />
            <CardContent className="space-y-3 text-sm">
              <div className="rounded-2xl bg-white/75 p-4">{buildInterestedCustomerMessage({ vehicleLabel, price: Number(templateVehicle?.predictedSalePrice ?? 0) })}</div>
              <div className="rounded-2xl bg-white/75 p-4">{buildFollowUpMessage({ vehicleLabel })}</div>
              <div className="rounded-2xl bg-white/75 p-4">{buildNegotiationMessage({ vehicleLabel, targetPrice: Number(templateVehicle?.predictedSalePrice ?? 0) })}</div>
              <div className="rounded-2xl bg-white/75 p-4">{buildDocumentMessage({ vehicleLabel })}</div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
