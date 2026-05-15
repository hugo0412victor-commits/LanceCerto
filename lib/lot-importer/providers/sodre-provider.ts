import { LotImportError, type ImportedLotPhoto, type LotImportResult } from "@/lib/lot-importer/types";
import {
  computePendingFields,
  ensureImportedData,
  extractImageUrlsFromAttribute,
  fetchLotPage,
  fetchLotPageWithLocalBrowser,
  inferVehicleFromTitle,
  parseBooleanValue,
  parseCurrency,
  parseDateValue,
  parseHtmlSnapshot,
  parseIntegerFromText,
  validateLotUrl
} from "@/lib/lot-importer/utils";

type SodreUrlParts = {
  parsedUrl: URL;
  auctionId: string;
  lotId: string;
};

const SODRE_AUCTION_HOUSE_NAME = "Sodre Santoro";

function logSodre(event: string, meta?: Record<string, unknown>) {
  console.info("[lot-import:sodre]", {
    event,
    ...meta
  });
}

function normalizeWhitespace(value?: string | null) {
  return value?.replace(/\s+/g, " ").trim() || undefined;
}

function decodeHtml(value?: string | null) {
  if (!value) {
    return undefined;
  }

  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function stripTags(value: string) {
  return normalizeWhitespace(
    value
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
  );
}

function asAbsoluteUrl(value: string, baseUrl: string) {
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return value;
  }
}

function normalizeSodreUrl(url: string): SodreUrlParts {
  const parsedUrl = validateLotUrl(url);
  const hostname = parsedUrl.hostname.toLowerCase().replace(/^www\./, "");

  if (
    hostname !== "sodresantoro.com.br" &&
    hostname !== "leilao.sodresantoro.com.br" &&
    !hostname.endsWith(".sodresantoro.com.br")
  ) {
    throw new LotImportError("Este importador aceita apenas links da Sodre Santoro.", "UNSUPPORTED_PROVIDER", 400, {
      hostname: parsedUrl.hostname
    });
  }

  const match = parsedUrl.pathname.match(/\/leilao\/(\d+)\/lote\/(\d+)/i);

  if (!match) {
    throw new LotImportError("Nao conseguimos identificar o leilao e o lote nesse link da Sodre.", "LOT_NUMBER_NOT_FOUND", 400, {
      url: parsedUrl.toString()
    });
  }

  return {
    parsedUrl,
    auctionId: match[1],
    lotId: match[2]
  };
}

function expandTwoDigitYear(value?: string) {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }

  if (value.length === 4) {
    return parsed;
  }

  return parsed >= 80 ? 1900 + parsed : 2000 + parsed;
}

function titleFromPageTitle(title?: string) {
  return normalizeWhitespace(
    title
      ?.replace(/^Leil[aã]o\s+/i, "")
      .replace(/\s*-\s*Leil[aã]o de .+$/i, "")
      .replace(/\s*-\s*Sodr[eé] Santoro.*$/i, "")
  );
}

function extractLabeledText(text: string, label: string, maxLength = 180) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return normalizeWhitespace(text.match(new RegExp(`${escaped}\\s*:?\\s*([^\\n\\r]{1,${maxLength}})`, "i"))?.[1]);
}

