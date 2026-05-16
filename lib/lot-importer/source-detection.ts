import { LotImportError, type LotImportProviderKey } from "@/lib/lot-importer/types";
import { validateLotUrl } from "@/lib/lot-importer/utils";

export type DetectedLotSource = {
  provider: LotImportProviderKey;
  parsedUrl: URL;
};

export function detectLotSource(url: string): DetectedLotSource {
  const parsedUrl = validateLotUrl(url);
  const hostname = parsedUrl.hostname.toLowerCase().replace(/^www\./, "");
  let provider: LotImportProviderKey | undefined;

  if (hostname === "copart.com.br" || hostname.endsWith(".copart.com.br") || hostname === "copart.com" || hostname.endsWith(".copart.com")) {
    provider = "copart";
    console.log("[lot-import:router]", {
      event: "source_detected",
      hostname,
      pathname: parsedUrl.pathname,
      provider
    });
    return {
      provider,
      parsedUrl
    };
  }

  if (hostname === "freitasleiloeiro.com.br" || hostname.endsWith(".freitasleiloeiro.com.br")) {
    provider = "freitas";
    console.log("[lot-import:router]", {
      event: "source_detected",
      hostname,
      pathname: parsedUrl.pathname,
      provider
    });
    return {
      provider,
      parsedUrl
    };
  }

  if (hostname === "sodresantoro.com.br" || hostname.endsWith(".sodresantoro.com.br")) {
    provider = "sodre-santoro";
    console.log("[lot-import:router]", {
      event: "source_detected",
      hostname,
      pathname: parsedUrl.pathname,
      provider
    });
    return {
      provider,
      parsedUrl
    };
  }

  throw new LotImportError("Fonte de leilão ainda não suportada.", "UNSUPPORTED_PROVIDER", 400, {
    hostname: parsedUrl.hostname,
    supportedProviders: ["copart", "freitas", "sodre-santoro"]
  });
}
