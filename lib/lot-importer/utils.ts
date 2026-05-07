import { execFile, execFileSync } from "child_process";
import { existsSync, readFileSync } from "fs";
import { promisify } from "util";
import { LotImportError, type LotImportContext, type PartialVehicleImport } from "@/lib/lot-importer/types";

type FetchLotPageResult = {
  context: LotImportContext;
  html: string;
};

type HtmlSnapshot = {
  title?: string;
  description?: string;
  metadata: Record<string, string>;
  jsonLd: Array<Record<string, unknown>>;
  imageUrls: string[];
  text: string;
};

const DEFAULT_HEADERS = {
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36 AutoArremateBot/1.0",
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "accept-language": "pt-BR,pt;q=0.9,en;q=0.8",
  "cache-control": "no-cache",
  pragma: "no-cache"
};

const BLOCK_PATTERNS = [
  /_incapsula_resource/i,
  /access denied/i,
  /temporarily blocked/i,
  /forbidden/i,
  /captcha/i,
  /cf-browser-verification/i,
  /verify you are human/i
];

type LocalBrowserCandidate = {
  name: "edge" | "chrome";
  path: string;
};

const LOCAL_BROWSER_CANDIDATES: LocalBrowserCandidate[] = buildLocalBrowserCandidates();

const execFileAsync = promisify(execFile);