function extractLabeledUntil(text: string, label: string, stopLabels: string[]) {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const escapedStops = stopLabels.map((stopLabel) => stopLabel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  return normalizeWhitespace(text.match(new RegExp(`${escapedLabel}\\s*:?\\s*([\\s\\S]*?)(?:${escapedStops}|$)`, "i"))?.[1]);
}

function extractBetween(text: string, startLabel: string, endLabels: string[]) {
  const escapedStart = startLabel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const escapedEnd = endLabels.map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  return normalizeWhitespace(text.match(new RegExp(`${escapedStart}\\s*([\\s\\S]*?)(?:${escapedEnd}|$)`, "i"))?.[1]);
}

function parseTitle(title?: string) {
  const normalized = normalizeWhitespace(title);
  const years = normalized?.match(/\b(\d{2,4})\s*\/\s*(\d{2,4})\b/);
  const cleanTitle = normalizeWhitespace(normalized?.replace(/\b\d{2,4}\s*\/\s*\d{2,4}\b/g, ""));
  const inferred = inferVehicleFromTitle(cleanTitle);

  return {
    title: cleanTitle ?? normalized,
    brand: inferred.brand,
    model: inferred.model,
    version: inferred.version,
    manufacturingYear: expandTwoDigitYear(years?.[1]) ?? inferred.manufacturingYear,
    modelYear: expandTwoDigitYear(years?.[2]) ?? inferred.modelYear
  };
}

function extractSodreImages(html: string, baseUrl: string, urlParts: SodreUrlParts): ImportedLotPhoto[] {
  const urls = new Set<string>();

  for (const attribute of ["src", "data-src", "data-original", "href"]) {
    for (const url of extractImageUrlsFromAttribute(html, attribute)) {
      urls.add(asAbsoluteUrl(url, baseUrl));
    }
  }

  for (const match of html.matchAll(/["']([^"']+\.(?:jpe?g|png|webp)(?:\?[^"']*)?)["']/gi)) {
    const candidate = decodeHtml(match[1]);
    if (candidate) {
      urls.add(asAbsoluteUrl(candidate, baseUrl));
    }
  }

  return [...urls]
    .filter((url) => {
      const normalized = url.toLowerCase();
      return (
        normalized.includes(`/veiculos/${urlParts.auctionId}/${urlParts.lotId}/`) &&
        /photos\.sodresantoro|sodresantoro/.test(normalized) &&
        !/logo|banner|icon|favicon|loading|placeholder/.test(normalized)
      );
    })
    .map((imageUrl, index) => ({
      imageUrl,
      thumbnailUrl: imageUrl,
      imageType: "sodre",
      sequenceNumber: index + 1,
      source: "sodre-santoro"
    }));
}

function extractAuctionDate(text: string) {
  const raw = text.match(/Data:\s*(\d{2}\/\d{2}\/\d{4})\s*-\s*(\d{2}:\d{2})h?/i);
  if (!raw) {
    return undefined;
  }

  return parseDateValue(`${raw[1]} ${raw[2]}`);
}

function extractCurrentBid(text: string) {
  return parseCurrency(text.match(/Lance atual:\s*[^R]{0,20}R\$\s*([\d.,]+)/i)?.[1]);
}

function extractDescription(text: string) {
  return extractBetween(text, "Descrição Detalhada", ["Observações", "Histórico", "Últimos lances"]);
}

function extractObservations(text: string) {
  return extractBetween(text, "Observações", ["Histórico", "Últimos lances", "Delivery", "Condições de Venda"]);
}

function extractCityState(yard?: string) {
  const normalized = normalizeWhitespace(yard);
  const explicit = normalized?.match(/\b([A-Za-zÀ-ÿ\s.-]{3,60})\/([A-Z]{2})\b/);
  if (explicit) {
    return {
      city: normalizeWhitespace(explicit[1]),
      state: explicit[2].toUpperCase()
    };
  }

  if (normalized && /guarulhos/i.test(normalized)) {
    return {
      city: "Guarulhos",
      state: "SP"
    };
  }

  return {
    city: undefined,
    state: undefined
  };
}

function extractVehicleDetail(description: string | undefined, label: string) {
  if (!description) {
    return undefined;
  }

  const vehicleDetailsStart = description.search(/\bPlaca\s*:/i);
  const detailsScope = vehicleDetailsStart >= 0 ? description.slice(vehicleDetailsStart) : description;

  return extractLabeledUntil(detailsScope, label, [
    "Placa",
    "Cor",
    "KM",
    "Combustível",
    "Chave de Ignição",
    "Origem",
    "Estado do Chassi",
    "Câmbio",
    "Ar Condicionado",
    "Direção Hidráulica/Elétrica",
    "Kit Gás",
    "Blindagem"
  ]);
}

export class SodreLotProvider {
  async import(url: string): Promise<LotImportResult> {
    const urlParts = normalizeSodreUrl(url);

    logSodre("lot_import_started");
    logSodre("sodre_url_received", {
      url: urlParts.parsedUrl.toString()
    });
    logSodre("sodre_ids_extracted", {
      auctionId: urlParts.auctionId,
      lotId: urlParts.lotId
    });

    let page;
    try {
      logSodre("sodre_fetch_started", {
        endpoint: urlParts.parsedUrl.toString()
      });
      page = await fetchLotPage(urlParts.parsedUrl.toString());
    } catch (error) {
      logSodre("network_or_fetch_failed", {
        code: error instanceof LotImportError ? error.code : "UNKNOWN_ERROR",
        message: error instanceof Error ? error.message : "unknown"
      });

      if (
        error instanceof LotImportError &&
        ["ACCESS_BLOCKED", "CONNECTION_FAILED", "IMPORT_FAILED"].includes(error.code)
      ) {
        logSodre("local_browser_fallback_started");
        page = await fetchLotPageWithLocalBrowser(urlParts.parsedUrl.toString());
        logSodre("local_browser_fallback_finished", {
          statusCode: page.context.statusCode
        });
      } else {
        throw error;
      }
    }

    logSodre("sodre_response_status", { status: page.context.statusCode });
    logSodre("sodre_content_type", { contentType: page.context.contentType });
    logSodre("sodre_body_length", { bodyLength: page.context.bodyLength ?? page.html.length });

    const snapshot = parseHtmlSnapshot(page.html, page.context.finalUrl);
    const text = stripTags(page.html) ?? snapshot.text;
    const pageTitle = titleFromPageTitle(snapshot.title);
    const titleData = parseTitle(pageTitle);
    const displayLotNumber =
      text.match(new RegExp(`Leil[aã]o\\s+${urlParts.auctionId}\\s+-\\s+(\\d{1,5})\\s+${titleData.brand ?? ""}`, "i"))?.[1] ??
      text.match(new RegExp(`Leil[aã]o:\\s*${urlParts.auctionId}\\s*-\\s*Lote:\\s*(\\d+)`, "i"))?.[1];
    const lotCode = `${urlParts.auctionId}-${displayLotNumber ?? urlParts.lotId}`;
    const auctionDate = extractAuctionDate(text);
    const description = extractDescription(text);
    const observations = extractObservations(text);
    const yard = extractLabeledText(text, "Local do lote", 140);
    const location = extractCityState(yard);
    const photos = extractSodreImages(page.html, page.context.finalUrl, urlParts);
    const currentBid = extractCurrentBid(text);
    const hasKeyText = extractVehicleDetail(description, "Chave de Ignição");
    const armoredText = extractVehicleDetail(description, "Blindagem");
    const sellerName = extractLabeledUntil(text, "Comitente", ["Data:", "Categorias:", "Local do leilão:"]);
    const saleStatus = text.match(/\b(VENDIDO|CONDICIONAL|SUSPENSO|ENCERRADO|SEM LICITANTES)\b/i)?.[1];

    const vehicleData = {
      lotUrl: page.context.finalUrl,
      lotCode,
      provider: "sodre-santoro",
      displayName: [titleData.title, titleData.manufacturingYear && titleData.modelYear ? `${titleData.manufacturingYear}/${titleData.modelYear}` : undefined]
        .filter(Boolean)
        .join(" - "),
      title: titleData.title ?? pageTitle,
      auctionHouseName: SODRE_AUCTION_HOUSE_NAME,
      brand: titleData.brand,
      model: titleData.model,
      version: titleData.version,
      manufacturingYear: titleData.manufacturingYear,
      modelYear: titleData.modelYear,
      armored: parseBooleanValue(armoredText),
      sellerName: sellerName && !/^-+$|^-->$/i.test(sellerName) ? sellerName : undefined,
      damageDescription: description?.match(/(Danos Estruturais[^-.]*|Danos[^-.]*)/i)?.[1],
      condition: description?.match(/(Danos Estruturais[^-.]*|Danos[^-.]*)/i)?.[1] ?? saleStatus,
      hasKey: parseBooleanValue(hasKeyText),
      category: extractLabeledUntil(text, "Categorias", ["Local do leilão:", "Local do lote:", "Código Interno:"]),
      fuel: extractVehicleDetail(description, "Combustível"),
      transmission: extractVehicleDetail(description, "Câmbio"),
      color: extractVehicleDetail(description, "Cor"),
      mileage: parseIntegerFromText(extractVehicleDetail(description, "KM")),
      chassisType: extractVehicleDetail(description, "Estado do Chassi"),
      plateOrFinal: extractVehicleDetail(description, "Placa"),
      yard,
      auctionYard: extractLabeledText(text, "Local do leilão", 80),
      vehicleYard: yard,
      city: location.city,
      state: location.state,
      auctionDate,
      auctionDateText: auctionDate ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(auctionDate) : undefined,
      saleDateTimestamp: auctionDate?.toISOString(),
      sold: /VENDIDO|ENCERRADO/i.test(saleStatus ?? "") ? true : undefined,
      saleStatus,
      currentBid,
      currency: currentBid ? "BRL" : undefined,
      mainImageUrl: photos[0]?.imageUrl,
      originalNotes: [description, observations].filter(Boolean).join("\n\n") || snapshot.description,
      originalPhotoUrls: photos.map((photo) => photo.imageUrl),
      photos
    };

    ensureImportedData(vehicleData, {
      ...page.context,
      title: snapshot.title,
      description: snapshot.description
    });

    const pendingFields = computePendingFields(vehicleData);

    logSodre("sodre_parse_success", {
      lotId: urlParts.lotId,
      lotNumber: displayLotNumber
    });
    logSodre("fields_extracted", {
      foundFields: Object.entries(vehicleData)
        .filter(([, value]) => value !== undefined && value !== null && value !== "")
        .map(([key]) => key),
      missingFields: pendingFields,
      photosCount: photos.length
    });
    logSodre("import_preview_ready", {
      lotNumber: displayLotNumber ?? lotCode,
      photosCount: photos.length,
      pendingFields
    });

    return {
      status: pendingFields.length <= 2 ? "SUCCESS" : "PARTIAL",
      provider: "sodre-santoro",
      vehicleData,
      rawJson: {
        requestedUrl: page.context.requestedUrl,
        finalUrl: page.context.finalUrl,
        statusCode: page.context.statusCode,
        sourceMethod: "sodre_html",
        auctionId: urlParts.auctionId,
        lotId: urlParts.lotId,
        displayLotNumber,
        internalCode: extractLabeledText(text, "Código Interno", 80),
        title: snapshot.title,
        description,
        observations,
        extractedFields: {
          auctionDateText: vehicleData.auctionDateText,
          currentBid,
          yard,
          saleStatus
        },
        metadata: snapshot.metadata,
        imageUrls: photos.map((photo) => photo.imageUrl),
        textSample: text.slice(0, 2500)
      },
      alerts:
        pendingFields.length <= 2
          ? ["Lote da Sodre Santoro importado e pronto para revisão."]
          : ["Lote da Sodre Santoro importado parcialmente. Confira os campos pendentes antes de salvar."],
      pendingFields,
      context: {
        ...page.context,
        title: snapshot.title,
        description: snapshot.description
      }
    };
  }
}
