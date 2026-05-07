import { execFile } from "child_process";
import { promisify } from "util";
import { LiquidityLevel, MarketSourceType } from "@prisma/client";
import { findLocalBrowser } from "@/lib/lot-importer/utils";

type VehicleMarketContext = {
  brand?: string | null;
  model?: string | null;
  version?: string | null;
  modelYear?: number | null;
  fuel?: string | null;
  city?: string | null;
  state?: string | null;
  fipeValue?: number | null;
  minimumAcceptablePrice?: number | null;
  predictedSalePrice?: number | null;
};

export type AutomaticMarketListing = {
  source: MarketSourceType;
  listingUrl?: string;
  price: number;
  year?: number;
  version?: string;
  mileage?: number;
  city?: string;
  state?: string;
  notes?: string;
};

export type AutomaticMarketResearchResult = {
  marketAverage?: number;
  lowestPrice?: number;
  highestPrice?: number;
  listingsCount: number;
  suggestedCompetitivePrice?: number;
  suggestedAggressivePrice?: number;
  suggestedIdealPrice?: number;
  minimumAcceptablePrice?: number;
  liquidityLevel: LiquidityLevel;
  notes?: string;
  sourceStatus: Record<string, unknown>;
  listings: AutomaticMarketListing[];
  alerts: string[];
};

type SearchResult = {
  title: string;
  snippet: string;
  url: string;
};

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
  "Cache-Control": "no-cache",
  Pragma: "no-cache"
} as const;

const PRICE_MIN = 10000;
const PRICE_MAX = 500000;
const execFileAsync = promisify(execFile);