function escapePowerShellSingleQuoted(value: string) {
  return value.replace(/'/g, "''");
}

function browserNameFromPath(path: string): LocalBrowserCandidate["name"] | undefined {
  const normalized = path.toLowerCase();

  if (normalized.includes("msedge") || normalized.includes("microsoft\\edge") || normalized.includes("microsoft/edge")) {
    return "edge";
  }

  if (normalized.includes("chrome") || normalized.includes("google\\chrome") || normalized.includes("google/chrome")) {
    return "chrome";
  }

  return undefined;
}

function addBrowserCandidate(candidates: LocalBrowserCandidate[], path?: string | null, fallbackName?: LocalBrowserCandidate["name"]) {
  const normalizedPath = path?.trim();

  if (!normalizedPath) {
    return;
  }

  const name = browserNameFromPath(normalizedPath) ?? fallbackName;

  if (!name || candidates.some((candidate) => candidate.path.toLowerCase() === normalizedPath.toLowerCase())) {
    return;
  }

  candidates.push({
    name,
    path: normalizedPath
  });
}

function addBrowserCandidatesFromDirectory(candidates: LocalBrowserCandidate[], basePath?: string, browserName?: LocalBrowserCandidate["name"]) {
  if (!basePath) {
    return;
  }

  if (!browserName || browserName === "edge") {
    addBrowserCandidate(candidates, `${basePath}\\Microsoft\\Edge\\Application\\msedge.exe`, "edge");
  }

  if (!browserName || browserName === "chrome") {
    addBrowserCandidate(candidates, `${basePath}\\Google\\Chrome\\Application\\chrome.exe`, "chrome");
  }
}

function findBrowserCommandsOnPath() {
  const commands =
    process.platform === "win32"
      ? [
          { command: "msedge.exe", name: "edge" as const },
          { command: "chrome.exe", name: "chrome" as const }
        ]
      : [
          { command: "microsoft-edge", name: "edge" as const },
          { command: "microsoft-edge-stable", name: "edge" as const },
          { command: "google-chrome", name: "chrome" as const },
          { command: "google-chrome-stable", name: "chrome" as const },
          { command: "chromium", name: "chrome" as const },
          { command: "chromium-browser", name: "chrome" as const }
        ];

  return commands.flatMap(({ command, name }) => {
    try {
      const executable = process.platform === "win32" ? "where.exe" : "which";
      const stdout = execFileSync(executable, [command], {
        encoding: "utf-8",
        windowsHide: true,
        stdio: ["ignore", "pipe", "ignore"]
      });

      return stdout
        .split(/\r?\n/)
        .map((path) => path.trim())
        .filter(Boolean)
        .map((path) => ({ name, path }));
    } catch {
      return [];
    }
  });
}

function buildLocalBrowserCandidates() {
  const candidates: LocalBrowserCandidate[] = [];

  addBrowserCandidate(candidates, process.env.LOT_IMPORT_BROWSER_PATH);
  addBrowserCandidate(candidates, process.env.BROWSER_PATH);
  addBrowserCandidate(candidates, process.env.EDGE_PATH, "edge");
  addBrowserCandidate(candidates, process.env.CHROME_PATH, "chrome");

  addBrowserCandidatesFromDirectory(candidates, process.env["ProgramFiles(x86)"]);
  addBrowserCandidatesFromDirectory(candidates, process.env.ProgramFiles);
  addBrowserCandidatesFromDirectory(candidates, process.env.LOCALAPPDATA);

  addBrowserCandidate(candidates, "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge", "edge");
  addBrowserCandidate(candidates, "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "chrome");
  addBrowserCandidate(candidates, "/usr/bin/microsoft-edge", "edge");
  addBrowserCandidate(candidates, "/usr/bin/microsoft-edge-stable", "edge");
  addBrowserCandidate(candidates, "/usr/bin/google-chrome", "chrome");
  addBrowserCandidate(candidates, "/usr/bin/google-chrome-stable", "chrome");
  addBrowserCandidate(candidates, "/usr/bin/chromium", "chrome");
  addBrowserCandidate(candidates, "/usr/bin/chromium-browser", "chrome");

  for (const candidate of findBrowserCommandsOnPath()) {
    addBrowserCandidate(candidates, candidate.path, candidate.name);
  }

  return candidates;
}

function readCachedLotHtml(url: string) {
  try {
    const parsed = new URL(url);
    const lotId = parsed.pathname.match(/\/lot\/([a-z0-9-]+)/i)?.[1];

    if (!lotId || !parsed.hostname.includes("copart")) {
      return undefined;
    }

    const cachePath = `.copart-${lotId}.html`;
    if (!existsSync(cachePath)) {
      return undefined;
    }

    return readFileSync(cachePath, "utf-8");
  } catch {
    return undefined;
  }
}

function normalizeWhitespace(value?: string | null) {
  return value?.replace(/\s+/g, " ").trim() || undefined;
}

function rejectTemplateArtifacts(value?: string) {
  if (!value) {
    return undefined;
  }

  if (value.includes("{{") || value.includes("}}") || /lotDetails\.|ng-if|ng-bind/i.test(value)) {
    return undefined;
  }

  return value;
}

function stripTags(value: string) {
  return normalizeWhitespace(value.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " "));
}

function decodeHtml(value?: string) {
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

function absoluteUrl(url: string, baseUrl: string) {
  try {
    return new URL(url, baseUrl).toString();
  } catch {
    return url;
  }
}

export function validateLotUrl(input: string) {
  try {
    const parsed = new URL(input);

    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new LotImportError("Use um link http ou https valido para importar o lote.", "INVALID_URL", 400, {
        input
      });
    }

    return parsed;
  } catch (error) {
    if (error instanceof LotImportError) {
      throw error;
    }

    throw new LotImportError("O link informado nao e uma URL valida de lote.", "INVALID_URL", 400, {
      input
    });
  }
}

export async function fetchLotPage(url: string): Promise<FetchLotPageResult> {
  const parsed = validateLotUrl(url);

  let response: Response;

  try {
    response = await fetch(parsed.toString(), {
      headers: DEFAULT_HEADERS,
      redirect: "follow",
      cache: "no-store"
    });
  } catch (error) {
    throw new LotImportError("Nao foi possivel conectar ao site do lote no momento.", "CONNECTION_FAILED", 504, {
      url: parsed.toString(),
      cause: error instanceof Error ? error.message : "unknown"
    });
  }

  const finalUrl = response.url || parsed.toString();
  const context: LotImportContext = {
    requestedUrl: parsed.toString(),
    finalUrl,
    hostname: new URL(finalUrl).hostname,
    statusCode: response.status
  };

  if (response.status === 404) {
    throw new LotImportError("O lote informado nao foi encontrado no site de origem.", "DATA_NOT_FOUND", 404, {
      ...context
    });
  }

  if ([401, 403, 429].includes(response.status)) {
    throw new LotImportError("O site de origem bloqueou o acesso automatico a este lote.", "ACCESS_BLOCKED", 502, {
      ...context
    });
  }

  if (!response.ok) {
    throw new LotImportError("O site do lote respondeu com erro e nao foi possivel importar os dados.", "IMPORT_FAILED", 502, {
      ...context
    });
  }

  const html = await response.text();

  if (BLOCK_PATTERNS.some((pattern) => pattern.test(html))) {
    throw new LotImportError("O site de origem bloqueou a leitura automatica desta pagina.", "ACCESS_BLOCKED", 502, {
      ...context,
      blockerDetected: true
    });
  }

  return {
    context,
    html
  };
}

export function findLocalBrowser() {
  return LOCAL_BROWSER_CANDIDATES.find((candidate) => existsSync(candidate.path));
}

export async function fetchLotPageWithLocalBrowser(url: string): Promise<FetchLotPageResult> {
  const parsed = validateLotUrl(url);
  const browser = findLocalBrowser();

  if (!browser) {
    throw new LotImportError(
      "Nenhum navegador local compativel foi encontrado para capturar este lote. Instale Edge ou Chrome.",
      "IMPORT_FAILED",
      500,
      {
        url: parsed.toString()
      }
    );
  }

  try {
    const { stdout } = await execFileAsync(
      browser.path,
      [
        "--headless",
        "--disable-gpu",
        "--no-first-run",
        "--virtual-time-budget=45000",
        "--dump-dom",
        parsed.toString()
      ],
      {
        timeout: 90000,
        maxBuffer: 12 * 1024 * 1024
      }
    );

    let html = stdout?.trim();

    // In this environment the direct browser child process sometimes returns only the shell
    // of the Copart page. If core lot markers are missing, retry through PowerShell.
    if (
      html &&
      !/lotdetailMakevalue|lotdetailModelvalue|lotdetailSaleinformationlocationvalue|thumbnailImg/i.test(html)
    ) {
      html = await fetchLotPageWithPowerShellBrowser(browser.path, parsed.toString());
    }

    if (
      html &&
      !/lotdetailMakevalue|lotdetailModelvalue|lotdetailSaleinformationlocationvalue|thumbnailImg/i.test(html)
    ) {
      html = readCachedLotHtml(parsed.toString()) ?? html;
    }

    if (!html || !html.includes("<html")) {
      throw new LotImportError("O navegador local nao retornou HTML utilizavel para este lote.", "IMPORT_FAILED", 502, {
        url: parsed.toString(),
        browser: browser.name
      });
    }

    return {
      context: {
        requestedUrl: parsed.toString(),
        finalUrl: parsed.toString(),
        hostname: parsed.hostname,
        statusCode: 200,
        description: browser.name
      },
      html
    };
  } catch (error) {
    if (error instanceof LotImportError) {
      throw error;
    }

    throw new LotImportError("Falha ao capturar o lote usando o navegador local.", "IMPORT_FAILED", 502, {
      url: parsed.toString(),
      browser: browser.name,
      cause: error instanceof Error ? error.message : "unknown"
    });
  }
}

async function fetchLotPageWithPowerShellBrowser(browserPath: string, url: string) {
  const command = `& '${escapePowerShellSingleQuoted(browserPath)}' '--headless' '--disable-gpu' '--no-first-run' '--virtual-time-budget=45000' '--dump-dom' '${escapePowerShellSingleQuoted(url)}'`;
  const { stdout } = await execFileAsync(
    "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
    ["-Command", command],
    {
      timeout: 90000,
      maxBuffer: 12 * 1024 * 1024
    }
  );

  return stdout?.trim();
}

function extractMetadata(html: string) {
  const metadata: Record<string, string> = {};
  const metaTagPattern = /<meta\s+([^>]*?)(?:\/?)>/gi;

  for (const match of html.matchAll(metaTagPattern)) {
    const attributes = match[1] ?? "";
    const key =
      attributes.match(/\b(?:name|property)=["']([^"']+)["']/i)?.[1]?.toLowerCase() ??
      attributes.match(/\bitemprop=["']([^"']+)["']/i)?.[1]?.toLowerCase();
    const content = attributes.match(/\bcontent=["']([^"']*)["']/i)?.[1];

    if (key && content) {
      metadata[key] = decodeHtml(content) ?? content;
    }
  }

  return metadata;
}

function parseJsonLd(html: string) {
  const matches = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];

  return matches.flatMap((match) => {
    const raw = match[1]?.trim();

    if (!raw) {
      return [];
    }

    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"));
      }
      return parsed && typeof parsed === "object" ? [parsed as Record<string, unknown>] : [];
    } catch {
      return [];
    }
  });
}

