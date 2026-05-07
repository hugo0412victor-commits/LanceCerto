-- CreateEnum
CREATE TYPE "UserRoleCode" AS ENUM ('ADMIN', 'BUYER', 'FINANCE', 'OPERATIONS', 'SALES', 'PARTNER');

-- CreateEnum
CREATE TYPE "VehicleStatus" AS ENUM ('ANALISE_LOTE', 'ARREMATADO', 'AGUARDANDO_PAGAMENTO', 'PAGO', 'AGUARDANDO_RETIRADA', 'RETIRADO', 'VISTORIA_INICIAL', 'ORCAMENTO_REPAROS', 'MECANICA', 'FUNILARIA', 'PINTURA', 'ESTETICA', 'DOCUMENTACAO', 'PRECIFICACAO', 'FOTOS_ANUNCIO', 'ANUNCIADO', 'EM_NEGOCIACAO', 'VENDIDO', 'TRANSFERIDO', 'FINALIZADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('PENDING', 'SUCCESS', 'PARTIAL', 'FAILED');

-- CreateEnum
CREATE TYPE "DocumentCategory" AS ENUM ('NOTA_VENDA_LEILAO', 'COMPROVANTE_PAGAMENTO', 'GATEPASS', 'BOLETO', 'CRLV', 'ATPV_E', 'LAUDO_CAUTELAR', 'VISTORIA', 'ORCAMENTO', 'NF_PECA', 'NF_SERVICO', 'RECIBO', 'CONTRATO_VENDA', 'COMPROVANTE_TRANSFERENCIA', 'DOCUMENTO_PESSOAL', 'OUTROS');

-- CreateEnum
CREATE TYPE "PhotoCategory" AS ENUM ('ORIGINAIS_LEILAO', 'RETIRADA', 'ANTES_REPARO', 'DURANTE_REPARO', 'APOS_REPARO', 'ANUNCIO', 'OUTRAS');

-- CreateEnum
CREATE TYPE "ExpenseCategoryType" AS ENUM ('ARREMATE', 'COMISSAO_LEILAO', 'TAXA_ADMINISTRATIVA', 'PATIO', 'GUINCHO', 'DOCUMENTACAO', 'DESPACHANTE', 'IPVA', 'MULTAS', 'MECANICA', 'FUNILARIA', 'PINTURA', 'ESTETICA', 'HIGIENIZACAO', 'PECAS', 'ANUNCIOS', 'COMISSAO_VENDA', 'IMPOSTOS', 'TAXAS_BANCARIAS', 'JUROS', 'OUTROS');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PARTIAL', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('PIX', 'TRANSFER', 'CARD', 'CASH', 'BOLETO', 'OTHER');

-- CreateEnum
CREATE TYPE "StepExecutionStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'BLOCKED', 'DONE');

-- CreateEnum
CREATE TYPE "MarketSourceType" AS ENUM ('FIPE', 'WEBMOTORS', 'MOBIAUTO', 'OLX', 'MANUAL', 'OTHER');

-- CreateEnum
CREATE TYPE "SellerType" AS ENUM ('LOJISTA', 'PARTICULAR', 'LEILOEIRA', 'OUTRO');

-- CreateEnum
CREATE TYPE "AdPortal" AS ENUM ('OLX', 'WEBMOTORS', 'MOBIAUTO', 'INSTAGRAM', 'FACEBOOK_MARKETPLACE', 'OTHER');

-- CreateEnum
CREATE TYPE "AdStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'PAUSED', 'SOLD', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "LeadSource" AS ENUM ('WHATSAPP', 'INSTAGRAM', 'OLX', 'WEBMOTORS', 'MOBIAUTO', 'INDICACAO', 'MANUAL', 'OTHER');

-- CreateEnum
CREATE TYPE "LeadStage" AS ENUM ('NOVO', 'CONTATO', 'NEGOCIANDO', 'PROPOSTA', 'CONCLUIDO', 'PERDIDO');

-- CreateEnum
CREATE TYPE "CashFlowType" AS ENUM ('IN', 'OUT');

-- CreateEnum
CREATE TYPE "CashFlowStatus" AS ENUM ('PROJECTED', 'REALIZED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LiquidityLevel" AS ENUM ('HIGH', 'MEDIUM', 'LOW', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "AiAnalysisType" AS ENUM ('LOT_RISK', 'SALE_COPY', 'WHATSAPP_MESSAGE');

-- CreateEnum
CREATE TYPE "AiRiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "code" "UserRoleCode" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "permissions" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "phone" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "avatarUrl" TEXT,
    "roleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuctionHouse" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "website" TEXT,
    "importerKey" TEXT,
    "config" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuctionHouse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL,
    "stockCode" TEXT,
    "title" TEXT,
    "lotUrl" TEXT,
    "lotCode" TEXT,
    "auctionHouseId" TEXT,
    "createdById" TEXT,
    "status" "VehicleStatus" NOT NULL DEFAULT 'ANALISE_LOTE',
    "brand" TEXT,
    "model" TEXT,
    "version" TEXT,
    "manufacturingYear" INTEGER,
    "modelYear" INTEGER,
    "plate" TEXT,
    "plateFinal" TEXT,
    "chassis" TEXT,
    "chassisType" TEXT,
    "color" TEXT,
    "fuel" TEXT,
    "transmission" TEXT,
    "mileage" INTEGER,
    "documentType" TEXT,
    "mountType" TEXT,
    "condition" TEXT,
    "hasKey" BOOLEAN,
    "runningCondition" BOOLEAN,
    "yard" TEXT,
    "city" TEXT,
    "state" TEXT,
    "auctionDate" TIMESTAMP(3),
    "bidDate" TIMESTAMP(3),
    "fipeValue" DECIMAL(14,2),
    "marketEstimatedValue" DECIMAL(14,2),
    "bidValue" DECIMAL(14,2),
    "auctionCommission" DECIMAL(14,2),
    "administrativeFees" DECIMAL(14,2),
    "yardCost" DECIMAL(14,2),
    "towCost" DECIMAL(14,2),
    "documentationExpected" DECIMAL(14,2),
    "repairsExpected" DECIMAL(14,2),
    "totalPredictedCost" DECIMAL(14,2),
    "totalActualCost" DECIMAL(14,2),
    "predictedSalePrice" DECIMAL(14,2),
    "actualSalePrice" DECIMAL(14,2),
    "predictedProfit" DECIMAL(14,2),
    "actualProfit" DECIMAL(14,2),
    "predictedMargin" DECIMAL(7,2),
    "actualMargin" DECIMAL(7,2),
    "predictedRoi" DECIMAL(7,2),
    "actualRoi" DECIMAL(7,2),
    "minimumAcceptablePrice" DECIMAL(14,2),
    "maxRecommendedBid" DECIMAL(14,2),
    "snapshotConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "snapshotDate" TIMESTAMP(3),
    "completenessPercent" INTEGER NOT NULL DEFAULT 0,
    "pendingFields" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "alerts" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT,
    "rawMetadata" JSONB,
    "mainPhotoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LotSnapshot" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "auctionHouseId" TEXT,
    "sourceUrl" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "auctionHouseName" TEXT,
    "lotCode" TEXT,
    "brand" TEXT,
    "model" TEXT,
    "version" TEXT,
    "manufacturingYear" INTEGER,
    "modelYear" INTEGER,
    "informedFipe" DECIMAL(14,2),
    "documentType" TEXT,
    "mountType" TEXT,
    "condition" TEXT,
    "hasKey" BOOLEAN,
    "runningCondition" BOOLEAN,
    "fuel" TEXT,
    "transmission" TEXT,
    "color" TEXT,
    "mileage" INTEGER,
    "chassis" TEXT,
    "plateOrFinal" TEXT,
    "yard" TEXT,
    "city" TEXT,
    "state" TEXT,
    "auctionDate" TIMESTAMP(3),
    "originalNotes" TEXT,
    "photoUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "rawJson" JSONB,
    "importStatus" "ImportStatus" NOT NULL DEFAULT 'PENDING',
    "alerts" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "pendingFields" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LotSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehiclePhoto" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "uploadedById" TEXT,
    "category" "PhotoCategory" NOT NULL,
    "caption" TEXT,
    "storagePath" TEXT NOT NULL,
    "publicUrl" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "sourceUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehiclePhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleDocument" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "uploadedById" TEXT,
    "category" "DocumentCategory" NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "storagePath" TEXT NOT NULL,
    "publicUrl" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehicleDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseCategory" (
    "id" TEXT NOT NULL,
    "code" "ExpenseCategoryType" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpenseCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "supplierId" TEXT,
    "description" TEXT NOT NULL,
    "date" TIMESTAMP(3),
    "predictedAmount" DECIMAL(14,2),
    "actualAmount" DECIMAL(14,2),
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paymentMethod" "PaymentMethod",
    "dueDate" TIMESTAMP(3),
    "proofPath" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcessStep" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "color" TEXT,
    "defaultRoleCode" "UserRoleCode",
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProcessStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleProcess" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "processStepId" TEXT NOT NULL,
    "assignedToId" TEXT,
    "linkedExpenseId" TEXT,
    "status" "StepExecutionStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "dueDate" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,
    "attachments" JSONB,
    "delayAlert" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehicleProcess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Simulation" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT,
    "brand" TEXT,
    "model" TEXT,
    "version" TEXT,
    "year" INTEGER,
    "fipeValue" DECIMAL(14,2),
    "marketAverageValue" DECIMAL(14,2),
    "intendedBid" DECIMAL(14,2),
    "auctionCommission" DECIMAL(14,2),
    "administrativeFees" DECIMAL(14,2),
    "yardCost" DECIMAL(14,2),
    "towCost" DECIMAL(14,2),
    "documentationCost" DECIMAL(14,2),
    "estimatedRepairs" DECIMAL(14,2),
    "desiredMargin" DECIMAL(7,2),
    "predictedSalePrice" DECIMAL(14,2),
    "desiredDiscountOnFipe" DECIMAL(7,2),
    "estimatedSellingDays" INTEGER,
    "totalPredictedCost" DECIMAL(14,2),
    "predictedProfit" DECIMAL(14,2),
    "predictedMargin" DECIMAL(7,2),
    "predictedRoi" DECIMAL(7,2),
    "minimumSellingPrice" DECIMAL(14,2),
    "idealSellingPrice" DECIMAL(14,2),
    "aggressiveSellingPrice" DECIMAL(14,2),
    "recommendedMaxBid" DECIMAL(14,2),
    "recommendation" TEXT,
    "notes" TEXT,
    "savedAsVehicle" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Simulation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketSource" (
    "id" TEXT NOT NULL,
    "code" "MarketSourceType" NOT NULL,
    "name" TEXT NOT NULL,
    "website" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketResearch" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "researchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fipeValue" DECIMAL(14,2),
    "marketAverage" DECIMAL(14,2),
    "lowestPrice" DECIMAL(14,2),
    "highestPrice" DECIMAL(14,2),
    "listingsCount" INTEGER NOT NULL DEFAULT 0,
    "suggestedCompetitivePrice" DECIMAL(14,2),
    "suggestedAggressivePrice" DECIMAL(14,2),
    "suggestedIdealPrice" DECIMAL(14,2),
    "minimumAcceptablePrice" DECIMAL(14,2),
    "liquidityLevel" "LiquidityLevel" NOT NULL DEFAULT 'UNKNOWN',
    "notes" TEXT,
    "sourceStatus" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketResearch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketListing" (
    "id" TEXT NOT NULL,
    "marketResearchId" TEXT NOT NULL,
    "marketSourceId" TEXT,
    "source" "MarketSourceType" NOT NULL,
    "listingUrl" TEXT,
    "price" DECIMAL(14,2),
    "year" INTEGER,
    "version" TEXT,
    "mileage" INTEGER,
    "city" TEXT,
    "state" TEXT,
    "sellerType" "SellerType",
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sale" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "soldAt" TIMESTAMP(3),
    "listedPrice" DECIMAL(14,2),
    "soldPrice" DECIMAL(14,2),
    "discountGranted" DECIMAL(14,2),
    "buyerName" TEXT,
    "saleChannel" TEXT,
    "salesCommission" DECIMAL(14,2),
    "taxes" DECIMAL(14,2),
    "paymentMethod" "PaymentMethod",
    "notes" TEXT,
    "transferDate" TIMESTAMP(3),
    "transferStatus" TEXT,
    "documents" JSONB,
    "grossProfit" DECIMAL(14,2),
    "netProfit" DECIMAL(14,2),
    "netMargin" DECIMAL(7,2),
    "roi" DECIMAL(7,2),
    "daysToSale" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "document" TEXT,
    "address" TEXT,
    "category" TEXT NOT NULL,
    "notes" TEXT,
    "rating" INTEGER,
    "averageLeadTime" INTEGER,
    "averageCost" DECIMAL(14,2),
    "serviceCount" INTEGER NOT NULL DEFAULT 0,
    "totalPaid" DECIMAL(14,2),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Advertisement" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "portal" "AdPortal" NOT NULL,
    "listingUrl" TEXT,
    "publishedAt" TIMESTAMP(3),
    "listedPrice" DECIMAL(14,2),
    "status" "AdStatus" NOT NULL DEFAULT 'DRAFT',
    "receivedLeads" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "adCost" DECIMAL(14,2),
    "boostCost" DECIMAL(14,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Advertisement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT,
    "advertisementId" TEXT,
    "customerName" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "source" "LeadSource" NOT NULL DEFAULT 'MANUAL',
    "stage" "LeadStage" NOT NULL DEFAULT 'NOVO',
    "notes" TEXT,
    "conversationLog" JSONB,
    "lastContactAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashFlow" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT,
    "type" "CashFlowType" NOT NULL,
    "status" "CashFlowStatus" NOT NULL DEFAULT 'PROJECTED',
    "description" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "occurredAt" TIMESTAMP(3),
    "expectedAt" TIMESTAMP(3),
    "paymentMethod" "PaymentMethod",
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CashFlow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "beforeData" JSONB,
    "afterData" JSONB,
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "id" TEXT NOT NULL,
    "group" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "description" TEXT,
    "editable" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpportunityScore" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "classification" TEXT NOT NULL,
    "breakdown" JSONB NOT NULL,
    "weights" JSONB NOT NULL,
    "manualOverride" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpportunityScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiAnalysis" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "analysisType" "AiAnalysisType" NOT NULL,
    "input" JSONB NOT NULL,
    "output" JSONB NOT NULL,
    "summary" TEXT,
    "riskLevel" "AiRiskLevel",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Role_code_key" ON "Role"("code");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "AuctionHouse_name_key" ON "AuctionHouse"("name");

-- CreateIndex
CREATE UNIQUE INDEX "AuctionHouse_slug_key" ON "AuctionHouse"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_stockCode_key" ON "Vehicle"("stockCode");

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseCategory_code_key" ON "ExpenseCategory"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ProcessStep_slug_key" ON "ProcessStep"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleProcess_vehicleId_processStepId_key" ON "VehicleProcess"("vehicleId", "processStepId");

-- CreateIndex
CREATE UNIQUE INDEX "MarketSource_code_key" ON "MarketSource"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Sale_vehicleId_key" ON "Sale"("vehicleId");

-- CreateIndex
CREATE UNIQUE INDEX "Setting_key_key" ON "Setting"("key");

-- CreateIndex
CREATE UNIQUE INDEX "OpportunityScore_vehicleId_key" ON "OpportunityScore"("vehicleId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_auctionHouseId_fkey" FOREIGN KEY ("auctionHouseId") REFERENCES "AuctionHouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LotSnapshot" ADD CONSTRAINT "LotSnapshot_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LotSnapshot" ADD CONSTRAINT "LotSnapshot_auctionHouseId_fkey" FOREIGN KEY ("auctionHouseId") REFERENCES "AuctionHouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehiclePhoto" ADD CONSTRAINT "VehiclePhoto_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehiclePhoto" ADD CONSTRAINT "VehiclePhoto_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleDocument" ADD CONSTRAINT "VehicleDocument_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleDocument" ADD CONSTRAINT "VehicleDocument_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ExpenseCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleProcess" ADD CONSTRAINT "VehicleProcess_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleProcess" ADD CONSTRAINT "VehicleProcess_processStepId_fkey" FOREIGN KEY ("processStepId") REFERENCES "ProcessStep"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleProcess" ADD CONSTRAINT "VehicleProcess_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleProcess" ADD CONSTRAINT "VehicleProcess_linkedExpenseId_fkey" FOREIGN KEY ("linkedExpenseId") REFERENCES "Expense"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Simulation" ADD CONSTRAINT "Simulation_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketResearch" ADD CONSTRAINT "MarketResearch_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketListing" ADD CONSTRAINT "MarketListing_marketResearchId_fkey" FOREIGN KEY ("marketResearchId") REFERENCES "MarketResearch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketListing" ADD CONSTRAINT "MarketListing_marketSourceId_fkey" FOREIGN KEY ("marketSourceId") REFERENCES "MarketSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Advertisement" ADD CONSTRAINT "Advertisement_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_advertisementId_fkey" FOREIGN KEY ("advertisementId") REFERENCES "Advertisement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashFlow" ADD CONSTRAINT "CashFlow_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityScore" ADD CONSTRAINT "OpportunityScore_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiAnalysis" ADD CONSTRAINT "AiAnalysis_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
