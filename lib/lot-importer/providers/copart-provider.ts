import { LotImportError, type ImportedLotPhoto, type LotImportResult } from "@/lib/lot-importer/types";
import { computePendingFields, ensureImportedData, fetchWithTimeout } from "@/lib/lot-importer/utils";

type CopartLotDetails = Record<string, unknown>;
type CopartPayload = {
  returnCode?: number;
  returnCodeDesc?: string;
  data?: {
    lotDetails?: CopartLotDetails;
    imagesList?: unknown;
    lotImages?: unknown;
    images?: unknown;
  };
};

const COPART_BASE_URL = "https://www.copart.com.br";
const BLOCK_PATTERNS = [/_incapsula_resource/i, /noindex,nofollow/i, /access denied/i, /captcha/i, /forbidden/i];

const COPART_API_HEADERS = {
  "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  accept: "application/json,text/plain,*/*",
  "accept-language": "pt-BR,pt;q=0.9,en;q=0.8",
  "x-requested-with": "XMLHttpRequest"
};

function logCopart(event: string, meta?: Record<string, unknown>) {
  console.info("[lot-import:copart]", {
    event,
    ...meta
  });
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asText(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  return asString(value);
}

function asNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "bigint") {
    return Number(value);
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.replace(/[^\d.,-]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", "."));
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

function parseInteger(value: unknown) {
  const parsed = asNumber(value);
  return parsed === undefined ? undefined : Math.trunc(parsed);
}

function parseCopartBoolean(value: unknown) {
  if (typeof value === "boolean") {
    return value;
  }

  const normalized = asString(value)?.toLowerCase();

  if (!normalized) {
    return undefined;
  }

  if (["y", "yes", "s", "sim", "true", "1"].includes(normalized)) {
    return true;
  }

  if (["n", "no", "nao", "não", "false", "0"].includes(normalized)) {
    return false;
  }

  return undefined;
}

function parseRunningCondition(value: unknown) {
  const text = asString(value);

  if (!text) {
    return undefined;
  }

  if (/(nao|não|inoperante|nao funciona|não funciona|desconhecido)/i.test(text)) {
    return false;
  }

  return true;
}

function parseCopartDate(value: unknown) {
  const numeric = asNumber(value);

  if (!numeric) {
    return undefined;
  }

  const milliseconds = numeric < 10000000000 ? numeric * 1000 : numeric;
  const date = new Date(milliseconds);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function normalizeImageUrl(value?: string) {
  if (!value) {
    return undefined;
  }

  if (value.startsWith("//")) {
    return `https:${value}`;
  }

  if (value.startsWith("/")) {
    return new URL(value, COPART_BASE_URL).toString();
  }

  return value;
}

function displayName(details: CopartLotDetails) {
  return [asString(details.mkn), asString(details.lm), asString(details["versão"]) ?? asString(details.version), asText(details.my)]
    .filter(Boolean)
    .join(" ");
}

function titleFromDetails(details: CopartLotDetails) {
  return [asText(details.lcy), asString(details.mkn), asString(details.lm)].filter(Boolean).join(" ");
}

function buildYardSlot(details: CopartLotDetails) {
  return [asText(details.aan), asText(details.gr)].filter(Boolean).join(" / ") || undefined;
}

function extractLotNumber(url: string) {
  let parsed: URL;

  try {
    parsed = new URL(url);
  } catch {
    throw new LotImportError("Informe um link válido da Copart.", "INVALID_URL", 400, { url });
  }

  if (!parsed.hostname.toLowerCase().includes("copart.com.br")) {
    throw new LotImportError("Este importador aceita apenas links da Copart Brasil.", "UNSUPPORTED_PROVIDER", 400, {
      hostname: parsed.hostname
    });
  }

  const lotNumber = parsed.pathname.match(/\/lot\/(\d+)/i)?.[1] ?? parsed.pathname.match(/(\d{4,})/)?.[1];

  if (!lotNumber) {
    throw new LotImportError("Não conseguimos identificar o número do lote nesse link.", "LOT_NUMBER_NOT_FOUND", 400, {
      url
    });
  }

  return lotNumber;
}

function endpointFor(path: string, lotNumber: string) {
  return `${COPART_BASE_URL}/public/data/lotdetails/solr/${path}${lotNumber}`;
}

function scrapingBeeUrl(targetUrl: string) {
  const apiKey = process.env.SCRAPINGBEE_API_KEY;

  if (!apiKey) {
    return undefined;
  }

  const url = new URL("https://app.scrapingbee.com/api/v1/");
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("url", targetUrl);
  url.searchParams.set("render_js", process.env.SCRAPINGBEE_RENDER_JS ?? "true");
  url.searchParams.set("wait", process.env.SCRAPINGBEE_WAIT_MS ?? "5000");
  url.searchParams.set("premium_proxy", process.env.SCRAPINGBEE_PREMIUM_PROXY ?? "false");

  if (process.env.SCRAPINGBEE_COUNTRY_CODE) {
    url.searchParams.set("country_code", process.env.SCRAPINGBEE_COUNTRY_CODE);
  }

  return url.toString();
}

function validateBody(body: string, contentType?: string | null) {
  if (contentType?.toLowerCase().includes("text/html")) {
    throw new LotImportError("A Copart bloqueou a leitura automática neste ambiente. Você pode preencher os dados manualmente.", "ACCESS_BLOCKED", 502, {
      contentType
    });
  }

  if (BLOCK_PATTERNS.some((pattern) => pattern.test(body))) {
    throw new LotImportError("A Copart bloqueou a leitura automática neste ambiente. Você pode preencher os dados manualmente.", "INCAPSULA_BLOCKED", 502, {
      blockerDetected: true
    });
  }
}

async function fetchJson(endpoint: string, referer: string, logPrefix: "copart_structured" | "copart_lot_images" | "scrapingbee_structured") {
  logCopart(`${logPrefix}_endpoint_started`, {
    endpoint: endpoint.replace(/api_key=[^&]+/i, "api_key=[redacted]")
  });

  let response: Response;

  try {
    response = await fetchWithTimeout(endpoint, {
      headers: {
        ...COPART_API_HEADERS,
        referer
      },
      cache: "no-store"
    });
  } catch (error) {
    throw new LotImportError("Não foi possível conectar à Copart agora.", "NETWORK_ERROR", 504, {
      cause: error instanceof Error ? error.message : "unknown"
    });
  }

  const contentType = response.headers.get("content-type");
  const body = await response.text();

  logCopart(`${logPrefix}_response_status`, { status: response.status });
  logCopart(`${logPrefix}_content_type`, { contentType });
  logCopart(`${logPrefix}_body_length`, { bodyLength: body.length });

  validateBody(body, contentType);

  if (!response.ok) {
    throw new LotImportError("A API estruturada da Copart respondeu com erro.", "COPART_STRUCTURED_FAILED", 502, {
      status: response.status,
      contentType
    });
  }

  try {
    const parsed = JSON.parse(body) as CopartPayload;
    logCopart(`${logPrefix}_json_received`);
    return parsed;
  } catch {
    logCopart(`${logPrefix}_parse_failed`);
    throw new LotImportError("A página foi acessada, mas os dados do lote não foram encontrados automaticamente. Preencha os dados manualmente.", "PARSE_FAILED", 502, {
      contentType,
      bodyPrefix: body.slice(0, 120)
    });
  }
}

async function fetchWithScrapingBee(endpoint: string, referer: string) {
  const fallbackUrl = scrapingBeeUrl(endpoint);

  if (!fallbackUrl) {
    return undefined;
  }

  try {
    const payload = await fetchJson(fallbackUrl, referer, "scrapingbee_structured");
    logCopart("scrapingbee_structured_parse_success");
    return payload;
  } catch (error) {
    logCopart("scrapingbee_structured_parse_failed", {
      code: error instanceof LotImportError ? error.code : "UNKNOWN_ERROR",
      message: error instanceof Error ? error.message : "unknown"
    });
    return undefined;
  }
}

function validateDetailsPayload(payload: CopartPayload, lotNumber: string) {
  const details = payload.data?.lotDetails;
  const returnedLot = asText(details?.ln);

  if (payload.returnCode !== 1 || !details) {
    throw new LotImportError("Os dados estruturados do lote não foram encontrados.", "LOT_DATA_NOT_FOUND", 422, {
      returnCode: payload.returnCode,
      returnCodeDesc: payload.returnCodeDesc
    });
  }

  if (returnedLot !== lotNumber) {
    throw new LotImportError("A Copart retornou dados de outro lote.", "LOT_DATA_NOT_FOUND", 422, {
      requestedLot: lotNumber,
      returnedLot
    });
  }

  logCopart("copart_structured_parse_success", { lotNumber });
  return details;
}

function pickImageField(record: Record<string, unknown>, names: string[]) {
  for (const name of names) {
    const value = normalizeImageUrl(asString(record[name]));

    if (value) {
      return value;
    }
  }

  return undefined;
}

function imageFromRecord(record: Record<string, unknown>, fallbackIndex: number): ImportedLotPhoto | undefined {
  const imageUrl = pickImageField(record, [
    "fullImage",
    "fullImageUrl",
    "fullUrl",
    "url",
    "imageUrl",
    "highResUrl",
    "highResImageUrl",
    "link",
    "image"
  ]);
  const thumbnailUrl = pickImageField(record, ["thumbnailUrl", "thumbnail", "thumbUrl", "smallImage", "smallImageUrl"]);

  if (!imageUrl && !thumbnailUrl) {
    return undefined;
  }

  return {
    imageUrl: imageUrl ?? thumbnailUrl!,
    thumbnailUrl,
    imageType: asString(record.imageType) ?? asString(record.type) ?? asString(record.image_type),
    sequenceNumber: parseInteger(record.sequenceNumber) ?? parseInteger(record.sequence) ?? parseInteger(record.seq) ?? fallbackIndex + 1,
    source: "copart"
  };
}

function collectImages(value: unknown, images: ImportedLotPhoto[] = []): ImportedLotPhoto[] {
  if (!value) {
    return images;
  }

  if (typeof value === "string") {
    const imageUrl = normalizeImageUrl(value);
    if (imageUrl && /\.(jpg|jpeg|png|webp)(\?|$)/i.test(imageUrl)) {
      images.push({
        imageUrl,
        sequenceNumber: images.length + 1,
        source: "copart"
      });
    }
    return images;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => collectImages(item, images));
    return images;
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const image = imageFromRecord(record, images.length);

    if (image) {
      images.push(image);
    }

    Object.values(record).forEach((item) => {
      if (item && (Array.isArray(item) || typeof item === "object")) {
        collectImages(item, images);
      }
    });
  }

  return images;
}

function normalizeImages(payload: CopartPayload, details: CopartLotDetails) {
  const rawImages = payload.data?.imagesList ?? payload.data?.lotImages ?? payload.data?.images ?? payload.data ?? payload;
  const unique = new Map<string, ImportedLotPhoto>();

  for (const photo of collectImages(rawImages)) {
    if (!unique.has(photo.imageUrl)) {
      unique.set(photo.imageUrl, photo);
    }
  }

  const mainImage = normalizeImageUrl(asString(details.tims));

  if (mainImage && !unique.has(mainImage)) {
    unique.set(mainImage, {
      imageUrl: mainImage,
      thumbnailUrl: mainImage,
      imageType: "thumbnail",
      sequenceNumber: unique.size + 1,
      source: "copart"
    });
  }

  return [...unique.values()].sort((a, b) => (a.sequenceNumber ?? 9999) - (b.sequenceNumber ?? 9999));
}

async function fetchLotDetails(url: string, lotNumber: string) {
  const endpoint = endpointFor("", lotNumber);

  try {
    const payload = await fetchJson(endpoint, url, "copart_structured");
    return {
      endpoint,
      details: validateDetailsPayload(payload, lotNumber),
      usedScrapingBee: false
    };
  } catch (error) {
    logCopart("copart_structured_blocked", {
      code: error instanceof LotImportError ? error.code : "UNKNOWN_ERROR"
    });

    const fallbackPayload = await fetchWithScrapingBee(endpoint, url);

    if (fallbackPayload) {
      return {
        endpoint,
        details: validateDetailsPayload(fallbackPayload, lotNumber),
        usedScrapingBee: true
      };
    }

    if (error instanceof LotImportError) {
      throw error;
    }

    throw new LotImportError("Não foi possível importar o lote agora. Tente novamente ou preencha manualmente.", "UNKNOWN_ERROR", 500);
  }
}

async function fetchLotImages(url: string, lotNumber: string, details: CopartLotDetails) {
  const endpoint = endpointFor("lotImages/", lotNumber);

  logCopart("copart_lot_images_started", { lotNumber });

  try {
    const payload = await fetchJson(endpoint, url, "copart_lot_images");
    const images = normalizeImages(payload, details);
    logCopart("copart_lot_images_count", { count: images.length });
    logCopart("copart_lot_images_parse_success", { count: images.length });
    return {
      images,
      endpoint,
      alert: images.length === 0 ? "Os dados do lote foram importados, mas a galeria de fotos veio vazia." : undefined
    };
  } catch (error) {
    logCopart("copart_lot_images_parse_failed", {
      code: error instanceof LotImportError ? error.code : "UNKNOWN_ERROR"
    });

    const fallbackPayload = await fetchWithScrapingBee(endpoint, url);
    if (fallbackPayload) {
      const images = normalizeImages(fallbackPayload, details);
      logCopart("copart_lot_images_count", { count: images.length });
      return { images, endpoint, alert: undefined };
    }

    logCopart("copart_lot_images_blocked", {
      code: error instanceof LotImportError ? error.code : "UNKNOWN_ERROR"
    });

    return {
      images: normalizeImages({ data: {} }, details),
      endpoint,
      alert: "Os dados do lote foram importados, mas não foi possível importar todas as fotos."
    };
  }
}

function buildVehicleData(url: string, lotNumber: string, details: CopartLotDetails, photos: ImportedLotPhoto[]) {
  const auctionYard = asString(details.yn);
  const vehicleYard = asString(details.pyn);
  const mainImageUrl = photos[0]?.imageUrl ?? normalizeImageUrl(asString(details.tims));
  const saleDate = parseCopartDate(details.ad);
  const version = asString(details["versão"]) ?? asString(details.version);
  const damageDescription = asString(details.damageDesc);
  const mainDamage = asString(details.lt);

  return {
    lotUrl: url,
    lotCode: asText(details.ln) ?? lotNumber,
    provider: "copart",
    displayName: displayName(details),
    title: titleFromDetails(details),
    auctionHouseName: "Copart Brasil",
    brand: asString(details.mkn),
    model: asString(details.lm),
    version,
    manufacturingYear: parseInteger(details.lcy),
    modelYear: parseInteger(details.my),
    armored: parseCopartBoolean(details.blindado),
    fipeValue: asNumber(details.orr),
    documentType: asString(details.stt),
    documentTypeCode: asText(details.docType),
    sellerName: asString(details.scn),
    mountType: asString(details.dtd),
    damageDescription,
    condition: damageDescription ?? mainDamage,
    hasKey: parseCopartBoolean(details.hk),
    runningCondition: parseRunningCondition(details.drvr),
    runningConditionText: asString(details.drvr),
    category: asString(details.vehTypDesc),
    fuel: asString(details.ft),
    mileage: parseInteger(details.la),
    mileageUnit: asString(details.ord),
    chassis: asString(details.fv),
    chassisType: asString(details.vt),
    plateOrFinal: asText(details.ldlp),
    yard: vehicleYard ?? auctionYard,
    auctionYard,
    vehicleYard,
    yardNumber: asText(details.aan),
    yardSpace: asText(details.gr),
    yardSlot: buildYardSlot(details),
    physicalYardNumber: asText(details.phynumb),
    yardCode: asText(details.ynumb),
    auctionDate: saleDate,
    auctionDateText: saleDate ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(saleDate) : undefined,
    saleDateTimestamp: asText(details.ad),
    sold: parseCopartBoolean(details.lotSoldFlag),
    saleStatus: asString(details.saleStatus),
    currentBid: asNumber(details.currBid),
    bidIncrement: asNumber(details.inc),
    buyNowPrice: asNumber(details.bnp),
    highestBid: asNumber(details.hb),
    myBid: asNumber(details.myb),
    currency: asString(details.cuc),
    documentsUrl: normalizeImageUrl(asString(details.trl)),
    specificConditionsUrl: normalizeImageUrl(asString(details.scl)),
    mainImageUrl,
    originalNotes: asString(details.cmmnts),
    originalPhotoUrls: photos.map((photo) => photo.imageUrl),
    photos
  };
}

export class CopartLotProvider {
  async import(url: string): Promise<LotImportResult> {
    logCopart("lot_import_started");

    const lotNumber = extractLotNumber(url);
    logCopart("copart_url_received", { url: new URL(url).pathname });
    logCopart("copart_lot_number_extracted", { lotNumber });

    const lot = await fetchLotDetails(url, lotNumber);
    const gallery = await fetchLotImages(url, lotNumber, lot.details);
    const vehicleData = buildVehicleData(url, lotNumber, lot.details, gallery.images);

    ensureImportedData(vehicleData, {
      requestedUrl: url,
      finalUrl: url,
      hostname: new URL(url).hostname,
      statusCode: 200
    });

    const pendingFields = computePendingFields(vehicleData);
    const alerts = [
      pendingFields.length <= 2
        ? "Lote da Copart importado pela API estruturada e pronto para revisão."
        : "Lote da Copart importado parcialmente. Confira os campos pendentes antes de salvar.",
      ...(lot.usedScrapingBee ? ["Fallback ScrapingBee usado para acessar os endpoints estruturados."] : []),
      ...(gallery.alert ? [gallery.alert] : [])
    ];

    logCopart("import_preview_ready", {
      lotNumber,
      photosCount: gallery.images.length,
      pendingFields
    });

    return {
      status: pendingFields.length <= 2 ? "SUCCESS" : "PARTIAL",
      provider: "copart",
      vehicleData,
      rawJson: {
        requestedUrl: url,
        finalUrl: url,
        statusCode: 200,
        sourceMethod: lot.usedScrapingBee ? "scrapingbee_copart_structured_api" : "copart_structured_api",
        lotDetailsEndpoint: lot.endpoint,
        lotImagesEndpoint: gallery.endpoint,
        lotDetails: lot.details,
        photos: gallery.images
      },
      alerts,
      pendingFields,
      context: {
        requestedUrl: url,
        finalUrl: url,
        hostname: new URL(url).hostname,
        statusCode: 200
      }
    };
  }
}
