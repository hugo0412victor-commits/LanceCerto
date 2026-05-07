export type AdvertisementDraft = {
  vehicleId: string;
  portal: "OLX" | "WEBMOTORS" | "MOBIAUTO" | "INSTAGRAM" | "FACEBOOK_MARKETPLACE" | "OTHER";
  title: string;
  description: string;
  price?: number;
  imageUrls?: string[];
};

export interface AdvertisementPublisher {
  readonly portal: AdvertisementDraft["portal"];
  publish(draft: AdvertisementDraft): Promise<{ status: "queued" | "published"; listingUrl?: string; notes?: string }>;
}

export class QueuedPublisher implements AdvertisementPublisher {
  constructor(public readonly portal: AdvertisementDraft["portal"]) {}

  async publish(): Promise<{ status: "queued"; notes: string }> {
    return {
      status: "queued",
      notes: "Integracao automatica ainda nao habilitada. Anuncio mantido em fila interna para publicacao assistida."
    };
  }
}