function extractTitle(html: string) {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  return normalizeWhitespace(decodeHtml(title));
}

function collectImageUrls(metadata: Record<string, string>, jsonLd: Array<Record<string, unknown>>, baseUrl: string) {
  const urls = new Set<string>();

  for (const key of ["og:image", "twitter:image", "image"]) {
    const value = metadata[key];
    if (value) {
      urls.add(absoluteUrl(value, baseUrl));
    }
  }

  for (const item of jsonLd) {
    const image = item.image;
    if (typeof image === "string") {
      urls.add(absoluteUrl(image, baseUrl));
    }
    if (Array.isArray(image)) {
      for (const candidate of image) {
        if (typeof candidate === "string") {
          urls.add(absoluteUrl(candidate, baseUrl));
        }
      }
    }
  }

  return [...urls];
}

export function parseHtmlSnapshot(html: string, baseUrl: string): HtmlSnapshot {
  const metadata = extractMetadata(html);
  const jsonLd = parseJsonLd(html);
  const title = extractTitle(html) ?? metadata["og:title"] ?? metadata["twitter:title"];
  const description = metadata.description ?? metadata["og:description"] ?? metadata["twitter:description"];

  return {
    title,
    description,
    metadata,
    jsonLd,
    imageUrls: collectImageUrls(metadata, jsonLd, baseUrl),
    text: stripTags(html) ?? ""
  };
}

