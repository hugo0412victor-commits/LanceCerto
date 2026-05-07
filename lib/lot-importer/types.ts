import type { ImportStatus } from "@/lib/prisma-enums";

export type LotImportErrorCode =
  | "INVALID_URL"
  | "ACCESS_BLOCKED"
  | "DATA_NOT_FOUND"
  | "CONNECTION_FAILED"
  | "IMPORT_FAILED";

export type PartialVehicleImport = {
  lotUrl: string;
  lotCode?: string;
  auctionHouseName?: string;
  brand?: string;
  model?: string;
  version?: string;
  manufacturingYear?: number;
  modelYear?: number;
  fipeValue?: number;
  documentType?: string;
  mountType?: string;
  condition?: string;
  hasKey?: boolean;
  runningCondition?: boolean;
  fuel?: string;
  transmission?: string;
  color?: string;
  mileage?: number;
  chassis?: string;
  chassisType?: string;
  plateOrFinal?: string;
  yard?: string;
  city?: string;
  state?: string;
  auctionDate?: Date;
  auctionDateText?: string;
  originalNotes?: string;
  originalPhotoUrls?: string[];
  runningConditionText?: string;
};

export type LotImportContext = {
  requestedUrl: string;
  finalUrl: string;
  hostname: string;
  title?: string;
  description?: string;
  statusCode?: number;
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
