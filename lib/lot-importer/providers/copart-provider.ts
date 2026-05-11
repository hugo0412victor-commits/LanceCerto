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
type CopartJsonLogPrefix = "copart_structured" | "copart_lot_images" | "scrapingbee_structured" | "scrapingbee_images";

type CopartDetailsFetchResult = {
  endpoint: string;
  details: CopartLotDetails;
  usedScrapingBee: boolean;
};

type CopartImagesFetchResult = {
  images: ImportedLotPhoto[];
  endpoint: string;
  usedScrapingBee: boolean;
  alert?: string;
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

  const trimmed = value.trim();

  if (trimmed.startsWith("//")) {
    return `https:${trimmed}`;
  }

  if (trimmed.startsWith("/")) {
    return new URL(trimmed, COPART_BASE_URL).toString();
  }

  return trimmed;
}

function displayName(details: CopartLotDetails) {
  return [asString(details.mkn), asString(details.lm), asString(details["versão"]) ?? asString(details["versÃ£o"]) ?? asString(details.version), asText(details.my)]
    .filter(Boolean)
    .join(" ");
}

function titleFromDetails(details: CopartLotDetails) {
  return [asText(details.lcy), asString(details.mkn), asString(details.lm)].filter(Boolean).join(" ");
}

function buildYardSlot(details: CopartLotDetails) {
  return [asText(details.aan), asText(details.gr)].filter(Boolean).join(" / ") || undefined;
}

