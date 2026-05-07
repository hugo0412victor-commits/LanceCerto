import { CopartLotProvider } from "@/lib/lot-importer/providers/copart-provider";
import { GenericLotProvider } from "@/lib/lot-importer/providers/generic-provider";
import type { LotImportResult } from "@/lib/lot-importer/types";
import { validateLotUrl } from "@/lib/lot-importer/utils";

export class LotImporter {
  private copart = new CopartLotProvider();
  private generic = new GenericLotProvider();

  async importFromUrl(url: string): Promise<LotImportResult> {
    const parsedUrl = validateLotUrl(url);
    const hostname = parsedUrl.hostname.toLowerCase();

    if (hostname.includes("copart.com.br")) {
      return this.copart.import(url);
    }

    return this.generic.import(url);
  }
}