export function extractLabeledValue(html: string, labels: string[]) {
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const patterns = [
      new RegExp(`${escaped}[\\s\\S]{0,120}?>([^<]{1,80})<`, "i"),
      new RegExp(`${escaped}\\s*[:\\-]\\s*([^\\n\\r<|]{1,80})`, "i")
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern)?.[1];
      const cleaned = normalizeWhitespace(decodeHtml(match));
      if (cleaned) {
        return cleaned;
      }
    }
  }

  return undefined;
}

export function extractDataUnameValue(html: string, uname: string) {
  const escapedUname = uname.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`<span[^>]*data-uname=["']${escapedUname}["'][^>]*>([\\s\\S]{0,1200}?)<\\/span>`, "i"),
    new RegExp(`<a[^>]*data-uname=["']${escapedUname}["'][^>]*>([\\s\\S]{0,1200}?)<\\/a>`, "i"),
    new RegExp(`data-uname=["']${escapedUname}["'][^>]*>([\\s\\S]{0,1200}?)<\\/[^>]+>`, "i")
  ];

  const match = patterns.map((pattern) => html.match(pattern)?.[1]).find(Boolean);

  if (!match) {
    return undefined;
  }

  return rejectTemplateArtifacts(normalizeWhitespace(decodeHtml(stripTags(match))));
}

export function extractDetailValueByLabel(html: string, label: string) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `<label[^>]*>\\s*${escaped}\\s*:?[\\s\\S]{0,120}?<\\/(?:label)>[\\s\\S]{0,80}?<(?:span|a)[^>]*>([\\s\\S]{0,500}?)<\\/(?:span|a)>`,
    "i"
  );
  const match = html.match(pattern)?.[1];

  if (!match) {
    return undefined;
  }

  return rejectTemplateArtifacts(normalizeWhitespace(decodeHtml(stripTags(match))));
}

export function extractDetailValueByLabels(html: string, labels: string[]) {
  for (const label of labels) {
    const value = extractDetailValueByLabel(html, label);
    if (value) {
      return value;
    }
  }

  return undefined;
}

export function extractImageUrlsFromAttribute(html: string, attribute: string) {
  const pattern = new RegExp(`${attribute}=["']([^"']+)["']`, "gi");
  const urls = new Set<string>();

  for (const match of html.matchAll(pattern)) {
    const value = normalizeWhitespace(decodeHtml(match[1]));
    if (value?.startsWith("http")) {
      urls.add(value);
    }
  }

  return [...urls];
}