function escapePowerShellSingleQuoted(value: string) {
  return value.replace(/'/g, "''");
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeForSlug(value?: string | number | null) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function stripTags(value: string) {
  return normalizeWhitespace(value.replace(/<[^>]+>/g, " "));
}

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

function parseCurrencyValue(raw: string) {
  const normalized = raw.replace(/\./g, "").replace(",", ".").trim();
  const value = Number(normalized);
  return Number.isFinite(value) ? value : undefined;
}

function extractCurrencyValues(text: string) {
  const matches = [...text.matchAll(/R\$\s*([\d\.]+,\d{2})/gi)];
  const values = matches
    .map((match) => parseCurrencyValue(match[1]))
    .filter((value): value is number => Boolean(value && value >= PRICE_MIN && value <= PRICE_MAX));

  return [...new Set(values)].sort((a, b) => a - b);
}

function extractValueNearLabel(text: string, label: string) {
  const regex = new RegExp(`${label}[\\s\\S]{0,80}?R\\$\\s*([\\d\\.]+,\\d{2})`, "i");
  const match = text.match(regex);
  return match ? parseCurrencyValue(match[1]) : undefined;
}

function extractYear(text: string) {
  const match = text.match(/\b(19\d{2}|20\d{2})\b/);
  return match ? Number(match[1]) : undefined;
}

function extractMileage(text: string) {
  const match = text.match(/\b(\d{1,3}(?:\.\d{3})+|\d{2,6})\s*km\b/i);
  if (!match) return undefined;
  const mileage = Number(match[1].replace(/\./g, ""));
  return Number.isFinite(mileage) ? mileage : undefined;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function computeLiquidityLevel(total: number) {
  if (total >= 5) return LiquidityLevel.HIGH;
  if (total >= 2) return LiquidityLevel.MEDIUM;
  if (total >= 1) return LiquidityLevel.LOW;
  return LiquidityLevel.UNKNOWN;
}

async function fetchText(url: string, timeoutMs = 15000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      headers: BROWSER_HEADERS,
      signal: controller.signal,
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchTextWithBrowser(url: string, timeoutMs = 25000) {
  const browser = findLocalBrowser();

  if (!browser) {
    throw new Error("Nenhum navegador local compativel encontrado.");
  }

  const { stdout } = await execFileAsync(
    browser.path,
    [
      "--headless",
      "--disable-gpu",
      "--no-first-run",
      "--virtual-time-budget=35000",
      "--dump-dom",
      url
    ],
    {
      timeout: timeoutMs,
      maxBuffer: 12 * 1024 * 1024
    }
  );

  let html = stdout?.trim();

  if (!html || !html.includes("<html") || html.length < 5000) {
    const command = `& '${escapePowerShellSingleQuoted(browser.path)}' '--headless' '--disable-gpu' '--no-first-run' '--virtual-time-budget=35000' '--dump-dom' '${escapePowerShellSingleQuoted(url)}'`;
    const fallback = await execFileAsync(
      "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
      ["-Command", command],
      {
        timeout: timeoutMs,
        maxBuffer: 12 * 1024 * 1024
      }
    );

    html = fallback.stdout?.trim() || html;
  }

  if (!html || !html.includes("<html")) {
    throw new Error(`Navegador local nao retornou HTML utilizavel para ${url}.`);
  }

  return html;
}

async function fetchTextResilient(url: string, timeoutMs = 15000) {
  try {
    return await fetchText(url, timeoutMs);
  } catch {
    return await fetchTextWithBrowser(url);
  }
}

function normalizeDuckDuckGoUrl(rawUrl: string) {
  const decoded = decodeHtml(rawUrl);
  if (decoded.startsWith("//duckduckgo.com/l/?")) {
    const wrappedUrl = new URL(`https:${decoded}`);
    const target = wrappedUrl.searchParams.get("uddg");
    return target ? decodeURIComponent(target) : decoded;
  }

  if (decoded.startsWith("/l/?")) {
    const wrappedUrl = new URL(`https://duckduckgo.com${decoded}`);
    const target = wrappedUrl.searchParams.get("uddg");
    return target ? decodeURIComponent(target) : decoded;
  }

  return decoded;
}

async function searchDuckDuckGo(query: string) {
  const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  let html = "";

  try {
    html = await fetchText(searchUrl);
  } catch {
    html = await fetchTextWithBrowser(searchUrl);
  }

  const results: SearchResult[] = [];
  const pattern =
    /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]{0,1400}?(?:<a[^>]*class="result__snippet"[^>]*>|<div[^>]*class="result__snippet"[^>]*>)([\s\S]*?)<\/(?:a|div)>/gi;

  for (const match of html.matchAll(pattern)) {
    const url = normalizeDuckDuckGoUrl(match[1]);
    const title = stripTags(decodeHtml(match[2]));
    const snippet = stripTags(decodeHtml(match[3]));

    if (!url || !title) continue;
    results.push({ url, title, snippet });
    if (results.length >= 6) break;
  }

  return results;
}

function buildVehicleSearchTerms(context: VehicleMarketContext) {
  return [
    context.brand,
    context.model,
    context.version,
    context.modelYear,
    context.fuel
  ]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function getBaseModelSlug(model?: string | null) {
  const normalized = normalizeForSlug(model).replace(/-(seda|sedan|hatch|cross|sw4|coupe|cabine-dupla|cabine-simples).*$/i, "");
  return normalized || normalizeForSlug(model);
}

function detectBodySlug(context: VehicleMarketContext) {
  const text = `${context.model ?? ""} ${context.version ?? ""}`.toLowerCase();
  if (/\bseda\b|\bsedan\b/.test(text)) return "seda";
  if (/\bhatch\b/.test(text)) return "hatch";
  return undefined;
}

function detectEngineSlug(version?: string | null) {
  const match = version?.match(/\b(\d)\.(\d)\b/);
  return match ? `${match[1]}${match[2]}` : undefined;
}

function detectTrimSlug(version?: string | null) {
  const normalized = normalizeForSlug(version).replace(/^.*?(xls|xs|x|xl|xe|se|sx|ex|lx|lt|ltz|gl|gli|trend|comfortline|highline|sport|exclusive|touring|advance|sense|top)\b.*$/, "$1");
  return normalized && normalized !== normalizeForSlug(version) ? normalized : undefined;
}

function detectValveSlug(version?: string | null) {
  const match = normalizeForSlug(version).match(/\b(8v|16v|20v)\b/);
  return match?.[1];
}

function detectFuelSlug(fuel?: string | null) {
  const text = normalizeForSlug(fuel);
  if (text.includes("flex")) return "flex";
  if (text.includes("alcool") || text.includes("etanol")) return "alcool";
  if (text.includes("diesel")) return "diesel";
  if (text.includes("gasolina")) return "gasolina";
  return undefined;
}

function detectTransmissionSlug(context: VehicleMarketContext) {
  const text = `${context.version ?? ""}`.toLowerCase();
  if (/\b(at|automatic|automatica|cvt)\b/.test(text)) return "automatico";
  return "manual";
}

function buildOlxDirectUrl(context: VehicleMarketContext) {
  const brand = normalizeForSlug(context.brand);
  const model = getBaseModelSlug(context.model);
  const year = context.modelYear;
  const body = detectBodySlug(context);

  if (!brand || !model || !year) return undefined;

  const parts = [
    "https://www.olx.com.br/autos-e-pecas/carros-vans-e-utilitarios",
    brand,
    model,
    String(year)
  ];

  if (body) {
    parts.push(body);
  }

  return parts.join("/");
}

function buildWebmotorsCandidateUrls(context: VehicleMarketContext) {
  const brand = normalizeForSlug(context.brand);
  const model = getBaseModelSlug(context.model);
  const year = context.modelYear;
  const engine = detectEngineSlug(context.version);
  const trim = detectTrimSlug(context.version);
  const body = detectBodySlug(context) === "seda" ? "sedan" : detectBodySlug(context);
  const valves = detectValveSlug(context.version);
  const fuel = detectFuelSlug(context.fuel);
  const transmission = detectTransmissionSlug(context);
  const doors = "4p";

  if (!brand || !model || !year) return [];

  const candidates = [
    [engine, trim, body, valves, fuel, doors, transmission],
    [engine, trim, body, fuel, doors, transmission],
    [engine, trim, valves, fuel, doors, transmission],
    [engine, trim, fuel, doors, transmission]
  ]
    .map((parts) => parts.filter(Boolean).join("-"))
    .filter(Boolean)
    .map((slug) => `https://www.webmotors.com.br/tabela-fipe/carros/${brand}/${model}/${year}/${slug}`);

  return [...new Set(candidates)];
}

async function collectWebmotorsComparable(context: VehicleMarketContext) {
  const terms = buildVehicleSearchTerms(context);
  let candidateUrl: string | undefined;
  let candidateTitle = "";
  let candidateSnippet = "";
  let price: number | undefined;
  let notes = "Coleta automatica via busca publica da Webmotors.";

  for (const directUrl of buildWebmotorsCandidateUrls(context)) {
    try {
      const pageHtml = await fetchTextResilient(directUrl, 12000);
      const directPrice =
        extractValueNearLabel(pageHtml, "Webmotors") ??
        extractValueNearLabel(pageHtml, "Preço Webmotors") ??
        extractCurrencyValues(pageHtml).at(-1);

      if (directPrice) {
        candidateUrl = directUrl;
        price = directPrice;
        notes = "Preco medio identificado automaticamente na tabela publica da Webmotors.";
        break;
      }
    } catch {
      continue;
    }
  }

  if (!candidateUrl) {
    const results = await searchDuckDuckGo(`site:webmotors.com.br ${terms}`);
    const candidate = results.find((result) => /webmotors\.com\.br/i.test(result.url));

    if (!candidate) {
      return {
        listings: [] as AutomaticMarketListing[],
        status: {
          ok: false,
          query: terms,
          reason: "Nenhum resultado relevante encontrado na Webmotors."
        }
      };
    }

    candidateUrl = candidate.url;
    candidateTitle = candidate.title;
    candidateSnippet = candidate.snippet;
    price = extractValueNearLabel(candidate.snippet, "Webmotors") ?? extractCurrencyValues(candidate.snippet).at(-1);

    try {
      const pageHtml = await fetchTextResilient(candidate.url, 12000);
      price =
        extractValueNearLabel(pageHtml, "Webmotors") ??
        extractValueNearLabel(pageHtml, "Preço Webmotors") ??
        price ??
        extractCurrencyValues(pageHtml).at(-1);
    } catch (error) {
      notes = `Coleta automatica via busca publica da Webmotors. Leitura detalhada indisponivel: ${error instanceof Error ? error.message : "erro desconhecido"}.`;
    }
  }

  if (!price) {
    return {
      listings: [] as AutomaticMarketListing[],
      status: {
        ok: false,
        query: terms,
        url: candidateUrl,
        reason: "Resultado da Webmotors encontrado, mas sem preco legivel."
      }
    };
  }

  return {
    listings: [
      {
        source: MarketSourceType.WEBMOTORS,
        listingUrl: candidateUrl,
        price,
        year: extractYear(`${candidateTitle} ${candidateSnippet}`) ?? context.modelYear ?? undefined,
        version: context.version ?? candidateTitle,
        notes
      }
    ],
    status: {
      ok: true,
      query: terms,
      url: candidateUrl,
      title: candidateTitle || "Tabela Webmotors"
    }
  };
}

async function collectOlxComparables(context: VehicleMarketContext) {
  const terms = buildVehicleSearchTerms(context);
  const directUrl = buildOlxDirectUrl(context);
  const directListings: AutomaticMarketListing[] = [];

  if (directUrl) {
    try {
      const pageHtml = await fetchTextResilient(directUrl, 12000);
      const pagePrices = extractCurrencyValues(pageHtml).slice(0, 8);
      for (const price of pagePrices) {
        directListings.push({
          source: MarketSourceType.OLX,
          listingUrl: directUrl,
          price,
          year: context.modelYear ?? undefined,
          version: context.version ?? undefined,
          notes: "Preco identificado automaticamente na pagina publica de resultados da OLX."
        });
      }
    } catch {
      // Fall back to search-based strategy below.
    }
  }

  if (directListings.length > 0) {
    return {
      listings: directListings,
      status: {
        ok: true,
        query: terms,
        url: directUrl,
        resultCount: directListings.length
      }
    };
  }

  const results = await searchDuckDuckGo(`site:olx.com.br/autos-e-pecas/carros-vans-e-utilitarios ${terms}`);
  const olxResults = results.filter((result) => /olx\.com\.br/i.test(result.url)).slice(0, 3);

  if (olxResults.length === 0) {
    return {
      listings: [] as AutomaticMarketListing[],
      status: {
        ok: false,
        query: terms,
        reason: "Nenhum resultado relevante encontrado na OLX."
      }
    };
  }

  const listings: AutomaticMarketListing[] = [];

  for (const result of olxResults) {
    const snippetPrices = extractCurrencyValues(result.snippet);
    const contextYear = extractYear(`${result.title} ${result.snippet}`) ?? context.modelYear ?? undefined;
    const contextMileage = extractMileage(result.snippet);

    if (snippetPrices.length > 0) {
      for (const price of snippetPrices.slice(0, 4)) {
        listings.push({
          source: MarketSourceType.OLX,
          listingUrl: result.url,
          price,
          year: contextYear,
          mileage: contextMileage,
          version: context.version ?? result.title,
          notes: "Preco identificado a partir da listagem publica exibida na busca."
        });
      }
      continue;
    }

    try {
      const pageHtml = await fetchTextResilient(result.url, 10000);
      const pagePrices = extractCurrencyValues(pageHtml);

      if (pagePrices.length === 0) {
        continue;
      }

      listings.push({
        source: MarketSourceType.OLX,
        listingUrl: result.url,
        price: pagePrices[0],
        year: contextYear,
        mileage: contextMileage ?? extractMileage(pageHtml),
        version: context.version ?? result.title,
        notes: "Preco identificado automaticamente na pagina publica da OLX."
      });
    } catch {
      continue;
    }
  }

  const dedupedListings = listings
    .reduce<AutomaticMarketListing[]>((accumulator, listing) => {
      if (!accumulator.some((current) => current.source === listing.source && current.price === listing.price && current.listingUrl === listing.listingUrl)) {
        accumulator.push(listing);
      }
      return accumulator;
    }, [])
    .slice(0, 8);

  return {
    listings: dedupedListings,
    status: {
      ok: dedupedListings.length > 0,
      query: terms,
      urls: olxResults.map((result) => result.url),
      resultCount: dedupedListings.length
    }
  };
}

export async function runAutomaticMarketResearch(context: VehicleMarketContext): Promise<AutomaticMarketResearchResult> {
  const alerts: string[] = [];
  const listings: AutomaticMarketListing[] = [];
  const sourceStatus: Record<string, unknown> = {};

  try {
    const [webmotors, olx] = await Promise.all([collectWebmotorsComparable(context), collectOlxComparables(context)]);
    listings.push(...webmotors.listings, ...olx.listings);
    sourceStatus.webmotors = webmotors.status;
    sourceStatus.olx = olx.status;

    if (webmotors.listings.length === 0) {
      alerts.push("Webmotors sem preco legivel nesta tentativa.");
    }

    if (olx.listings.length === 0) {
      alerts.push("OLX sem comparaveis legiveis nesta tentativa.");
    }
  } catch (error) {
    alerts.push(`Falha ao consultar o mercado automaticamente: ${error instanceof Error ? error.message : "erro desconhecido"}.`);
  }

  const prices = listings.map((listing) => listing.price).filter((price) => price >= PRICE_MIN && price <= PRICE_MAX);
  const marketAverage = prices.length > 0 ? roundMoney(prices.reduce((total, price) => total + price, 0) / prices.length) : undefined;
  const lowestPrice = prices.length > 0 ? Math.min(...prices) : undefined;
  const highestPrice = prices.length > 0 ? Math.max(...prices) : undefined;
  const competitiveBase = marketAverage ?? context.predictedSalePrice ?? context.fipeValue ?? undefined;
  const suggestedCompetitivePrice = competitiveBase ? roundMoney(competitiveBase * 0.985) : undefined;
  const suggestedAggressivePrice = competitiveBase ? roundMoney(competitiveBase * 0.97) : undefined;
  const suggestedIdealPrice = context.predictedSalePrice ?? marketAverage ?? undefined;

  return {
    marketAverage,
    lowestPrice,
    highestPrice,
    listingsCount: prices.length,
    suggestedCompetitivePrice,
    suggestedAggressivePrice,
    suggestedIdealPrice,
    minimumAcceptablePrice: context.minimumAcceptablePrice ?? undefined,
    liquidityLevel: computeLiquidityLevel(prices.length),
    notes:
      prices.length > 0
        ? "Pesquisa automatica consolidada com referencias publicas da Webmotors e da OLX."
        : "Pesquisa automatica executada, mas sem comparaveis legiveis suficientes.",
    sourceStatus,
    listings,
    alerts
  };
}
