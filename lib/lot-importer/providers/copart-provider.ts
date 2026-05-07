import type { LotImportResult } from "@/lib/lot-importer/types";
import {
  computePendingFields,
  ensureImportedData,
  extractDataUnameValue,
  extractDetailValueByLabel,
  extractDetailValueByLabels,
  extractImageUrlsFromAttribute,
  extractLabeledValue,
  fetchLotPage,
  fetchLotPageWithLocalBrowser,
  inferVehicleFromTitle,
  parseBooleanValue,
  parseCurrency,
  parseDateValue,
  parseHtmlSnapshot,
  parseIntegerFromText
} from "@/lib/lot-importer/utils";
import { LotImportError } from "@/lib/lot-importer/types";

export class CopartLotProvider {
  async import(url: string): Promise<LotImportResult> {
    let sourceMethod = "direct_fetch";
    let browserEngine: string | undefined;
    let browserFallbackUsed = false;
    let context;
    let html;

    try {
      const result = await fetchLotPage(url);
      context = result.context;
      html = result.html;
    } catch (error) {
      if (error instanceof LotImportError && error.code === "ACCESS_BLOCKED") {
        const result = await fetchLotPageWithLocalBrowser(url);
        context = result.context;
        html = result.html;
        browserEngine = result.context.description;
        sourceMethod = browserEngine ? `${browserEngine}_headless` : "local_browser_headless";
        browserFallbackUsed = true;
      } else {
        throw error;
      }
    }

    const snapshot = parseHtmlSnapshot(html, context.finalUrl);
    const inferredVehicle = inferVehicleFromTitle(snapshot.title);
    const lotCodeFromUrl = new URL(context.finalUrl).pathname.match(/\/lot\/([a-z0-9-]+)/i)?.[1];
    const eventSchema = snapshot.jsonLd.find((item) => item["@type"] === "Event");
    const location = (eventSchema?.location as Record<string, unknown> | undefined)?.address as Record<string, unknown> | undefined;
    const runningConditionText =
      extractDetailValueByLabels(html, ["Condição de Func.", "Condicao de Func.", "CondiÃ§Ã£o de Func.", "Condição de funcionamento", "Run and Drive"]) ??
      extractLabeledValue(html, ["Condição de Func.", "Condicao de Func.", "CondiÃ§Ã£o de Func.", "Run and Drive"]);
    const yardName =
      extractDetailValueByLabels(html, ["Pátio Veículo", "Patio Veiculo", "PÃ¡tio VeÃ­culo", "Patio", "Yard"]) ??
      extractDataUnameValue(html, "lotdetailSaleinformationlocationvalue");
    const lotCode =
      extractDetailValueByLabels(html, ["Lote/Vaga", "Lote", "Vaga"]) ??
      extractLabeledValue(html, ["Lote/Vaga", "Lote", "Vaga"]) ??
      lotCodeFromUrl;
    const chassisType =
      extractDetailValueByLabels(html, ["Tipo de Chassi", "Chassi", "VIN Type"]) ??
      extractLabeledValue(html, ["Tipo de Chassi", "VIN Type"]);
    const fipeValueText =
      extractDetailValueByLabels(html, ["Valor da fipe", "Valor FIPE", "FIPE"]) ??
      extractDataUnameValue(html, "lotdetailEstimatedretailvalue") ??
      extractLabeledValue(html, ["FIPE", "Valor FIPE"]);
    const auctionDateText =
      extractDetailValueByLabels(html, ["Data da Venda", "Data do Leilao", "Sale Date"]) ??
      extractDataUnameValue(html, "lotdetailSaleinformationsaledatevalue") ??
      extractLabeledValue(html, ["Data da Venda", "Data do Leilao", "Sale Date"]);
    const lotPhotoUrls = [
      ...extractImageUrlsFromAttribute(html, "hd-url"),
      ...extractImageUrlsFromAttribute(html, "full-url"),
      ...extractImageUrlsFromAttribute(html, "ng-src"),
      ...snapshot.imageUrls
    ].filter((item, index, array) => {
      if (/\/logo\.(svg|png)$/i.test(item) || /no_photo\.jpg/i.test(item)) {
        return false;
      }

      return array.indexOf(item) === index;
    });

    const vehicleData = {
      lotUrl: context.finalUrl,
      lotCode,
      auctionHouseName: "Copart Brasil",
      brand: extractDataUnameValue(html, "lotdetailMakevalue") ?? extractLabeledValue(html, ["Marca", "Make"]) ?? inferredVehicle.brand,
      model: extractDataUnameValue(html, "lotdetailModelvalue") ?? extractLabeledValue(html, ["Modelo", "Model"]) ?? inferredVehicle.model,
      version:
        extractDataUnameValue(html, "lotdetailVersionvalue") ??
        extractLabeledValue(html, ["Versao", "Descricao", "Description"]) ??
        inferredVehicle.version ??
        snapshot.title,
      manufacturingYear:
        parseIntegerFromText(extractDataUnameValue(html, "manufactureYearvalue")) ??
        parseIntegerFromText(extractLabeledValue(html, ["Ano de Fabricacao", "Ano Fabricacao", "Manufacturing Year"])) ??
        inferredVehicle.manufacturingYear,
      modelYear:
        parseIntegerFromText(extractDataUnameValue(html, "lotYearModelvalue")) ??
        parseIntegerFromText(extractLabeledValue(html, ["Ano do Modelo", "Ano Modelo", "Model Year"])) ??
        inferredVehicle.modelYear,
      fipeValue: parseCurrency(fipeValueText),
      documentType: extractDataUnameValue(html, "lotdetailTitledescriptionvalue") ?? extractLabeledValue(html, ["Documento", "Documentacao"]),
      mountType: extractDataUnameValue(html, "lotdetaildamageCategoryvalue") ?? extractLabeledValue(html, ["Tipo de Monta", "Monta"]),
      condition: extractDataUnameValue(html, "lossDescriptionvalue") ?? extractLabeledValue(html, ["Condicao", "Primary Damage"]) ?? snapshot.description,
      hasKey: parseBooleanValue(extractDataUnameValue(html, "lotdetailKeyvalue") ?? extractLabeledValue(html, ["Chave", "Keys"])),
      runningCondition:
        runningConditionText ? !/(nao|não|nÃ£o|inoperante|não funciona)/i.test(runningConditionText) : parseBooleanValue(extractLabeledValue(html, ["Funciona", "Starts", "Run and Drive"])),
      runningConditionText,
      fuel: extractDataUnameValue(html, "lotdetailFuelvalue") ?? extractDetailValueByLabel(html, "CombustÃ­vel") ?? extractLabeledValue(html, ["Combustivel", "Fuel"]),
      transmission: extractLabeledValue(html, ["Cambio", "Transmission"]),
      color: extractDataUnameValue(html, "lotdetailColorvalue"),
      mileage: parseIntegerFromText(extractDataUnameValue(html, "lotdetailOdometervalue")),
      chassis: extractDataUnameValue(html, "lotdetailVinvalue") ?? extractLabeledValue(html, ["Chassi", "VIN"]),
      chassisType,
      plateOrFinal: extractDataUnameValue(html, "DriverValue") ?? extractDetailValueByLabel(html, "Final de Placa") ?? extractLabeledValue(html, ["Placa", "Final da placa"]),
      yard: yardName ?? extractLabeledValue(html, ["Patio", "Yard"]),
      city: typeof location?.addressLocality === "string" ? location.addressLocality : extractLabeledValue(html, ["Cidade", "City"]),
      state: typeof location?.addressRegion === "string" ? location.addressRegion : extractLabeledValue(html, ["Estado", "UF", "State"]),
      auctionDate:
        parseDateValue(auctionDateText) ??
        parseDateValue(typeof eventSchema?.startDate === "string" ? eventSchema.startDate : undefined) ??
        parseDateValue(extractLabeledValue(html, ["Data do Leilao", "Sale Date"])),
      auctionDateText,
      originalNotes:
        extractDetailValueByLabel(html, "Complemento") ??
        extractDataUnameValue(html, "lotdetailNotesvalue") ??
        extractLabeledValue(html, ["Observacoes", "Notes"]) ??
        snapshot.description,
      originalPhotoUrls: lotPhotoUrls
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
      provider: "copart",
      vehicleData,
      rawJson: {
        requestedUrl: context.requestedUrl,
        finalUrl: context.finalUrl,
        statusCode: context.statusCode,
        sourceMethod,
        browserEngine,
        title: snapshot.title,
        extractedFields: {
          lotCode,
          runningConditionText,
          fipeValueText,
          chassisType,
          yardName,
          auctionDateText
        },
        metadata: snapshot.metadata,
        imageUrls: snapshot.imageUrls,
        jsonLdCount: snapshot.jsonLd.length
      },
      alerts:
        status === "SUCCESS"
          ? [
              "Lote da Copart importado e salvo internamente com os dados principais.",
              ...(browserFallbackUsed ? ["Importacao concluida usando o navegador local para contornar o bloqueio anti-bot."] : [])
            ]
          : [
              "Parser server-side da Copart executado com sucesso parcial.",
              ...(browserFallbackUsed ? ["A captura do lote foi feita usando o navegador local porque a requisicao direta foi bloqueada."] : []),
              "Confira os campos pendentes antes de aprovar o lote."
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
