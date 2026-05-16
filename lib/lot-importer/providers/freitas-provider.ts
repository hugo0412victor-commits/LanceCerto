import { request as httpsRequest } from "https";
import { LotImportError, type ImportedLotPhoto, type LotImportResult, type PartialVehicleImport } from "@/lib/lot-importer/types";
import { computePendingFields, ensureImportedData, fetchWithTimeout, parseCurrency, validateLotUrl } from "@/lib/lot-importer/utils";

const FREITAS_AUCTION_HOUSE_NAME = "Freitas Leiloeiro";
const FREITAS_BASE_URL = "https://www.freitasleiloeiro.com.br";

type FreitasStatusResponse = {
  success?: boolean;
  message?: {
    statusId?: number;
    nome?: string;
    recebeLance?: boolean;
    statusLeilaoId?: number;
  };
};

type FreitasUrlParts = {
  parsedUrl: URL;
  leilaoId: string;
  loteNumero: string;
  externalId: string;
};

type FreitasHtmlFetchResult = {
  html: string;
  statusCode?: number;
  contentType?: string;
  finalUrl: string;
};

function freitasStatusHeaders(originalUrl: string) {
  return {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
    Accept: "application/json,text/plain,*/*",
    "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
    Referer: originalUrl,
    Origin: FREITAS_BASE_URL
  };
}

function normalizeFreitasUrl(originalUrl: string): FreitasUrlParts {
  const parsedUrl = validateLotUrl(originalUrl);
  const hostname = parsedUrl.hostname.toLowerCase().replace(/^www\./, "");

  if (hostname !== "freitasleiloeiro.com.br") {
    throw new LotImportError("Este importador aceita apenas links do Freitas Leiloeiro.", "UNSUPPORTED_PROVIDER", 400, {
      hostname: parsedUrl.hostname
    });
  }

  const leilaoId = parsedUrl.searchParams.get("leilaoId")?.trim();
  const loteNumero = parsedUrl.searchParams.get("loteNumero")?.trim();

  if (!leilaoId || !loteNumero) {
    throw new LotImportError(
      "URL do Freitas invalida. Nao foi possivel identificar leilaoId ou loteNumero.",
      "LOT_NUMBER_NOT_FOUND",
      400,
      {
        url: parsedUrl.toString()
      }
    );
  }

  return {
    parsedUrl,
    leilaoId,
    loteNumero,
    externalId: `${leilaoId}-${loteNumero}`
  };
}

function freitasStatusEndpoint(leilaoId: string, loteNumero: string) {
  const params = new URLSearchParams({
    leilaoId,
    loteNumero
  });

  return `${FREITAS_BASE_URL}/Leiloes/RetornarLoteStatus?${params.toString()}`;
}

function freitasPhotosEndpoint(leilaoId: string, loteNumero: string) {
  const params = new URLSearchParams({
    leilaoId,
    loteNumero
  });

  return `${FREITAS_BASE_URL}/Leiloes/ListarFotosLote?${params.toString()}`;
}

function freitasHtmlHeaders(originalUrl: string) {
  return {
    ...freitasStatusHeaders(originalUrl),
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
  };
}

async function fetchFreitasHtml(url: string, originalUrl: string, logEvents = false): Promise<FreitasHtmlFetchResult> {
  if (logEvents) {
    console.log("[lot-import:freitas]", {
      event: "html_fetch_started",
      url
    });
  }

  try {
    const response = await fetchWithTimeout(url, {
      headers: freitasHtmlHeaders(originalUrl),
      redirect: "follow",
      cache: "no-store"
    });
    const html = await response.text();

    if (logEvents) {
      console.log("[lot-import:freitas]", {
        event: "html_response",
        status: response.status,
        contentType: response.headers.get("content-type")
      });
      console.log("[lot-import:freitas]", {
        event: "html_body_length",
        bodyLength: html.length
      });
    }

    if (!response.ok) {
      throw new LotImportError("O HTML do Freitas respondeu com erro.", "IMPORT_FAILED", 502, {
        status: response.status,
        contentType: response.headers.get("content-type")
      });
    }

    return {
      html,
      statusCode: response.status,
      contentType: response.headers.get("content-type") ?? undefined,
      finalUrl: response.url || url
    };
  } catch (error) {
    if (error instanceof LotImportError) {
      throw error;
    }

    if (isTlsCertificateError(error)) {
      return fetchFreitasHtmlIgnoringLocalCertificate(url, originalUrl, logEvents);
    }

    throw new LotImportError("Nao foi possivel acessar o HTML do lote no Freitas.", "CONNECTION_FAILED", 504, {
      url,
      cause: error instanceof Error ? error.message : "unknown"
    });
  }
}

