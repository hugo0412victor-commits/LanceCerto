import { LotImportError, type ImportedLotPhoto, type LotImportResult, type PartialVehicleImport } from "@/lib/lot-importer/types";
import { computePendingFields, ensureImportedData, fetchWithTimeout, parseCurrency, validateLotUrl } from "@/lib/lot-importer/utils";

type SodreUrlParts = {
  parsedUrl: URL;
  auctionId: string;
  lotId: string;
};

type SodreHtmlFetchResult = {
  html: string;
  statusCode: number;
  contentType?: string;
  finalUrl: string;
};

type SodreHtmlMeta = {
  title?: string;
  description?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogUrl?: string;
  ogImage?: string;
  canonical?: string;
};

type SodreExtractedData = PartialVehicleImport & {
  title?: string;
  externalId?: string;
  htmlMeta: SodreHtmlMeta;
};

const SODRE_AUCTION_HOUSE_NAME = "Sodre Santoro";
const SODRE_REFERER = "https://leilao.sodresantoro.com.br/";

function logSodre(event: string, meta?: Record<string, unknown>) {
  console.log("[lot-import:sodre]", {
    event,
    ...meta
  });
}

function decodeHtml(value?: string | null) {
  if (!value) return undefined;

  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&aacute;/gi, "a")
    .replace(/&agrave;/gi, "a")
    .replace(/&atilde;/gi, "a")
    .replace(/&acirc;/gi, "a")
    .replace(/&eacute;/gi, "e")
    .replace(/&ecirc;/gi, "e")
    .replace(/&iacute;/gi, "i")
    .replace(/&oacute;/gi, "o")
    .replace(/&otilde;/gi, "o")
    .replace(/&ocirc;/gi, "o")
    .replace(/&uacute;/gi, "u")
    .replace(/&ccedil;/gi, "c")
    .replace(/&Aacute;/g, "A")
    .replace(/&Eacute;/g, "E")
    .replace(/&Iacute;/g, "I")
    .replace(/&Oacute;/g, "O")
    .replace(/&Uacute;/g, "U")
    .replace(/&Ccedil;/g, "C")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(Number.parseInt(code, 16)));
}

