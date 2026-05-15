import { CopartLotProvider } from "@/lib/lot-importer/providers/copart-provider";
import { FreitasLotProvider } from "@/lib/lot-importer/providers/freitas-provider";
import { GenericLotProvider } from "@/lib/lot-importer/providers/generic-provider";
import { SodreLotProvider } from "@/lib/lot-importer/providers/sodre-provider";
import { detectLotSource } from "@/lib/lot-importer/source-detection";
import type { LotImportResult } from "@/lib/lot-importer/types";

export class LotImporter {
  private copart = new CopartLotProvider();
  private freitas = new FreitasLotProvider();
  private sodre = new SodreLotProvider();
  private generic = new GenericLotProvider();

  async importFromUrl(url: string): Promise<LotImportResult> {
    const source = detectLotSource(url);

    console.log("[lot-import:router]", {
      event: "source_detected",
      hostname: source.parsedUrl.hostname,
      provider: source.provider,
      pathname: source.parsedUrl.pathname
    });
    console.log(`[lot-import:router] provider: ${source.provider}`);

    if (source.provider === "copart") {
      console.log("[lot-import:router]", { event: "provider_selected", provider: "copart" });
      return this.copart.import(url);
    }

    if (source.provider === "freitas") {
      console.log("[lot-import:router]", { event: "provider_selected", provider: "freitas" });
      return this.freitas.import(url);
    }

    if (source.provider === "sodre-santoro") {
      console.log("[lot-import:router]", { event: "provider_selected", provider: "sodre-santoro" });
      return this.sodre.import(url);
    }

    console.log("[lot-import:router]", { event: "provider_selected", provider: "generic" });
    return this.generic.import(url);
  }
}