function fetchFreitasHtmlIgnoringLocalCertificate(url: string, originalUrl: string, logEvents = false) {
  return new Promise<FreitasHtmlFetchResult>((resolve, reject) => {
    const request = httpsRequest(
      url,
      {
        method: "GET",
        rejectUnauthorized: false,
        headers: freitasHtmlHeaders(originalUrl),
        timeout: 12000
      },
      (response) => {
        let html = "";
        const contentType = typeof response.headers["content-type"] === "string" ? response.headers["content-type"] : undefined;

        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          html += chunk;
        });
        response.on("end", () => {
          if (logEvents) {
            console.log("[lot-import:freitas]", {
              event: "html_response",
              status: response.statusCode,
              contentType
            });
            console.log("[lot-import:freitas]", {
              event: "html_body_length",
              bodyLength: html.length
            });
          }

          if (!response.statusCode || response.statusCode < 200 || response.statusCode >= 300) {
            reject(
              new LotImportError("O HTML do Freitas respondeu com erro.", "IMPORT_FAILED", 502, {
                status: response.statusCode,
                contentType
              })
            );
            return;
          }

          resolve({
            html,
            statusCode: response.statusCode,
            contentType,
            finalUrl: url
          });
        });
      }
    );

    request.on("timeout", () => {
      request.destroy();
      reject(
        new LotImportError("Nao foi possivel acessar o HTML do lote no Freitas.", "CONNECTION_FAILED", 504, {
          url,
          cause: "timeout"
        })
      );
    });
    request.on("error", (error) => {
      reject(
        new LotImportError("Nao foi possivel acessar o HTML do lote no Freitas.", "CONNECTION_FAILED", 504, {
          url,
          cause: error.message
        })
      );
    });
    request.end();
  });
}

async function fetchFreitasStatus(endpoint: string, originalUrl: string): Promise<FreitasStatusResponse> {
  let response: Response;
  let bodyText = "";

  console.log("[lot-import:freitas]", {
    event: "status_endpoint_started",
    statusEndpoint: endpoint
  });

  try {
    response = await fetchWithTimeout(endpoint, {
      headers: freitasStatusHeaders(originalUrl),
      redirect: "follow",
      cache: "no-store"
    });

    bodyText = await response.text();

    console.log("[lot-import:freitas]", {
      event: "status_endpoint_response",
      status: response.status,
      contentType: response.headers.get("content-type")
    });

    console.log("[lot-import:freitas]", {
      event: "status_endpoint_body",
      bodyPreview: bodyText.slice(0, 1000)
    });

    if (!response.ok) {
      throw new LotImportError("O endpoint de status do Freitas respondeu com erro.", "IMPORT_FAILED", 502, {
        status: response.status,
        contentType: response.headers.get("content-type"),
        bodyText: bodyText.slice(0, 1000)
      });
    }

    let data: FreitasStatusResponse;
    try {
      data = JSON.parse(bodyText) as FreitasStatusResponse;
    } catch {
      throw new LotImportError("O Freitas retornou HTML em vez de JSON no endpoint de status.", "PARSE_FAILED", 502, {
        status: response.status,
        contentType: response.headers.get("content-type"),
        bodyText: bodyText.slice(0, 1000)
      });
    }

    console.log("[lot-import:freitas]", {
      event: "status_endpoint_json_parsed",
      data
    });

    if (data.success !== true) {
      throw new LotImportError("O endpoint de status do Freitas nao confirmou sucesso para este lote.", "LOT_DATA_NOT_FOUND", 422, {
        data
      });
    }

    return data;
  } catch (error) {
    if (error instanceof LotImportError) {
      console.error("[lot-import:freitas]", {
        event: "status_endpoint_failed",
        message: error.message,
        stack: error.stack
      });
      throw error;
    }

    if (isTlsCertificateError(error)) {
      return fetchFreitasStatusIgnoringLocalCertificate(endpoint, originalUrl);
    }

    console.error("[lot-import:freitas]", {
      event: "status_endpoint_failed",
      message: error instanceof Error ? error.message : "unknown",
      stack: error instanceof Error ? error.stack : undefined
    });

    throw new LotImportError("Nao foi possivel chamar o endpoint de status do Freitas.", "CONNECTION_FAILED", 504, {
      endpoint,
      cause: error instanceof Error ? error.message : "unknown"
    });
  }
}