function cleanText(value?: string | null) {
  return decodeHtml(value)
    ?.replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeUrl(value?: string, baseUrl = SODRE_REFERER) {
  if (!value) return undefined;
  const decoded = decodeHtml(value)?.trim();
  if (!decoded) return undefined;
  if (decoded.startsWith("//")) return `https:${decoded}`;

  try {
    return new URL(decoded, baseUrl).toString();
  } catch {
    return decoded;
  }
}

function sodreHeaders() {
  return {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.8,*/*;q=0.7",
    "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
    Referer: SODRE_REFERER
  };
}

function normalizeSodreUrl(originalUrl: string): SodreUrlParts {
  const parsedUrl = validateLotUrl(originalUrl);
  const hostname = parsedUrl.hostname.toLowerCase().replace(/^www\./, "");

  if (hostname !== "sodresantoro.com.br" && hostname !== "leilao.sodresantoro.com.br" && !hostname.endsWith(".sodresantoro.com.br")) {
    throw new LotImportError("Este importador aceita apenas links da Sodre Santoro.", "UNSUPPORTED_PROVIDER", 400, {
      hostname: parsedUrl.hostname
    });
  }

  const match = parsedUrl.pathname.match(/\/leilao\/(\d+)\/lote\/(\d+)/i);
  if (!match) {
    throw new LotImportError("URL da Sodre Santoro invalida. Nao foi possivel identificar leilao ou lote.", "LOT_NUMBER_NOT_FOUND", 400, {
      url: parsedUrl.toString()
    });
  }

  return {
    parsedUrl,
    auctionId: match[1],
    lotId: match[2]
  };
}

async function fetchSodreHtml(url: string): Promise<SodreHtmlFetchResult> {
  logSodre("html_fetch_started", { url });

  const response = await fetchWithTimeout(url, {
    headers: sodreHeaders(),
    redirect: "follow",
    cache: "no-store"
  });
  const html = await response.text();
  const contentType = response.headers.get("content-type") ?? undefined;

  logSodre("html_response", {
    status: response.status,
    contentType
  });
  logSodre("html_body_length", {
    bodyLength: html.length
  });
  logSodre("html_body_preview", {
    bodyPreview: html.slice(0, 1000)
  });

  if (!response.ok) {
    throw new LotImportError("A pagina da Sodre Santoro respondeu com erro.", "IMPORT_FAILED", 502, {
      status: response.status,
      contentType
    });
  }

  return {
    html,
    statusCode: response.status,
    contentType,
    finalUrl: response.url || url
  };
}

function attrValue(tag: string, attr: string) {
  return tag.match(new RegExp(`${attr}\\s*=\\s*["']([^"']+)["']`, "i"))?.[1];
}

function findMetaContent(html: string, attrName: "property" | "name", attrValueToFind: string) {
  const tags = html.match(/<meta\b[^>]*>/gi) ?? [];
  const tag = tags.find((candidate) => attrValue(candidate, attrName)?.toLowerCase() === attrValueToFind.toLowerCase());
  return cleanText(attrValue(tag ?? "", "content"));
}

function extractCanonical(html: string) {
  const tags = html.match(/<link\b[^>]*>/gi) ?? [];
  const tag = tags.find((candidate) => attrValue(candidate, "rel")?.toLowerCase() === "canonical");
  return normalizeUrl(attrValue(tag ?? "", "href"));
}

function extractHtmlMeta(html: string): SodreHtmlMeta {
  const title = cleanText(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]);
  const description = findMetaContent(html, "name", "description");
  const ogTitle = findMetaContent(html, "property", "og:title");
  const ogDescription = findMetaContent(html, "property", "og:description");
  const ogUrl = normalizeUrl(findMetaContent(html, "property", "og:url"));
  const ogImage = normalizeUrl(findMetaContent(html, "property", "og:image"));
  const canonical = extractCanonical(html);

  const meta = {
    title,
    description,
    ogTitle,
    ogDescription,
    ogUrl,
    ogImage,
    canonical
  };

  logSodre("meta_extracted", meta);
  return meta;
}

function stripSodreTitle(value?: string) {
  return cleanText(value)
    ?.replace(/\s*-\s*Sodr[eé]&?[^-]*Leil(?:o|õ|&otilde;)es.*$/i, "")
    .replace(/\s*-\s*Sodr\S+\s+Santoro.*$/i, "")
    .replace(/^Leil\S*\s+/i, "")
    .replace(/\s*-\s*Leil\S*o de .+$/i, "")
    .trim();
}

function expandYear(value?: string) {
  if (!value) return undefined;
  const number = Number(value);
  if (!Number.isFinite(number)) return undefined;
  if (value.length === 4) return number;
  return number >= 80 ? 1900 + number : 2000 + number;
}

function parseSodreTitle(title?: string) {
  const normalized = stripSodreTitle(title);
  const yearPair = normalized?.match(/\b(\d{2,4})\s*\/\s*(\d{2,4})\b/);
  const singleYear = normalized && !yearPair ? normalized.match(/\b(19|20)\d{2}\b/)?.[0] : undefined;
  const namePart = cleanText(normalized?.replace(/\b\d{2,4}\s*\/\s*\d{2,4}\b/g, "").replace(/\b(19|20)\d{2}\b/g, ""));
  const tokens = namePart?.split(/\s+/).filter(Boolean) ?? [];
  const manufacturingYear = expandYear(yearPair?.[1] ?? singleYear);
  const modelYear = expandYear(yearPair?.[2] ?? singleYear);
  const displayName = [namePart, manufacturingYear && modelYear ? `${manufacturingYear}/${modelYear}` : undefined].filter(Boolean).join(" ");
  const parsed = {
    sourceTitle: normalized,
    title: displayName || normalized,
    displayName: displayName || normalized,
    brand: tokens[0],
    model: tokens[1],
    version: tokens.slice(2).join(" ") || undefined,
    manufacturingYear,
    modelYear
  };

  logSodre("title_parsed", parsed);
  return parsed;
}

function parseSodreDate(html: string, meta: SodreHtmlMeta) {
  const source = [meta.ogDescription, meta.description, cleanText(html)].filter(Boolean).join(" ");
  const fullDate = source.match(/\b(\d{2})\/(\d{2})\/(\d{4})\b[\s\S]{0,20}?(?:a?s|&agrave;|à)?\s*(\d{2}):(\d{2})h?/i);
  if (fullDate) {
    const [, day, month, year, hours, minutes] = fullDate;
    const parsed = new Date(`${year}-${month}-${day}T${hours}:${minutes}:00-03:00`);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }

  const shortDate = source.match(/\b(\d{2})\/(\d{2})\s*-\s*(\d{2}):(\d{2})\b/);
  if (shortDate) {
    const [, day, month, hours, minutes] = shortDate;
    const parsed = new Date(`${new Date().getFullYear()}-${month}-${day}T${hours}:${minutes}:00-03:00`);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }

  return undefined;
}

function parseMoneyBR(value?: string | null) {
  return parseCurrency(value);
}

function parseCurrentBid(html: string) {
  const currentBidBlock = html.match(/id=["']currentBid["'][\s\S]{0,300}?R\$\s*([\d.,]+)/i)?.[1];
  const visibleBid = html.match(/Lance atual[\s\S]{0,600}?R\$\s*([\d.,]+)/i)?.[1];
  const bid = parseMoneyBR(currentBidBlock ?? visibleBid);

  logSodre("bid_parsed", {
    raw: currentBidBlock ?? visibleBid,
    currentBid: bid
  });

  return bid;
}

function extractVisibleText(html: string) {
  return cleanText(html) ?? "";
}

function extractLotCode(html: string, auctionId: string, lotId: string) {
  const text = extractVisibleText(html);
  return (
    text.match(new RegExp(`Leil\\S*\\s+${auctionId}\\s*-\\s*(\\d{1,6})`, "i"))?.[1] ??
    text.match(new RegExp(`${auctionId}\\s*-\\s*(\\d{1,6})`, "i"))?.[1] ??
    text.match(/Lote\s*:?\s*(\d{1,6})/i)?.[1] ??
    lotId
  );
}

function imageBaseKey(url: string) {
  try {
    const parsed = new URL(url);
    parsed.search = "";
    parsed.searchParams.sort();
    return parsed.toString().toLowerCase();
  } catch {
    return url.replace(/\?.*$/, "").toLowerCase();
  }
}

function imageQualityRank(url: string, ogImage?: string) {
  if (ogImage && imageBaseKey(url) === imageBaseKey(ogImage)) return 100;
  if (/ims=x?\d{3,}/i.test(url)) return 80;
  if (/ims=\d{1,3}x\d{1,3}/i.test(url)) return 20;
  return 60;
}

function extractSodreImageUrls(html: string, meta: SodreHtmlMeta, auctionId: string, lotId: string) {
  const rawUrls = new Set<string>();

  if (meta.ogImage) {
    rawUrls.add(meta.ogImage);
  }

  const urlPattern = /(?:https?:)?\/\/photos\.sodresantoro\.com\.br\/[^"'\\\s<>),]+/gi;
  for (const match of html.matchAll(urlPattern)) {
    const url = normalizeUrl(match[0]);
    if (url) rawUrls.add(url);
  }

  logSodre("images_found_in_html", {
    count: rawUrls.size,
    imagesPreview: [...rawUrls].slice(0, 5)
  });

  const candidates = [...rawUrls]
    .map((url) => normalizeUrl(url))
    .filter((url): url is string => Boolean(url))
    .filter((url) => {
      const normalized = url.toLowerCase();
      return (
        normalized.includes("photos.sodresantoro.com.br") &&
        normalized.includes(`/veiculos/${auctionId}/${lotId}/`) &&
        /\.(jpe?g|png|webp)(?:$|\?)/i.test(normalized) &&
        !/logo|banner|icon|favicon|placeholder|loading/.test(normalized)
      );
    });
  const grouped = new Map<string, string[]>();

  for (const url of candidates) {
    const key = imageBaseKey(url);
    grouped.set(key, [...(grouped.get(key) ?? []), url]);
  }

  const deduped = [...grouped.values()].map((group) => [...group].sort((a, b) => imageQualityRank(b, meta.ogImage) - imageQualityRank(a, meta.ogImage))[0]);

  if (meta.ogImage) {
    const ogKey = imageBaseKey(meta.ogImage);
    deduped.sort((a, b) => (imageBaseKey(a) === ogKey ? -1 : imageBaseKey(b) === ogKey ? 1 : 0));
  }

  logSodre("images_deduped", {
    count: deduped.length
  });

  return deduped;
}

function buildSodrePhotos(urls: string[]): ImportedLotPhoto[] {
  return urls.map((imageUrl, index) => ({
    imageUrl,
    thumbnailUrl: imageUrl,
    imageType: imageUrl.match(/\.(jpe?g|png|webp)(?:$|\?)/i)?.[1]?.toLowerCase(),
    sequenceNumber: index + 1,
    source: "sodre-santoro"
  }));
}

export function extractSodreDataFromHtml(html: string, auctionId: string, lotId: string, originalUrl: string): SodreExtractedData {
  const htmlMeta = extractHtmlMeta(html);
  const titleData = parseSodreTitle(htmlMeta.ogTitle ?? htmlMeta.title ?? htmlMeta.description);
  const lotCode = extractLotCode(html, auctionId, lotId);
  const auctionDate = parseSodreDate(html, htmlMeta);
  const currentBid = parseCurrentBid(html);
  const imageUrls = extractSodreImageUrls(html, htmlMeta, auctionId, lotId);
  const photos = buildSodrePhotos(imageUrls);
  const originalNotes = htmlMeta.ogDescription ?? htmlMeta.description;

  return {
    lotUrl: htmlMeta.ogUrl ?? htmlMeta.canonical ?? originalUrl,
    lotCode,
    provider: "sodre-santoro",
    externalId: lotId,
    title: titleData.title,
    displayName: titleData.displayName,
    brand: titleData.brand,
    model: titleData.model,
    version: titleData.version,
    manufacturingYear: titleData.manufacturingYear,
    modelYear: titleData.modelYear,
    auctionHouseName: SODRE_AUCTION_HOUSE_NAME,
    auctionDate,
    auctionDateText: auctionDate ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(auctionDate) : undefined,
    saleDateTimestamp: auctionDate?.toISOString(),
    currentBid,
    currency: currentBid ? "BRL" : undefined,
    originalNotes,
    originalPhotoUrls: imageUrls,
    photos,
    mainImageUrl: imageUrls[0],
    htmlMeta
  } as SodreExtractedData;
}

function buildFallbackVehicleData(originalUrl: string, lotId: string): PartialVehicleImport & { title?: string; externalId?: string } {
  return {
    lotUrl: originalUrl,
    lotCode: lotId,
    provider: "sodre-santoro",
    externalId: lotId,
    displayName: `Lote ${lotId} - Sodre Santoro`,
    title: `Lote ${lotId} - Sodre Santoro`,
    auctionHouseName: SODRE_AUCTION_HOUSE_NAME,
    originalNotes: "Lote importado da Sodre Santoro com dados parciais.",
    originalPhotoUrls: [],
    photos: []
  };
}

function countFoundFields(vehicleData: PartialVehicleImport) {
  return [
    vehicleData.brand,
    vehicleData.model,
    vehicleData.version,
    vehicleData.manufacturingYear,
    vehicleData.modelYear,
    vehicleData.currentBid,
    vehicleData.auctionDate,
    vehicleData.originalNotes,
    ...(vehicleData.originalPhotoUrls ?? [])
  ].filter(Boolean).length;
}

export class SodreSantoroLotProvider {
  async import(originalUrl: string): Promise<LotImportResult> {
    logSodre("lot_import_started", { originalUrl });

    const urlParts = normalizeSodreUrl(originalUrl);

    logSodre("ids_extracted", {
      auctionId: urlParts.auctionId,
      lotId: urlParts.lotId
    });

    let page: SodreHtmlFetchResult | undefined;
    let extractedData: SodreExtractedData | undefined;
    let errorMessage: string | undefined;

    try {
      page = await fetchSodreHtml(urlParts.parsedUrl.toString());
      extractedData = extractSodreDataFromHtml(page.html, urlParts.auctionId, urlParts.lotId, page.finalUrl);
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : "Falha ao acessar ou interpretar o HTML da Sodre Santoro.";
      console.error("[lot-import:sodre]", {
        event: "html_import_failed",
        message: errorMessage,
        stack: error instanceof Error ? error.stack : undefined
      });
    }

    const hasHtmlData = Boolean(extractedData && countFoundFields(extractedData) > 0);
    const { htmlMeta: _htmlMeta, ...extractedVehicleData } = extractedData ?? { htmlMeta: undefined };
    const fallbackVehicleData = buildFallbackVehicleData(urlParts.parsedUrl.toString(), urlParts.lotId);
    const vehicleData: PartialVehicleImport & { title?: string; externalId?: string } = {
      ...fallbackVehicleData,
      ...(hasHtmlData ? extractedVehicleData : {}),
      lotUrl: extractedData?.lotUrl ?? urlParts.parsedUrl.toString(),
      lotCode: extractedData?.lotCode ?? urlParts.lotId,
      provider: "sodre-santoro",
      externalId: urlParts.lotId,
      auctionHouseName: SODRE_AUCTION_HOUSE_NAME,
      originalPhotoUrls: extractedData?.originalPhotoUrls ?? [],
      photos: extractedData?.photos ?? [],
      mainImageUrl: extractedData?.mainImageUrl
    };

    logSodre("vehicle_data_built", { vehicleData });

    ensureImportedData(vehicleData, {
      requestedUrl: originalUrl,
      finalUrl: page?.finalUrl ?? urlParts.parsedUrl.toString(),
      hostname: urlParts.parsedUrl.hostname,
      statusCode: page?.statusCode,
      contentType: page?.contentType,
      bodyLength: page?.html.length,
      title: extractedData?.title,
      description: extractedData?.originalNotes
    });

    const pendingFields = computePendingFields(vehicleData);
    const sourceMethod = hasHtmlData
      ? vehicleData.originalPhotoUrls && vehicleData.originalPhotoUrls.length > 0
        ? "sodre_html_meta_images"
        : "sodre_html_meta"
      : "sodre_partial_fallback";
    const alerts = [
      hasHtmlData
        ? "Lote da Sodre Santoro importado pelo HTML/meta tags e pronto para revisao."
        : "Importacao da Sodre realizada com dados parciais. Complete os dados ausentes manualmente."
    ];

    logSodre("pending_fields_computed", { pendingFields });
    logSodre("import_preview_ready", {
      lotCode: vehicleData.lotCode,
      photosCount: vehicleData.photos?.length ?? 0,
      pendingFields
    });

    return {
      status: hasHtmlData && pendingFields.length <= 2 ? "SUCCESS" : "PARTIAL",
      provider: "sodre-santoro",
      vehicleData,
      rawJson: {
        requestedUrl: originalUrl,
        finalUrl: page?.finalUrl ?? urlParts.parsedUrl.toString(),
        statusCode: page?.statusCode,
        sourceMethod,
        auctionId: urlParts.auctionId,
        lotId: urlParts.lotId,
        htmlMeta: extractedData?.htmlMeta,
        extractedData,
        photos: vehicleData.photos ?? [],
        errorMessage
      },
      alerts,
      pendingFields,
      errorMessage,
      context: {
        requestedUrl: originalUrl,
        finalUrl: page?.finalUrl ?? urlParts.parsedUrl.toString(),
        hostname: urlParts.parsedUrl.hostname,
        statusCode: page?.statusCode,
        contentType: page?.contentType,
        bodyLength: page?.html.length,
        title: extractedData?.title,
        description: extractedData?.originalNotes
      }
    };
  }
}
