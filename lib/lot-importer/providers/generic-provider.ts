import type { LotImportResult } from "@/lib/lot-importer/types";
import {
  computePendingFields,
  ensureImportedData,
  fetchLotPage,
  inferVehicleFromTitle,
  parseCurrency,
  parseDateValue,
  parseHtmlSnapshot,
  parseIntegerFromText
} from "@/lib/lot-importer/utils";

export class GenericLotProvider {
  async import(url: string): Promise<LotImportResult> {
    const { context, html } = await fetchLotPage(url);
    const snapshot = parseHtmlSnapshot(html, context.finalUrl);
    const inferredVehicle = inferVehicleFromTitle(snapshot.title);
    const providerName =
      snapshot.metadata["og:site_name"] ??
      snapshot.metadata["application-name"] ??
      context.hostname.replace(/^www\./i, "");

    const lotCode =
      new URL(context.finalUrl).pathname.match(/(?:lot|lote|item|veiculo|vehicle)[/-]([a-z0-9-]+)/i)?.[1] ??
      snapshot.metadata["og:url"]?.match(/(?:lot|lote|item)[/-]([a-z0-9-]+)/i)?.[1];

    const vehicleData = {
      lotUrl: context.finalUrl,
      lotCode,
      auctionHouseName: providerName,
      brand: inferredVehicle.brand,
      model: inferredVehicle.model,
      version: inferredVehicle.version ?? snapshot.title,
      manufacturingYear: inferredVehicle.manufacturingYear,
      modelYear: inferredVehicle.modelYear,
      fipeValue: parseCurrency(snapshot.text.match(/FIPE[\s\S]{0,40}?R\$ ?([\d.\,]+)/i)?.[1]),
      documentType: snapshot.text.match(/(?:documento|documentacao)[\s\S]{0,30}?([A-Z0-9\s/-]{3,40})/i)?.[1]?.trim(),
      condition: snapshot.metadata.condition ?? snapshot.description,
      fuel: snapshot.text.match(/(?:combustivel|fuel)[\s\S]{0,30}?([A-Za-z\s/-]{3,30})/i)?.[1]?.trim(),
      transmission: snapshot.text.match(/(?:cambio|transmissao|transmission)[\s\S]{0,30}?([A-Za-z\s/-]{3,30})/i)?.[1]?.trim(),
      color: snapshot.text.match(/(?:cor|color)[\s\S]{0,20}?([A-Za-z\s/-]{3,20})/i)?.[1]?.trim(),
      mileage: parseIntegerFromText(snapshot.text.match(/(?:quilometragem|km)[\s\S]{0,20}?([\d.\,]+)/i)?.[1]),
      chassis: snapshot.text.match(/(?:chassi|vin)[\s\S]{0,20}?([A-HJ-NPR-Z0-9*]{6,20})/i)?.[1]?.trim(),
      plateOrFinal: snapshot.text.match(/(?:placa|final da placa)[\s\S]{0,20}?([A-Z0-9-]{4,8})/i)?.[1]?.trim(),
      yard: snapshot.text.match(/(?:patio|yard)[\s\S]{0,40}?([A-Za-z0-9\s/-]{3,60})/i)?.[1]?.trim(),
      city: snapshot.text.match(/(?:cidade|city)[\s\S]{0,20}?([A-Za-z\s-]{3,40})/i)?.[1]?.trim(),
      state: snapshot.text.match(/(?:estado|uf)[\s\S]{0,20}?([A-Z]{2})/i)?.[1]?.trim(),
      auctionDate: parseDateValue(snapshot.text.match(/(?:data do leilao|leilao em|auction date)[\s\S]{0,20}?(\d{2}\/\d{2}\/\d{4}|\d{4}-\d{2}-\d{2})/i)?.[1]),
      originalNotes: snapshot.description,
      originalPhotoUrls: snapshot.imageUrls
    };

    ensureImportedData(vehicleData, {
      ...context,
      title: snapshot.title,
      description: snapshot.description
    });

    const pendingFields = computePendingFields(vehicleData);
    const status = pendingFields.length <= 2 ? "SUCCESS" : "PARTIAL";

    return {
      status,
      provider: providerName,
      vehicleData,
      rawJson: {
        requestedUrl: context.requestedUrl,
        finalUrl: context.finalUrl,
        statusCode: context.statusCode,
        title: snapshot.title,
        metadata: snapshot.metadata,
        imageUrls: snapshot.imageUrls,
        jsonLdCount: snapshot.jsonLd.length
      },
      alerts:
        status === "SUCCESS"
          ? ["Dados principais capturados pela rota server-side e congelados no snapshot interno."]
          : [
              "Importacao parcial concluida pela rota server-side.",
              "Revise os campos pendentes antes de seguir com a analise do lote."
            ],
      pendingFields,
      context: {
        ...context,
        title: snapshot.title,
        description: snapshot.description
      }
    };
  }
}