function isTlsCertificateError(error: unknown) {
  const cause = error instanceof Error ? (error as Error & { cause?: unknown }).cause : undefined;
  const message = `${error instanceof Error ? error.message : ""} ${cause instanceof Error ? cause.message : ""}`;
  return /certificate|UNABLE_TO_VERIFY|SELF_SIGNED|CERT_/i.test(message);
}

function parseFreitasStatusBody(bodyText: string, status?: number, contentType?: string): FreitasStatusResponse {
  let data: FreitasStatusResponse;

  try {
    data = JSON.parse(bodyText) as FreitasStatusResponse;
  } catch {
    throw new LotImportError("O Freitas retornou HTML em vez de JSON no endpoint de status.", "PARSE_FAILED", 502, {
      status,
      contentType,
      bodyText: bodyText.slice(0, 1000)
    });
  }

  console.log("[lot-import:freitas]", {
    event: "status_endpoint_json_parsed",
    data
  });

  if (data.success !== true) {
    throw new LotImportError("O endpoint de status do Freitas nao confirmou sucesso para este lote.", "LOT_DATA_NOT_FOUND", 422, {
      data
    });
  }

  return data;
}

function fetchFreitasStatusIgnoringLocalCertificate(endpoint: string, originalUrl: string) {
  console.log("[lot-import:freitas]", {
    event: "status_endpoint_tls_fallback_started",
    statusEndpoint: endpoint
  });

  return new Promise<FreitasStatusResponse>((resolve, reject) => {
    const request = httpsRequest(
      endpoint,
      {
        method: "GET",
        rejectUnauthorized: false,
        headers: freitasStatusHeaders(originalUrl),
        timeout: 12000
      },
      (response) => {
        let bodyText = "";
        const contentType = typeof response.headers["content-type"] === "string" ? response.headers["content-type"] : undefined;

        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          bodyText += chunk;
        });
        response.on("end", () => {
          console.log("[lot-import:freitas]", {
            event: "status_endpoint_response",
            status: response.statusCode,
            contentType
          });

          console.log("[lot-import:freitas]", {
            event: "status_endpoint_body",
            bodyPreview: bodyText.slice(0, 1000)
          });

          if (!response.statusCode || response.statusCode < 200 || response.statusCode >= 300) {
            reject(
              new LotImportError("O endpoint de status do Freitas respondeu com erro.", "IMPORT_FAILED", 502, {
                status: response.statusCode,
                contentType,
                bodyText: bodyText.slice(0, 1000)
              })
            );
            return;
          }

          try {
            resolve(parseFreitasStatusBody(bodyText, response.statusCode, contentType));
          } catch (error) {
            reject(error);
          }
        });
      }
    );

    request.on("timeout", () => {
      request.destroy();
      reject(
        new LotImportError("Nao foi possivel chamar o endpoint de status do Freitas.", "CONNECTION_FAILED", 504, {
          endpoint,
          cause: "timeout"
        })
      );
    });
    request.on("error", (error) => {
      console.error("[lot-import:freitas]", {
        event: "status_endpoint_failed",
        message: error.message,
        stack: error.stack
      });
      reject(
        new LotImportError("Nao foi possivel chamar o endpoint de status do Freitas.", "CONNECTION_FAILED", 504, {
          endpoint,
          cause: error.message
        })
      );
    });
    request.end();
  });
}

