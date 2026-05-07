export type MarketProviderQuery = {
  brand?: string;
  model?: string;
  version?: string;
  year?: number;
  city?: string;
  state?: string;
};

export type MarketProviderListing = {
  source: string;
  url?: string;
  price?: number;
  year?: number;
  version?: string;
  mileage?: number;
  city?: string;
  state?: string;
  sellerType?: string;
  notes?: string;
};

export type MarketProviderSummary = {
  lowestPrice: number;
  averagePrice: number;
  highestPrice: number;
  listingCount: number;
  listings: MarketProviderListing[];
  mode: "automatic" | "manual-assisted";
  alerts: string[];
};

export interface MarketPriceProvider {
  readonly source: string;
  search(query: MarketProviderQuery): Promise<MarketProviderSummary>;
}

export class ManualMarketPriceProvider implements MarketPriceProvider {
  readonly source = "manual-assisted";

  async search(query: MarketProviderQuery): Promise<MarketProviderSummary> {
    return {
      lowestPrice: 0,
      averagePrice: 0,
      highestPrice: 0,
      listingCount: 0,
      listings: [],
      mode: "manual-assisted",
      alerts: [
        `Busca automatica indisponivel para ${query.brand ?? "veiculo"}.`,
        "Use o modo manual assistido para registrar anuncios e referencias de mercado."
      ]
    };
  }
}
