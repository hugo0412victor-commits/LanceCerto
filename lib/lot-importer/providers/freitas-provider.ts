import { request as httpsRequest } from "https";
import { LotImportError, type LotImportResult } from "@/lib/lot-importer/types";
import { computePendingFields, ensureImportedData, fetchWithTimeout, validateLotUrl } from "@/lib/lot-importer/utils";

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

async function fetchFreitasStatus(endpoint: string, originalUrl: string): Promise<FreitasStatusResponse> {
  let response: Response;
  let bodyText = "";

  console.log("[lot-import:freitas]", {
    event: "status_endpoint_started",
    endpoint
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
      bodyText: bodyText.slice(0, 1000)
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
    console.error("[lot-import:freitas]", {
      event: "status_endpoint_failed",
      error
    });

    if (error instanceof LotImportError) {
      throw error;
    }

    if (isTlsCertificateError(error)) {
      return fetchFreitasStatusIgnoringLocalCertificate(endpoint, originalUrl);
    }

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
    endpoint
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
            bodyText: bodyText.slice(0, 1000)
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
        error
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

    const endpoint = freitasStatusEndpoint(urlParts.leilaoId, urlParts.loteNumero);
    const data = await fetchFreitasStatus(endpoint, urlParts.parsedUrl.toString());
    const statusName = data.message?.nome ?? "status nao informado";
    const description = `Lote importado do Freitas Leiloeiro. Status: ${statusName}`;

    const vehicleData = {
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

    ensureImportedData(vehicleData, {
      requestedUrl: originalUrl,
      finalUrl: urlParts.parsedUrl.toString(),
      hostname: urlParts.parsedUrl.hostname,
      statusCode: 200,
      contentType: "application/json",
      description
    });

    const pendingFields = computePendingFields(vehicleData);
    const alerts = [
      "Importacao inicial do Freitas realizada apenas pelo endpoint de status. Complete os dados do lote manualmente ou aguarde extracao completa."
    ];

    console.log("[lot-import:freitas]", {
      event: "import_preview_ready",
      lotNumber: urlParts.loteNumero,
      pendingFields,
      photosCount: 0
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
        sourceMethod: "freitas_status_endpoint",
        auctionId: urlParts.leilaoId,
        lotCode: urlParts.loteNumero,
        externalId: urlParts.externalId,
        statusEndpoint: data,
        photos: [],
        images: []
      },
      alerts,
      pendingFields,
      context: {
        requestedUrl: originalUrl,
        finalUrl: urlParts.parsedUrl.toString(),
        hostname: urlParts.parsedUrl.hostname,
        statusCode: 200,
        contentType: "application/json",
        description
      }
    };
  }
}
