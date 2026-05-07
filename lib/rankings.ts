export function buildAuctionHouseRanking(
  vehicles: Array<{
    auctionHouse?: { name?: string | null } | null;
    predictedMargin?: number;
    actualMargin?: number;
    documentationExpected?: number;
    pendingFields?: string[];
    predictedProfit?: number;
    actualProfit?: number;
  }>
) {
  const buckets = vehicles.reduce<Record<string, { name: string; count: number; predicted: number; actual: number; documentaryIssues: number; profitable: number }>>(
    (accumulator, vehicle) => {
      const name = vehicle.auctionHouse?.name ?? "Sem leiloeira";
      accumulator[name] ??= {
        name,
        count: 0,
        predicted: 0,
        actual: 0,
        documentaryIssues: 0,
        profitable: 0
      };
      accumulator[name].count += 1;
      accumulator[name].predicted += vehicle.predictedMargin ?? 0;
      accumulator[name].actual += vehicle.actualMargin ?? 0;
      accumulator[name].documentaryIssues += vehicle.pendingFields?.includes("documentType") ? 1 : 0;
      accumulator[name].profitable += (vehicle.actualProfit ?? vehicle.predictedProfit ?? 0) > 0 ? 1 : 0;
      return accumulator;
    },
    {}
  );

  return Object.values(buckets)
    .map((bucket) => ({
      name: bucket.name,
      vehicles: bucket.count,
      avgPredictedMargin: bucket.count ? bucket.predicted / bucket.count : 0,
      avgActualMargin: bucket.count ? bucket.actual / bucket.count : 0,
      documentaryIssues: bucket.documentaryIssues,
      goodDealsRate: bucket.count ? (bucket.profitable / bucket.count) * 100 : 0
    }))
    .sort((a, b) => b.goodDealsRate - a.goodDealsRate);
}

export function buildSupplierRanking(
  suppliers: Array<{
    name: string;
    averageCost?: number;
    averageLeadTime?: number;
    rating?: number;
    expenses?: Array<{ actualAmount?: number }>;
  }>
) {
  return suppliers
    .map((supplier) => ({
      name: supplier.name,
      averageCost: supplier.averageCost ?? 0,
      averageLeadTime: supplier.averageLeadTime ?? 0,
      rating: supplier.rating ?? 0,
      totalPaid: (supplier.expenses ?? []).reduce((total, expense) => total + (expense.actualAmount ?? 0), 0)
    }))
    .sort((a, b) => b.rating - a.rating || a.averageLeadTime - b.averageLeadTime);
}
