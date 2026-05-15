import type { ImportStatus } from "@/lib/prisma-enums";

export type LotImportErrorCode =
  | "INVALID_URL"
  | "UNSUPPORTED_PROVIDER"
  | "LOT_NUMBER_NOT_FOUND"
  | "COPART_STRUCTURED_FAILED"
  | "LOT_DATA_NOT_FOUND"
  | "LOT_IMAGES_NOT_FOUND"
  | "INCAPSULA_BLOCKED"
  | "ACCESS_BLOCKED"
  | "PARSE_FAILED"
  | "NETWORK_ERROR"
  | "DATA_NOT_FOUND"
  | "CONNECTION_FAILED"
  | "IMPORT_FAILED"
  | "UNKNOWN_ERROR";

export type LotImportProviderKey = "copart" | "freitas" | "sodre-santoro";

export type ImportedLotPhoto = {
  imageUrl: string;
  thumbnailUrl?: string;
  imageType?: string;
  sequenceNumber?: number;
  source: string;
};

export type PartialVehicleImport = {
  lotUrl: string;
  lotCode?: string;
  provider?: string;
  displayName?: string;
  auctionHouseName?: string;
  brand?: string;
  model?: string;
  version?: string;
  manufacturingYear?: number;
  modelYear?: number;
  armored?: boolean;
  fipeValue?: number;
  documentType?: string;
  documentTypeCode?: string;
  sellerName?: string;
  mountType?: string;
  damageDescription?: string;
  condition?: string;
  hasKey?: boolean;
  runningCondition?: boolean;
  category?: string;
  fuel?: string;
  transmission?: string;
  color?: string;
  mileage?: number;
  mileageUnit?: string;
  chassis?: string;
  chassisType?: string;
  plateOrFinal?: string;
  yard?: string;
  auctionYard?: string;
  vehicleYard?: string;
  yardNumber?: string;
  yardSpace?: string;
  yardSlot?: string;
  physicalYardNumber?: string;
  yardCode?: string;
  city?: string;
  state?: string;
  auctionDate?: Date;
  auctionDateText?: string;
  saleDateTimestamp?: string;
  sold?: boolean;
  saleStatus?: string;
  currentBid?: number;
  bidIncrement?: number;
  buyNowPrice?: number;
  highestBid?: number;
  myBid?: number;
  currency?: string;
  documentsUrl?: string;
  specificConditionsUrl?: string;
  mainImageUrl?: string;
  originalNotes?: string;
  originalPhotoUrls?: string[];
  photos?: ImportedLotPhoto[];
  runningConditionText?: string;
};

export type LotImportContext = {
  requestedUrl: string;
  finalUrl: string;
  hostname: string;
  title?: string;
  description?: string;
  statusCode?: number;
  contentType?: string;
  bodyLength?: number;
};

export type LotImportResult = {
  status: ImportStatus;
  provider: string;
  vehicleData: PartialVehicleImport;
  rawJson: Record<string, unknown>;
  alerts: string[];
  pendingFields: string[];
  errorMessage?: string;
  context?: LotImportContext;
};

export class LotImportError extends Error {
  constructor(
    message: string,
    public code: LotImportErrorCode,
    public httpStatus: number,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "LotImportError";
  }
}
