-- Financial ledger architecture.
-- Additive migration only: no destructive rewrite and no mutation of legacy finance tables.

CREATE TYPE "FinancialEntryType" AS ENUM ('IN', 'OUT', 'TRANSFER', 'ADJUSTMENT');
CREATE TYPE "FinancialEntryStatus" AS ENUM ('PENDING', 'PAID', 'RECEIVED', 'OVERDUE', 'PARTIAL', 'CANCELLED');
CREATE TYPE "FinancialEntrySourceType" AS ENUM ('EXPENSE', 'VEHICLE_CORE_COST', 'SALE', 'CASHFLOW_LEGACY', 'MANUAL', 'SYSTEM');
CREATE TYPE "FinancialCategoryType" AS ENUM ('INCOME', 'EXPENSE', 'TRANSFER', 'ADJUSTMENT');
CREATE TYPE "FinancialCategoryScope" AS ENUM ('VEHICLE', 'OPERATIONAL', 'SALE', 'COMMISSION', 'TAX', 'OTHER');
CREATE TYPE "PayablePriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');
CREATE TYPE "FinancialAccountType" AS ENUM ('CASH', 'CHECKING', 'SAVINGS', 'CREDIT', 'OTHER');
CREATE TYPE "PartnerType" AS ENUM ('BUYER', 'SELLER', 'DISPATCHER', 'MECHANIC', 'BODY_SHOP', 'PHOTOGRAPHER', 'INTERMEDIARY', 'CONSULTANT', 'OTHER');

CREATE TABLE "FinancialCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "FinancialCategoryType" NOT NULL,
    "scope" "FinancialCategoryScope" NOT NULL DEFAULT 'OTHER',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "legacyExpenseCategoryCode" "ExpenseCategoryType",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FinancialCategory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FinancialSubcategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FinancialSubcategory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FinancialAccount" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "FinancialAccountType" NOT NULL DEFAULT 'CHECKING',
    "openingBalance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "currentBalance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FinancialAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FinancialPartner" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "PartnerType" NOT NULL DEFAULT 'OTHER',
    "document" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FinancialPartner_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FinancialEntry" (
    "id" TEXT NOT NULL,
    "type" "FinancialEntryType" NOT NULL,
    "status" "FinancialEntryStatus" NOT NULL DEFAULT 'PENDING',
    "sourceType" "FinancialEntrySourceType" NOT NULL DEFAULT 'MANUAL',
    "sourceId" TEXT NOT NULL,
    "legacyReference" TEXT,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "paidAmount" DECIMAL(14,2),
    "categoryId" TEXT,
    "subcategoryId" TEXT,
    "accountId" TEXT,
    "vehicleId" TEXT,
    "supplierId" TEXT,
    "partnerId" TEXT,
    "customerName" TEXT,
    "dueDate" TIMESTAMP(3),
    "competenceDate" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "paymentMethod" "PaymentMethod",
    "notes" TEXT,
    "attachmentUrl" TEXT,
    "isLegacy" BOOLEAN NOT NULL DEFAULT false,
    "isAnomalous" BOOLEAN NOT NULL DEFAULT false,
    "validatedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FinancialEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Payable" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "supplierId" TEXT,
    "vehicleId" TEXT,
    "amount" DECIMAL(14,2) NOT NULL,
    "paidAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "dueDate" TIMESTAMP(3),
    "status" "FinancialEntryStatus" NOT NULL DEFAULT 'PENDING',
    "priority" "PayablePriority" NOT NULL DEFAULT 'NORMAL',
    "recurrence" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Payable_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Receivable" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "vehicleId" TEXT,
    "saleId" TEXT,
    "customerName" TEXT,
    "amount" DECIMAL(14,2) NOT NULL,
    "receivedAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "dueDate" TIMESTAMP(3),
    "status" "FinancialEntryStatus" NOT NULL DEFAULT 'PENDING',
    "installmentNumber" INTEGER,
    "totalInstallments" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Receivable_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VehicleFinancialSummary" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "purchaseAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "auctionFees" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "transportCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "documentationCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "repairCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "sellingCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "pendingExpenses" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "expectedSalePrice" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "actualSalePrice" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "receivedAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "receivableBalance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "grossProfit" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "netProfit" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "marginPercent" DECIMAL(7,2) NOT NULL DEFAULT 0,
    "roiPercent" DECIMAL(7,2) NOT NULL DEFAULT 0,
    "financialStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "VehicleFinancialSummary_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PartnerCommission" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT,
    "vehicleId" TEXT,
    "saleId" TEXT,
    "amount" DECIMAL(14,2) NOT NULL,
    "dueDate" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "status" "FinancialEntryStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PartnerCommission_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FinancialCategory_name_type_scope_key" ON "FinancialCategory"("name", "type", "scope");
CREATE UNIQUE INDEX "FinancialSubcategory_categoryId_name_key" ON "FinancialSubcategory"("categoryId", "name");
CREATE UNIQUE INDEX "FinancialEntry_sourceType_sourceId_key" ON "FinancialEntry"("sourceType", "sourceId");
CREATE INDEX "FinancialEntry_vehicleId_idx" ON "FinancialEntry"("vehicleId");
CREATE INDEX "FinancialEntry_type_status_idx" ON "FinancialEntry"("type", "status");
CREATE INDEX "FinancialEntry_dueDate_idx" ON "FinancialEntry"("dueDate");
CREATE INDEX "FinancialEntry_competenceDate_idx" ON "FinancialEntry"("competenceDate");
CREATE UNIQUE INDEX "Payable_transactionId_key" ON "Payable"("transactionId");
CREATE UNIQUE INDEX "Receivable_transactionId_key" ON "Receivable"("transactionId");
CREATE UNIQUE INDEX "VehicleFinancialSummary_vehicleId_key" ON "VehicleFinancialSummary"("vehicleId");

ALTER TABLE "FinancialSubcategory" ADD CONSTRAINT "FinancialSubcategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "FinancialCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FinancialEntry" ADD CONSTRAINT "FinancialEntry_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "FinancialCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FinancialEntry" ADD CONSTRAINT "FinancialEntry_subcategoryId_fkey" FOREIGN KEY ("subcategoryId") REFERENCES "FinancialSubcategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FinancialEntry" ADD CONSTRAINT "FinancialEntry_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "FinancialAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FinancialEntry" ADD CONSTRAINT "FinancialEntry_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FinancialEntry" ADD CONSTRAINT "FinancialEntry_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FinancialEntry" ADD CONSTRAINT "FinancialEntry_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "FinancialPartner"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FinancialEntry" ADD CONSTRAINT "FinancialEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Payable" ADD CONSTRAINT "Payable_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "FinancialEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Payable" ADD CONSTRAINT "Payable_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Payable" ADD CONSTRAINT "Payable_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Receivable" ADD CONSTRAINT "Receivable_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "FinancialEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Receivable" ADD CONSTRAINT "Receivable_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Receivable" ADD CONSTRAINT "Receivable_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "VehicleFinancialSummary" ADD CONSTRAINT "VehicleFinancialSummary_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PartnerCommission" ADD CONSTRAINT "PartnerCommission_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "FinancialPartner"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PartnerCommission" ADD CONSTRAINT "PartnerCommission_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PartnerCommission" ADD CONSTRAINT "PartnerCommission_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE SET NULL ON UPDATE CASCADE;
