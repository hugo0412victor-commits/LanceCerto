import { saveMarketResearchAction } from "@/app/actions";
import { PageHeader } from "@/components/common/page-header";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getMarketOverview } from "@/lib/data";
import { formatCurrency } from "@/lib/format";

export default async function MarketResearchPage() {
  const { researches, vehicles, sources } = await getMarketOverview();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Precificacao"
        title="Pesquisa de mercado"
        description="Camada abstrata para FIPE, Webmotors, Mobiauto, OLX e entradas manuais assistidas."
      />

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader title="Nova pesquisa" description="Registre media de mercado e listagens manualmente quando a integracao automatica nao estiver disponivel." />
          <CardContent>
            <form action={saveMarketResearchAction} className="grid gap-4 md:grid-cols-2">
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
              <label className="space-y-2 text-sm">
                <span className="font-medium">Fonte</span>
                <Select name="source">
                  {sources.map((source) => (
                    <option key={source.id} value={source.code}>
                      {source.name}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="space-y-2 text-sm">
                <span className="font-medium">Link do anuncio</span>
                <Input name="listingUrl" />
              </label>
              {[
                ["price", "Preco"],
                ["year", "Ano"],
                ["version", "Versao"],
                ["mileage", "Quilometragem"],
                ["city", "Cidade"],
                ["state", "Estado"],
                ["fipeValue", "FIPE"],
                ["marketAverage", "Media de mercado"],
                ["lowestPrice", "Menor preco"],
                ["highestPrice", "Maior preco"],
                ["listingsCount", "Quantidade de anuncios"],
                ["suggestedCompetitivePrice", "Preco competitivo"],
                ["suggestedAggressivePrice", "Preco agressivo"],
                ["suggestedIdealPrice", "Preco ideal"],
                ["minimumAcceptablePrice", "Preco minimo aceitavel"]
              ].map(([name, label]) => (
                <label key={name} className="space-y-2 text-sm">
                  <span className="font-medium">{label}</span>
                  <Input name={name} />
                </label>
              ))}
              <label className="space-y-2 text-sm md:col-span-2">
                <span className="font-medium">Observacoes</span>
                <Textarea name="notes" />
              </label>
              <button type="submit" className="rounded-2xl bg-accent px-4 py-3 text-sm font-semibold text-white md:col-span-2">
                Salvar pesquisa
              </button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Historico de pesquisas" description="Comparativos salvos por veiculo, media e faixa de preco." />
          <CardContent className="space-y-3">
            {researches.map((research) => (
              <div key={research.id} className="rounded-3xl border border-border bg-white/75 p-4">
                <div className="grid gap-3 md:grid-cols-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-muted">Veiculo</p>
                    <p className="font-semibold">
                      {[research.vehicle.brand, research.vehicle.model].filter(Boolean).join(" ")}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-muted">Media</p>
                    <p className="font-semibold">{formatCurrency(Number(research.marketAverage ?? 0))}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-muted">Faixa</p>
                    <p className="font-semibold">
                      {formatCurrency(Number(research.lowestPrice ?? 0))} a {formatCurrency(Number(research.highestPrice ?? 0))}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-muted">Liquidez</p>
                    <p className="font-semibold">{research.liquidityLevel}</p>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