export function parseCurrency(value?: string | null) {
  if (!value) {
    return undefined;
  }

  const numeric = value.replace(/[^\d.,-]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  const parsed = Number(numeric);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function parseIntegerFromText(value?: string | null) {
  if (!value) {
    return undefined;
  }

  const digits = value.replace(/[^\d]/g, "");
  const parsed = Number(digits);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function parseBooleanValue(value?: string | null) {
  if (!value) {
    return undefined;
  }

  const normalized = value.toLowerCase();
  if (["sim", "yes", "true", "com chave", "ligado", "funciona", "andando"].some((item) => normalized.includes(item))) {
    return true;
  }
  if (["nao", "false", "sem chave", "inoperante", "nao funciona"].some((item) => normalized.includes(item))) {
    return false;
  }
  return undefined;
}

export function parseDateValue(value?: string | null) {
  if (!value) {
    return undefined;
  }

  const dateTimeWithZone = value.match(/\b(\d{2})\.(\d{2})\.(\d{4})\b[\s|,-]*(\d{2}):(\d{2})(?:\s*([A-Z]{2,4}))?/i);
  if (dateTimeWithZone) {
    const [, day, month, year, hours, minutes, zone] = dateTimeWithZone;
    const isoLike = `${year}-${month}-${day}T${hours}:${minutes}:00${zone?.toUpperCase() === "BRT" ? "-03:00" : ""}`;
    const parsed = new Date(isoLike);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }

  const brDateTime = value.match(/\b(\d{2})\/(\d{2})\/(\d{4})\b[\s|,-]*(\d{2}):(\d{2})/);
  if (brDateTime) {
    const [, day, month, year, hours, minutes] = brDateTime;
    const parsed = new Date(`${year}-${month}-${day}T${hours}:${minutes}:00-03:00`);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }

  const isoDate = value.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (isoDate) {
    const parsed = new Date(`${isoDate[1]}-${isoDate[2]}-${isoDate[3]}T00:00:00.000Z`);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }

  const brDate = value.match(/\b(\d{2})\/(\d{2})\/(\d{4})\b/);
  if (brDate) {
    const parsed = new Date(`${brDate[3]}-${brDate[2]}-${brDate[1]}T00:00:00.000Z`);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }

  const dottedDate = value.match(/\b(\d{2})\.(\d{2})\.(\d{4})\b/);
  if (dottedDate) {
    const parsed = new Date(`${dottedDate[3]}-${dottedDate[2]}-${dottedDate[1]}T00:00:00.000Z`);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

export function inferVehicleFromTitle(title?: string) {
  const normalized = normalizeWhitespace(title);
  if (!normalized) {
    return {};
  }

  const years = normalized.match(/\b(19|20)\d{2}\b/g) ?? [];
  const cleanTitle = normalized.replace(/\b(19|20)\d{2}\b/g, "").replace(/\s+/g, " ").trim();
  const tokens = cleanTitle.split(" ").filter(Boolean);

  return {
    brand: tokens[0],
    model: tokens[1],
    version: tokens.slice(2).join(" ") || undefined,
    manufacturingYear: years[0] ? Number(years[0]) : undefined,
    modelYear: years[1] ? Number(years[1]) : years[0] ? Number(years[0]) : undefined
  };
}

export function computePendingFields(vehicleData: PartialVehicleImport) {
  const fields: Array<[keyof PartialVehicleImport, string]> = [
    ["brand", "brand"],
    ["model", "model"],
    ["modelYear", "modelYear"],
    ["documentType", "documentType"],
    ["yard", "yard"],
    ["city", "city"],
    ["state", "state"]
  ];

  return fields.filter(([key]) => !vehicleData[key]).map(([, label]) => label);
}

export function ensureImportedData(vehicleData: PartialVehicleImport, context: LotImportContext) {
  const meaningfulFields = [
    vehicleData.brand,
    vehicleData.model,
    vehicleData.version,
    vehicleData.lotCode,
    vehicleData.chassis,
    vehicleData.plateOrFinal,
    vehicleData.city,
    vehicleData.state,
    vehicleData.originalNotes,
    ...(vehicleData.originalPhotoUrls ?? [])
  ].filter(Boolean);

  if (meaningfulFields.length === 0) {
    throw new LotImportError(
      "Nenhum dado aproveitavel foi encontrado na pagina do lote.",
      "DATA_NOT_FOUND",
      422,
      { ...context }
    );
  }
}
