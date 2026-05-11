export function extractCopartLotNumber(input?: string | null) {
  const value = input?.trim();

  if (!value) {
    return undefined;
  }

  if (/^\d{5,}$/.test(value)) {
    return value;
  }

  const lotPathMatch = value.match(/(?:^|\/)lot\/(\d{5,})(?:[/?#]|$)/i);
  if (lotPathMatch?.[1]) {
    return lotPathMatch[1];
  }

  try {
    const normalizedUrl = value.startsWith("http") ? value : `https://${value.replace(/^\/+/, "www.copart.com.br/")}`;
    const parsed = new URL(normalizedUrl);

    if (!parsed.hostname.toLowerCase().includes("copart.com.br")) {
      return undefined;
    }

    return parsed.pathname.match(/\/lot\/(\d{5,})/i)?.[1];
  } catch {
    return undefined;
  }
}

export function isCopartLotUrl(input?: string | null) {
  const value = input?.trim();

  if (!value) {
    return false;
  }

  return /(?:^https?:\/\/)?(?:www\.)?copart\.com\.br\/lot\/\d{5,}(?:[/?#].*)?$/i.test(value) || /^\/lot\/\d{5,}(?:[/?#].*)?$/i.test(value);
}

export function buildCopartLotUrl(lotNumber: string) {
  return `https://www.copart.com.br/lot/${lotNumber}`;
}