function cleanHtmlText(value?: string | null) {
  return value
    ?.replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeVehicleTitle(value?: string) {
  return cleanHtmlText(value)
    ?.replace(/^\s*I\s*\/\s*/i, "")
    .replace(/\s+-\s+/, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractFirstMatch(html: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = html.match(pattern)?.[1];
    const cleaned = cleanHtmlText(match);
    if (cleaned) {
      return cleaned;
    }
  }

  return undefined;
}

function extractFreitasHeaderTitle(html: string) {
  const rawTitle = extractFirstMatch(html, [
    /fa-bookmark[\s\S]{0,300}?<\/i>\s*([^<]+?)\s*(?:&nbsp;)?\s*<\/div>/i,
    /<title[^>]*>\s*Lote:\s*\d+\s*-\s*([^|<]+?)(?:\||<\/title>)/i
  ]);

  return normalizeVehicleTitle(rawTitle);
}

function extractFreitasSubtitle(html: string) {
  return extractFirstMatch(html, [/<span[^>]*class=["'][^"']*fw-bold[^"']*small[^"']*["'][^>]*>([\s\S]{0,300}?)<\/span>/i]);
}

function extractValueAfterSmallLabel(html: string, label: string) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return extractFirstMatch(html, [new RegExp(`<small[^>]*>\\s*${escaped}\\s*<\\/small>[\\s\\S]{0,180}?<div[^>]*>([\\s\\S]{0,120}?)<\\/div>`, "i")]);
}

function extractFreitasDescription(html: string) {
  return extractFirstMatch(html, [
    /Descri[cç][aã]o completa:\s*<\/div>[\s\S]{0,500}?<div[^>]*text-align\s*:\s*justify[^>]*>([\s\S]{0,800}?)<\/div>/i,
    /Descri[cç][aã]o completa:[\s\S]{0,700}?<div[^>]*>([\s\S]{0,800}?)<\/div>/i
  ]);
}

function extractMoneyBeforeLabel(html: string, label: string) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const value = extractFirstMatch(html, [new RegExp(`(R\\$\\s*[\\d.,]+)[\\s\\S]{0,160}?<small[^>]*>\\s*${escaped}\\s*<\\/small>`, "i")]);
  return parseCurrency(value);
}

function parseFreitasAuctionDate(dateText?: string, timeText?: string) {
  const dateMatch = dateText?.match(/\b(\d{2})\/(\d{2})\/(\d{4})\b/);
  if (!dateMatch) {
    return undefined;
  }

  const [, day, month, year] = dateMatch;
  const timeMatch = timeText?.match(/\b(\d{2}):(\d{2})\b/);
  const hours = timeMatch?.[1] ?? "00";
  const minutes = timeMatch?.[2] ?? "00";
  const parsed = new Date(`${year}-${month}-${day}T${hours}:${minutes}:00-03:00`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function parseFreitasTitle(title?: string) {
  const titleMatch = title?.match(/^(.*?)\s*(?:-| )\s*(\d{4})\s*\/\s*(\d{4})\s*$/);
  const namePart = titleMatch?.[1]?.trim() ?? title;
  const tokens = namePart?.split(/\s+/).filter(Boolean) ?? [];

  return {
    brand: tokens[0],
    model: tokens[1],
    version: tokens.slice(2).join(" ") || undefined,
    manufacturingYear: titleMatch?.[2] ? Number(titleMatch[2]) : undefined,
    modelYear: titleMatch?.[3] ? Number(titleMatch[3]) : undefined,
    displayName:
      title && titleMatch
        ? `${namePart} ${titleMatch[2]}/${titleMatch[3]}`.trim()
        : title
  };
}

function parseFreitasSubtitle(subtitle?: string) {
  const [first, ...rest] = subtitle?.split(/\s*\/\s*/).map((item) => item.trim()).filter(Boolean) ?? [];
  const condition = rest.join("/") || undefined;
  const mountType = rest.find((item) => /monta/i.test(item));

  return {
    documentType: first,
    sellerName: first,
    condition,
    mountType
  };
}

function parseFreitasDescription(description?: string) {
  const plateOrFinal = description?.match(/PLACA\s*:\s*([^,]+)/i)?.[1]?.trim();
  const fuel = description?.match(/\b(GASOLINA|FLEX|DIESEL|ALCOOL|ETANOL|EL[EÉ]TRICO|HIBRIDO|H[IÍ]BRIDO)\b/i)?.[1]?.toUpperCase();
  const parts = description?.split(",").map((item) => item.trim()).filter(Boolean) ?? [];
  const colorCandidate = parts.at(-1)?.toUpperCase();
  const color = colorCandidate && !/PLACA|GASOLINA|FLEX|DIESEL|ALCOOL|ETANOL|EL[EÉ]TRICO|HIBRIDO|H[IÍ]BRIDO|\d{2}\/\d{2}/i.test(colorCandidate) ? colorCandidate : undefined;

  return {
    plateOrFinal,
    fuel,
    color
  };
}

function extractFreitasImageUrlsFromHtml(html: string, leilaoId: string) {
  const urls = new Set<string>();
  const pattern = new RegExp(`https?:\\/\\/cdn3\\.freitasleiloeiro\\.com\\.br\\/LEILOES\\/${leilaoId}\\/FOTOS\\/[^"'\\s<>]+?\\.(?:JPG|JPEG|PNG)`, "gi");

  for (const match of html.matchAll(pattern)) {
    urls.add(match[0].replace(/&amp;/gi, "&"));
  }

  return [...urls];
}

function buildFreitasPhotos(urls: string[]): ImportedLotPhoto[] {
  return urls.map((imageUrl, index) => ({
    imageUrl,
    thumbnailUrl: imageUrl,
    imageType: imageUrl.match(/\.(jpe?g|png)$/i)?.[1]?.toLowerCase(),
    sequenceNumber: index + 1,
    source: "freitas"
  }));
}

export function extractFreitasDataFromHtml(html: string, leilaoId: string, loteNumero: string, originalUrl: string): PartialVehicleImport & { title?: string } {
  const title = extractFreitasHeaderTitle(html);
  const titleData = parseFreitasTitle(title);
  const subtitle = extractFreitasSubtitle(html);
  const subtitleData = parseFreitasSubtitle(subtitle);
  const description = extractFreitasDescription(html);
  const descriptionData = parseFreitasDescription(description);
  const lotCode = extractValueAfterSmallLabel(html, "Lote") ?? loteNumero;
  const auctionDateText = extractValueAfterSmallLabel(html, "Data do Leilão") ?? extractValueAfterSmallLabel(html, "Data do Leilao");
  const auctionTimeText = extractValueAfterSmallLabel(html, "Horário") ?? extractValueAfterSmallLabel(html, "Horario");
  const auctionDate = parseFreitasAuctionDate(auctionDateText, auctionTimeText);
  const imageUrls = extractFreitasImageUrlsFromHtml(html, leilaoId);
  const photos = buildFreitasPhotos(imageUrls);

  return {
    lotUrl: originalUrl,
    lotCode,
    provider: "freitas",
    title,
    displayName: titleData.displayName,
    auctionHouseName: FREITAS_AUCTION_HOUSE_NAME,
    brand: titleData.brand,
    model: titleData.model,
    version: titleData.version,
    manufacturingYear: titleData.manufacturingYear,
    modelYear: titleData.modelYear,
    documentType: subtitleData.documentType,
    sellerName: subtitleData.sellerName,
    condition: subtitleData.condition,
    mountType: subtitleData.mountType,
    fuel: descriptionData.fuel,
    color: descriptionData.color,
    plateOrFinal: descriptionData.plateOrFinal,
    auctionDate,
    auctionDateText: auctionDateText && auctionTimeText ? `${auctionDateText} ${auctionTimeText}` : auctionDateText,
    currentBid: extractMoneyBeforeLabel(html, "Lance Inicial"),
    bidIncrement: extractMoneyBeforeLabel(html, "Incremento Mínimo") ?? extractMoneyBeforeLabel(html, "Incremento Minimo"),
    originalNotes: description,
    originalPhotoUrls: imageUrls,
    mainImageUrl: imageUrls[0],
    photos
  };
}

function countFoundFields(vehicleData: PartialVehicleImport) {
  return [
    vehicleData.displayName,
    vehicleData.brand,
    vehicleData.model,
    vehicleData.version,
    vehicleData.manufacturingYear,
    vehicleData.modelYear,
    vehicleData.documentType,
    vehicleData.condition,
    vehicleData.fuel,
    vehicleData.color,
    vehicleData.plateOrFinal,
    vehicleData.auctionDate,
    vehicleData.currentBid,
    vehicleData.bidIncrement,
    vehicleData.originalNotes,
    ...(vehicleData.originalPhotoUrls ?? [])
  ].filter(Boolean).length;
}

export class FreitasLotProvider {
  async import(originalUrl: string): Promise<LotImportResult> {
    console.log("[lot-import:freitas]", {
      event: "lot_import_started",
      originalUrl
    });

    const urlParts = normalizeFreitasUrl(originalUrl);

    console.log("[lot-import:freitas]", {
      event: "ids_extracted",
      leilaoId: urlParts.leilaoId,
      loteNumero: urlParts.loteNumero
    });

    const statusEndpoint = freitasStatusEndpoint(urlParts.leilaoId, urlParts.loteNumero);
    const data = await fetchFreitasStatus(statusEndpoint, urlParts.parsedUrl.toString());
    const statusName = data.message?.nome ?? "status nao informado";
    const recebeLance = data.message?.recebeLance === true;
    const description = `Lote importado do Freitas Leiloeiro. Status: ${statusName}. Recebe lance: ${recebeLance ? "Sim" : "Nao"}.`;
    let htmlFetch: FreitasHtmlFetchResult | undefined;
    let photosHtmlFetch: FreitasHtmlFetchResult | undefined;
    let htmlData: (PartialVehicleImport & { title?: string }) | undefined;

    try {
      htmlFetch = await fetchFreitasHtml(urlParts.parsedUrl.toString(), urlParts.parsedUrl.toString(), true);

      try {
        photosHtmlFetch = await fetchFreitasHtml(freitasPhotosEndpoint(urlParts.leilaoId, urlParts.loteNumero), urlParts.parsedUrl.toString());
      } catch (error) {
        console.warn("[lot-import:freitas]", {
          event: "photos_html_fetch_failed",
          message: error instanceof Error ? error.message : "unknown"
        });
      }

      htmlData = extractFreitasDataFromHtml(`${htmlFetch.html}\n${photosHtmlFetch?.html ?? ""}`, urlParts.leilaoId, urlParts.loteNumero, urlParts.parsedUrl.toString());

      console.log("[lot-import:freitas]", {
        event: "html_data_extracted",
        data: htmlData
      });
      console.log("[lot-import:freitas]", {
        event: "html_fields_found",
        count: countFoundFields(htmlData),
        fields: Object.entries(htmlData)
          .filter(([, value]) => (Array.isArray(value) ? value.length > 0 : Boolean(value)))
          .map(([key]) => key)
      });
      console.log("[lot-import:freitas]", {
        event: "cdn_images_found_in_html",
        count: htmlData.originalPhotoUrls?.length ?? 0
      });
    } catch (error) {
      console.warn("[lot-import:freitas]", {
        event: "html_extraction_failed",
        message: error instanceof Error ? error.message : "unknown"
      });
    }

    const minimalVehicleData: PartialVehicleImport & { title?: string } = {
      lotUrl: urlParts.parsedUrl.toString(),
      lotCode: urlParts.loteNumero,
      provider: "freitas",
      displayName: `Lote ${urlParts.loteNumero} - Freitas Leiloeiro`,
      title: `Lote ${urlParts.loteNumero} - Freitas Leiloeiro`,
      auctionHouseName: FREITAS_AUCTION_HOUSE_NAME,
      condition: statusName,
      saleStatus: statusName,
      originalNotes: description,
      originalPhotoUrls: [],
      photos: []
    };
    const hasHtmlData = Boolean(htmlData && countFoundFields(htmlData) > 0);
    const vehicleData: PartialVehicleImport & { title?: string } = {
      ...minimalVehicleData,
      ...(hasHtmlData ? htmlData : {}),
      lotUrl: urlParts.parsedUrl.toString(),
      lotCode: htmlData?.lotCode ?? urlParts.loteNumero,
      provider: "freitas",
      auctionHouseName: FREITAS_AUCTION_HOUSE_NAME,
      condition: htmlData?.condition ?? statusName,
      saleStatus: statusName,
      originalNotes: htmlData?.originalNotes ?? description,
      originalPhotoUrls: htmlData?.originalPhotoUrls ?? [],
      photos: htmlData?.photos ?? [],
      mainImageUrl: htmlData?.mainImageUrl
    };

    console.log("[lot-import:freitas]", {
      event: "vehicle_data_built",
      vehicleData
    });

    ensureImportedData(vehicleData, {
      requestedUrl: originalUrl,
      finalUrl: urlParts.parsedUrl.toString(),
      hostname: urlParts.parsedUrl.hostname,
        statusCode: 200,
        contentType: htmlFetch?.contentType ?? "application/json",
        description
      });

    const pendingFields = computePendingFields(vehicleData);
    const alerts = [
      hasHtmlData
        ? "Lote do Freitas importado pelo HTML da pagina de detalhes e complementado pelo endpoint de status."
        : "Importacao inicial do Freitas realizada apenas com o endpoint de status. Complete os dados do veiculo manualmente ate a extracao completa ser implementada."
    ];

    console.log("[lot-import:freitas]", {
      event: "pending_fields_computed",
      pendingFields
    });

    console.log("[lot-import:freitas]", {
      event: "import_preview_ready",
      lotCode: urlParts.loteNumero
    });

    return {
      status: "PARTIAL",
      provider: "freitas",
      vehicleData,
      rawJson: {
        requestedUrl: originalUrl,
        finalUrl: urlParts.parsedUrl.toString(),
        statusCode: 200,
        source: "freitas",
        sourceUrl: urlParts.parsedUrl.toString(),
        sourceMethod: hasHtmlData ? "freitas_html_lote_detalhes" : "freitas_status_endpoint",
        statusSourceMethod: "freitas_status_endpoint",
        imagesSourceMethod: photosHtmlFetch ? "freitas_listar_fotos_lote_html" : "freitas_html_lote_detalhes",
        auctionId: urlParts.leilaoId,
        lotCode: urlParts.loteNumero,
        externalId: urlParts.externalId,
        statusEndpoint,
        statusResponse: data,
        lotDetailsHtml: htmlFetch
          ? {
              finalUrl: htmlFetch.finalUrl,
              statusCode: htmlFetch.statusCode,
              contentType: htmlFetch.contentType,
              bodyLength: htmlFetch.html.length
            }
          : undefined,
        photosHtml: photosHtmlFetch
          ? {
              finalUrl: photosHtmlFetch.finalUrl,
              statusCode: photosHtmlFetch.statusCode,
              contentType: photosHtmlFetch.contentType,
              bodyLength: photosHtmlFetch.html.length
            }
          : undefined,
        extractedHtmlData: htmlData,
        photos: vehicleData.photos ?? [],
        images: vehicleData.originalPhotoUrls ?? []
      },
      alerts,
      pendingFields,
      context: {
        requestedUrl: originalUrl,
        finalUrl: urlParts.parsedUrl.toString(),
        hostname: urlParts.parsedUrl.hostname,
        statusCode: 200,
        contentType: htmlFetch?.contentType ?? "application/json",
        description
      }
    };
  }
}
