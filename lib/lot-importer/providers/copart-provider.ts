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
  fetchWithTimeout,
  inferVehicleFromTitle,
  parseBooleanValue,
  parseCurrency,
  parseDateValue,
  parseHtmlSnapshot,
  parseIntegerFromText
} from "@/lib/lot-importer/utils";
import { LotImportError } from "@/lib/lot-importer/types";

type CopartLotDetails = Record<string, unknown>;

const COPART_API_HEADERS = {
  "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  accept: "application/json,text/plain,*/*",
  "accept-language": "pt-BR,pt;q=0.9,en;q=0.8"
};

function asString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.replace(/[^\d.,-]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", "."));
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

function asText(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return asString(value);
}

function parseCopartBoolean(value: unknown) {
  const normalized = asString(value)?.toLowerCase();

  if (!normalized) {
    return undefined;
  }

  if (["y", "yes", "s", "sim", "true"].includes(normalized)) {
    return true;
  }

  if (["n", "no", "nao", "não", "false"].includes(normalized)) {
    return false;
  }

  return undefined;
}

function parseCopartYard(value?: string) {
  const match = value?.match(/^(.*?)\s*-\s*([A-Z]{2})$/i);

  return {
    city: match?.[1]?.trim(),
    state: match?.[2]?.toUpperCase()
  };
}

function parseCopartAuctionDate(value: unknown) {
  const timestamp = asNumber(value);

  if (!timestamp) {
    return undefined;
  }

  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function buildCopartPhotoUrls(details: CopartLotDetails) {
  const thumbnail = asString(details.tims);

  if (!thumbnail) {
    return [];
  }

  return [thumbnail, thumbnail.replace(/imageType=thumbnail/i, "imageType=fullscreen")].filter((item, index, array) => array.indexOf(item) === index);
}

async function fetchCopartLotDetails(url: string) {
  const parsed = new URL(url);
  const lotCode = parsed.pathname.match(/\/lot\/([a-z0-9-]+)/i)?.[1];

  if (!lotCode) {
    throw new LotImportError("Nao foi possivel identificar o numero do lote na URL da Copart.", "INVALID_URL", 400, {
      url
    });
  }

  const apiUrl = new URL(`/public/data/lotdetails/solr/${lotCode}`, `${parsed.protocol}//${parsed.hostname}`);
  const response = await fetchWithTimeout(apiUrl, {
    headers: COPART_API_HEADERS,
    cache: "no-store"
  });

  if (!response.ok) {
    throw new LotImportError("A API da Copart respondeu com erro para este lote.", "IMPORT_FAILED", 502, {
      url: parsed.toString(),
      apiUrl: apiUrl.toString(),
      statusCode: response.status
    });
  }

  const payload = (await response.json()) as {
    returnCode?: number;
    returnCodeDesc?: string;
    data?: {
      lotDetails?: CopartLotDetails;
    };
  };
  const details = payload.data?.lotDetails;

  if (payload.returnCode !== 1 || !details) {
    throw new LotImportError("A Copart nao retornou dados estruturados para este lote.", "DATA_NOT_FOUND", 422, {
      url: parsed.toString(),
      apiUrl: apiUrl.toString(),
      returnCode: payload.returnCode,
      returnCodeDesc: payload.returnCodeDesc
    });
  }

  return {
    apiUrl: apiUrl.toString(),
    lotCode,
    details
  };
}

function buildVehicleDataFromCopartApi(url: string, lotCode: string, details: CopartLotDetails) {
  const yard = asString(details.yn) ?? asString(details.pyn);
  const yardLocation = parseCopartYard(yard);
  const runningConditionText = asString(details.drvr);
  const manufacturingYear = Math.trunc(asNumber(details.my) ?? 0) || undefined;
  const modelYear = Math.trunc(asNumber(details.lcy) ?? 0) || undefined;

  return {
    lotUrl: url,
    lotCode: asText(details.ln) ?? lotCode,
    auctionHouseName: "Copart Brasil",
    brand: asString(details.mkn),
    model: asString(details.lm),
    version: asString(details.version),
    manufacturingYear,
    modelYear,
    fipeValue: asNumber(details.la),
    documentType: asString(details.stt),
    mountType: asString(details.dtd),
    condition: asString(details.lt) ?? asString(details.damageDesc),
    hasKey: parseCopartBoolean(details.hk),
    runningCondition: runningConditionText ? !/(nao|não|desconhecido|inoperante|nao funciona|não funciona)/i.test(runningConditionText) : undefined,
    runningConditionText,
    fuel: asString(details.ft),
    mileage: asNumber(details.orr),
    chassis: asString(details.fv),
    yard,
    city: yardLocation.city,
    state: yardLocation.state,
    auctionDate: parseCopartAuctionDate(details.ad),
    auctionDateText: asString(details.auctionDateStr),
    originalNotes: asString(details.cmmnts),
    originalPhotoUrls: buildCopartPhotoUrls(details)
  };
}

export class CopartLotProvider {
  async import(url: string): Promise<LotImportResult> {
    let sourceMethod = "direct_fetch";
    let browserEngine: string | undefined;
    let browserFallbackUsed = false;
    let context;
    let html;

    try {
      const apiResult = await fetchCopartLotDetails(url);
      const vehicleData = buildVehicleDataFromCopartApi(url, apiResult.lotCode, apiResult.details);
      ensureImportedData(vehicleData, {
        requestedUrl: url,
        finalUrl: url,
        hostname: new URL(url).hostname,
        statusCode: 200
      });

      const pendingFields = computePendingFields(vehicleData);

      return {
        status: pendingFields.length <= 2 ? "SUCCESS" : "PARTIAL",
        provider: "copart",
        vehicleData,
        rawJson: {
          requestedUrl: url,
          finalUrl: url,
          statusCode: 200,
          sourceMethod: "copart_lotdetails_api",
          apiUrl: apiResult.apiUrl,
          lotDetails: apiResult.details
        },
        alerts:
          pendingFields.length <= 2
            ? ["Lote da Copart importado pela API estruturada e salvo internamente com os dados principais."]
            : ["Lote da Copart importado parcialmente pela API estruturada.", "Confira os campos pendentes antes de aprovar o lote."],
        pendingFields,
        context: {
          requestedUrl: url,
          finalUrl: url,
          hostname: new URL(url).hostname,
          statusCode: 200
        }
      };
    } catch (apiError) {
      if (apiError instanceof LotImportError && apiError.code === "INVALID_URL") {
        throw apiError;
      }

      console.warn("[lot-import:copart] structured_api_failed", {
        code: apiError instanceof LotImportError ? apiError.code : "UNKNOWN",
        message: apiError instanceof Error ? apiError.message : "unknown",
        details: apiError instanceof LotImportError ? apiError.details : undefined
      });
    }

    try {
      const result = await fetchLotPage(url);
      context = result.context;
      html = result.html;
    } catch (error) {
      if (error instanceof LotImportError && error.code === "ACCESS_BLOCKED") {
        console.warn("[lot-import:copart] direct_fetch_blocked_using_fallback", {
          message: error.message,
          details: error.details
        });
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