function resolveFipeAndMileage(details: CopartLotDetails) {
  const fipeFromOrr = asNumber(details.orr);
  const laValue = asNumber(details.la);

  if (fipeFromOrr && fipeFromOrr > 0) {
    return {
      fipeValue: fipeFromOrr,
      mileage: parseInteger(details.la),
      mileageUnit: asString(details.ord)
    };
  }

  return {
    fipeValue: laValue,
    mileage: undefined,
    mileageUnit: undefined
  };
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

function hasScrapingBeeKey() {
  return Boolean(process.env.SCRAPINGBEE_API_KEY?.trim());
}

function scrapingBeeUrl(targetUrl: string) {
  const apiKey = process.env.SCRAPINGBEE_API_KEY?.trim();

  if (!apiKey) {
    return undefined;
  }

  const params = [
    `api_key=${encodeURIComponent(apiKey)}`,
    `url=${encodeURIComponent(targetUrl)}`,
    `render_js=${encodeURIComponent(process.env.SCRAPINGBEE_RENDER_JS ?? "true")}`,
    `wait=${encodeURIComponent(process.env.SCRAPINGBEE_WAIT_MS ?? "5000")}`,
    `premium_proxy=${encodeURIComponent(process.env.SCRAPINGBEE_PREMIUM_PROXY ?? "false")}`
  ];

  if (process.env.SCRAPINGBEE_COUNTRY_CODE?.trim()) {
    params.push(`country_code=${encodeURIComponent(process.env.SCRAPINGBEE_COUNTRY_CODE.trim())}`);
  }

  return `https://app.scrapingbee.com/api/v1/?${params.join("&")}`;
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

async function fetchJson(endpoint: string, referer: string, logPrefix: CopartJsonLogPrefix) {
  if (logPrefix === "copart_structured") {
    logCopart("copart_direct_started", { endpoint });
  }

  if (logPrefix === "scrapingbee_structured") {
    logCopart("scrapingbee_structured_started");
  }

  if (logPrefix === "scrapingbee_images") {
    logCopart("scrapingbee_images_started");
  }

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

  if (logPrefix === "scrapingbee_structured") {
    logCopart("scrapingbee_structured_status", { status: response.status });
    logCopart("scrapingbee_structured_body_length", { bodyLength: body.length });
  }

  if (logPrefix === "scrapingbee_images") {
    logCopart("scrapingbee_images_status", { status: response.status });
    logCopart("scrapingbee_images_body_length", { bodyLength: body.length });
  }

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

async function fetchWithScrapingBee(endpoint: string, referer: string, kind: "structured" | "images") {
  logCopart("scrapingbee_key_present", { present: hasScrapingBeeKey() });

  const fallbackUrl = scrapingBeeUrl(endpoint);

  if (!fallbackUrl) {
    return undefined;
  }

  try {
    const payload = await fetchJson(fallbackUrl, referer, kind === "structured" ? "scrapingbee_structured" : "scrapingbee_images");
    return payload;
  } catch (error) {
    logCopart(kind === "structured" ? "scrapingbee_structured_parse_failed" : "scrapingbee_images_parse_failed", {
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

function validateScrapingBeeDetailsPayload(payload: CopartPayload, lotNumber: string) {
  const details = validateDetailsPayload(payload, lotNumber);
  logCopart("scrapingbee_structured_parse_success", { lotNumber });
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

function imageTypeFromUrl(url?: string) {
  if (!url) {
    return undefined;
  }

  try {
    return new URL(url).searchParams.get("imageType") ?? undefined;
  } catch {
    return url.match(/[?&]imageType=([^&]+)/i)?.[1];
  }
}

function imageBaseKey(url: string) {
  try {
    const parsed = new URL(url);
    parsed.searchParams.delete("imageType");
    parsed.searchParams.sort();
    return parsed.toString().toLowerCase();
  } catch {
    return url.replace(/[?&]imageType=[^&]+/i, "").toLowerCase();
  }
}

function removeImageTypeQuery(url: string) {
  try {
    const parsed = new URL(url);
    parsed.searchParams.delete("imageType");
    return parsed.toString();
  } catch {
    return url.replace(/([?&])imageType=[^&]+&?/i, "$1").replace(/[?&]$/, "");
  }
}

function imageQualityRank(photo: ImportedLotPhoto) {
  const type = (photo.imageType ?? imageTypeFromUrl(photo.imageUrl) ?? "").toLowerCase();

  if (!type) return 100;
  if (["highres", "high_res", "hires", "original"].includes(type)) return 95;
  if (["large", "full", "fullscreen", "fullimage"].includes(type)) return 90;
  if (type === "vga") return 20;
  if (type === "thumbnail" || type === "thumb") return 10;
  return 50;
}

function collectImageUrlCandidate(record: Record<string, unknown>, fieldName: string, fallbackIndex: number): ImportedLotPhoto | undefined {
  let imageUrl = normalizeImageUrl(asString(record[fieldName]));

  if (!imageUrl) {
    return undefined;
  }

  const sequenceNumber =
    parseInteger(record.sequenceNumber) ??
    parseInteger(record.sequence) ??
    parseInteger(record.seq) ??
    parseInteger(record.position) ??
    parseInteger(record.index) ??
    fallbackIndex + 1;
  const urlImageType = imageTypeFromUrl(imageUrl);
  const explicitType = urlImageType ?? asString(record.imageTypeDescription) ?? asString(record.imageType) ?? asString(record.type) ?? asString(record.image_type);
  const canUseBaseImage = Boolean(record.highRes) || /full|high|large/i.test(explicitType ?? "");
  const thumbnailUrl = ["thumbnailUrl", "thumbnail", "thumbUrl", "smallImage", "smallImageUrl"].includes(fieldName) || /thumbnail|vga/i.test(urlImageType ?? "") ? imageUrl : undefined;

  if (canUseBaseImage && /[?&]imageType=/i.test(imageUrl)) {
    imageUrl = removeImageTypeQuery(imageUrl);
  }

  return {
    imageUrl,
    thumbnailUrl,
    imageType: explicitType ?? imageTypeFromUrl(imageUrl),
    sequenceNumber,
    source: "copart"
  };
}

function imageCandidatesFromRecord(record: Record<string, unknown>, fallbackIndex: number) {
  return [
    "highResUrl",
    "highResImageUrl",
    "fullImage",
    "fullImageUrl",
    "fullUrl",
    "largeImage",
    "largeImageUrl",
    "url",
    "imageUrl",
    "link",
    "image",
    "thumbnailUrl",
    "thumbnail",
    "thumbUrl",
    "smallImage",
    "smallImageUrl"
  ]
    .map((fieldName) => collectImageUrlCandidate(record, fieldName, fallbackIndex))
    .filter((photo): photo is ImportedLotPhoto => Boolean(photo));
}

function collectImages(value: unknown, images: ImportedLotPhoto[] = []): ImportedLotPhoto[] {
  if (!value) {
    return images;
  }

  if (typeof value === "string") {
    const imageUrl = normalizeImageUrl(value);
    if (imageUrl) {
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
    images.push(...imageCandidatesFromRecord(record, images.length));

    Object.values(record).forEach((item) => {
      if (item && (Array.isArray(item) || typeof item === "object")) {
        collectImages(item, images);
      }
    });
  }

  return images;
}

function dedupeCopartImages(images: ImportedLotPhoto[]) {
  logCopart("copart_lot_images_raw_count", { count: images.length });

  const grouped = new Map<string, ImportedLotPhoto[]>();

  for (const photo of images) {
    const normalizedImageUrl = normalizeImageUrl(photo.imageUrl);

    if (!normalizedImageUrl) {
      continue;
    }

    const normalizedPhoto = {
      ...photo,
      imageUrl: normalizedImageUrl,
      thumbnailUrl: normalizeImageUrl(photo.thumbnailUrl),
      imageType: photo.imageType ?? imageTypeFromUrl(normalizedImageUrl)
    };
    const groupKey = normalizedPhoto.sequenceNumber ? `seq:${normalizedPhoto.sequenceNumber}` : `url:${imageBaseKey(normalizedPhoto.imageUrl)}`;
    const current = grouped.get(groupKey) ?? [];
    current.push(normalizedPhoto);
    grouped.set(groupKey, current);
  }

  const deduped = [...grouped.values()].map((group, index) => {
    const sorted = [...group].sort((a, b) => imageQualityRank(b) - imageQualityRank(a));
    const best = sorted[0];
    const thumbnail = sorted.find((photo) => (photo.imageType ?? imageTypeFromUrl(photo.imageUrl) ?? "").toLowerCase().includes("thumbnail"));

    return {
      ...best,
      thumbnailUrl: thumbnail?.imageUrl ?? best.thumbnailUrl,
      sequenceNumber: best.sequenceNumber ?? index + 1,
      source: "copart"
    };
  });

  logCopart("copart_lot_images_grouped_count", { count: grouped.size });
  logCopart("copart_lot_images_deduped_count", { count: deduped.length });
  logCopart("copart_lot_images_removed_duplicates_count", { count: Math.max(0, images.length - deduped.length) });

  return deduped.sort((a, b) => (a.sequenceNumber ?? 9999) - (b.sequenceNumber ?? 9999));
}

function normalizeImages(payload: CopartPayload, details: CopartLotDetails) {
  const rawImages = payload.data?.imagesList ?? payload.data?.lotImages ?? payload.data?.images ?? payload.data ?? payload;
  const images = collectImages(rawImages);

  const mainImage = normalizeImageUrl(asString(details.tims));

  if (mainImage) {
    images.push({
      imageUrl: mainImage,
      thumbnailUrl: mainImage,
      imageType: imageTypeFromUrl(mainImage) ?? "thumbnail",
      sequenceNumber: 1,
      source: "copart"
    });
  }

  return dedupeCopartImages(images);
}

async function fetchLotDetails(url: string, lotNumber: string): Promise<CopartDetailsFetchResult> {
  const endpoint = endpointFor("", lotNumber);

  try {
    const payload = await fetchJson(endpoint, url, "copart_structured");
    return {
      endpoint,
      details: validateDetailsPayload(payload, lotNumber),
      usedScrapingBee: false
    };
  } catch (error) {
    logCopart("copart_direct_blocked", {
      code: error instanceof LotImportError ? error.code : "UNKNOWN_ERROR"
    });
    logCopart("copart_structured_blocked", {
      code: error instanceof LotImportError ? error.code : "UNKNOWN_ERROR"
    });

    const fallbackPayload = await fetchWithScrapingBee(endpoint, url, "structured");

    if (fallbackPayload) {
      try {
        return {
          endpoint,
          details: validateScrapingBeeDetailsPayload(fallbackPayload, lotNumber),
          usedScrapingBee: true
        };
      } catch (fallbackError) {
        logCopart("scrapingbee_structured_parse_failed", {
          code: fallbackError instanceof LotImportError ? fallbackError.code : "UNKNOWN_ERROR",
          message: fallbackError instanceof Error ? fallbackError.message : "unknown"
        });
      }
    }

    if (error instanceof LotImportError) {
      throw error;
    }

    throw new LotImportError("Não foi possível importar o lote agora. Tente novamente ou preencha manualmente.", "UNKNOWN_ERROR", 500);
  }
}

async function fetchLotImages(url: string, lotNumber: string, details: CopartLotDetails): Promise<CopartImagesFetchResult> {
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
      usedScrapingBee: false,
      alert: images.length === 0 ? "Os dados do lote foram importados, mas a galeria de fotos veio vazia." : undefined
    };
  } catch (error) {
    logCopart("copart_lot_images_parse_failed", {
      code: error instanceof LotImportError ? error.code : "UNKNOWN_ERROR"
    });

    const fallbackPayload = await fetchWithScrapingBee(endpoint, url, "images");
    if (fallbackPayload) {
      try {
        const images = normalizeImages(fallbackPayload, details);
        logCopart("copart_lot_images_count", { count: images.length });
        logCopart("scrapingbee_images_count", { count: images.length });
        logCopart("scrapingbee_images_parse_success", { count: images.length });
        return { images, endpoint, usedScrapingBee: true, alert: undefined };
      } catch (fallbackError) {
        logCopart("scrapingbee_images_parse_failed", {
          code: fallbackError instanceof LotImportError ? fallbackError.code : "UNKNOWN_ERROR",
          message: fallbackError instanceof Error ? fallbackError.message : "unknown"
        });
      }
    }

    logCopart("copart_lot_images_blocked", {
      code: error instanceof LotImportError ? error.code : "UNKNOWN_ERROR"
    });

    return {
      images: normalizeImages({ data: {} }, details),
      endpoint,
      usedScrapingBee: false,
      alert: "Os dados do lote foram importados, mas não foi possível importar todas as fotos."
    };
  }
}

function buildVehicleData(url: string, lotNumber: string, details: CopartLotDetails, photos: ImportedLotPhoto[]) {
  const auctionYard = asString(details.yn);
  const vehicleYard = asString(details.pyn);
  const mainImageUrl = photos[0]?.imageUrl ?? normalizeImageUrl(asString(details.tims));
  const saleDate = parseCopartDate(details.ad);
  const version = asString(details["versão"]) ?? asString(details["versÃ£o"]) ?? asString(details.version);
  const damageDescription = asString(details.damageDesc);
  const mainDamage = asString(details.lt);
  const fipeAndMileage = resolveFipeAndMileage(details);

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
    fipeValue: fipeAndMileage.fipeValue,
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
    mileage: fipeAndMileage.mileage,
    mileageUnit: fipeAndMileage.mileageUnit,
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

    let lot: CopartDetailsFetchResult;
    try {
      lot = await fetchLotDetails(url, lotNumber);
    } catch (error) {
      await fetchLotImages(url, lotNumber, {});

      if (error instanceof LotImportError) {
        throw error;
      }

      throw new LotImportError("Não foi possível importar o lote agora. Tente novamente ou preencha manualmente.", "UNKNOWN_ERROR", 500);
    }

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
      ...(lot.usedScrapingBee || gallery.usedScrapingBee ? ["Fallback ScrapingBee usado para acessar os endpoints estruturados."] : []),
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
        imagesSourceMethod: gallery.usedScrapingBee ? "scrapingbee_copart_images_api" : "copart_images_api",
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
