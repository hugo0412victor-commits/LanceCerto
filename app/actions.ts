"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AiAnalysisType, AiRiskLevel, LiquidityLevel, MarketSourceType, PaymentMethod, PaymentStatus, Prisma, SellerType, StepExecutionStatus, VehicleStatus } from "@prisma/client";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { calculateVehicleFinancials, calculateRecommendedBid, deriveLotAnalysisViability, LOT_ANALYSIS_DEFAULTS } from "@/lib/calculations";
import { generateLotRiskAnalysis } from "@/lib/ai";
import { calculateOpportunityScore } from "@/lib/scoring";
import { INITIAL_INSPECTION_ITEMS, getInitialInspectionSummary } from "@/lib/inspection";
import { VEHICLE_STATUS_LABELS } from "@/lib/constants";
import { parseBoolean, parseDate, parseInteger, parseNumber } from "@/lib/utils";

function detectPendingVehicleFields(data: {
  brand?: string;
  model?: string;
  modelYear?: number;
  documentType?: string;
  hasKey?: boolean;
  runningCondition?: boolean;
  bidValue?: number;
  predictedSalePrice?: number;
}) {
  const pending: string[] = [];

  if (!data.brand) pending.push("brand");
  if (!data.model) pending.push("model");
  if (!data.modelYear) pending.push("modelYear");
  if (!data.documentType) pending.push("documentType");
  if (data.hasKey === undefined) pending.push("hasKey");
  if (data.runningCondition === undefined) pending.push("runningCondition");
  if (!data.bidValue) pending.push("bidValue");
  if (!data.predictedSalePrice) pending.push("predictedSalePrice");

  return pending;
}

function normalizeMoneyValue(value?: number) {
  return value !== undefined ? new Prisma.Decimal(value) : undefined;
}

export async function saveVehicleAction(formData: FormData) {
  const session = await getServerAuthSession();
  const vehicleId = String(formData.get("id") ?? "").trim();

  const payload = {
    stockCode: String(formData.get("stockCode") ?? "").trim() || undefined,
    lotUrl: String(formData.get("lotUrl") ?? "").trim() || undefined,
    lotCode: String(formData.get("lotCode") ?? "").trim() || undefined,
    auctionHouseId: String(formData.get("auctionHouseId") ?? "").trim() || undefined,
    status: (String(formData.get("status") ?? VehicleStatus.ANALISE_LOTE) as VehicleStatus) || VehicleStatus.ANALISE_LOTE,
    brand: String(formData.get("brand") ?? "").trim() || undefined,
    model: String(formData.get("model") ?? "").trim() || undefined,
    version: String(formData.get("version") ?? "").trim() || undefined,
    manufacturingYear: parseInteger(formData.get("manufacturingYear")),
    modelYear: parseInteger(formData.get("modelYear")),
    plate: String(formData.get("plate") ?? "").trim() || undefined,
    plateFinal: String(formData.get("plateFinal") ?? "").trim() || undefined,
    chassis: String(formData.get("chassis") ?? "").trim() || undefined,
    chassisType: String(formData.get("chassisType") ?? "").trim() || undefined,
    color: String(formData.get("color") ?? "").trim() || undefined,
    fuel: String(formData.get("fuel") ?? "").trim() || undefined,
    transmission: String(formData.get("transmission") ?? "").trim() || undefined,
    mileage: parseInteger(formData.get("mileage")),
    documentType: String(formData.get("documentType") ?? "").trim() || undefined,
    mountType: String(formData.get("mountType") ?? "").trim() || undefined,
    condition: String(formData.get("condition") ?? "").trim() || undefined,
    hasKey: parseBoolean(formData.get("hasKey")),
    runningCondition: parseBoolean(formData.get("runningCondition")),
    yard: String(formData.get("yard") ?? "").trim() || undefined,
    city: String(formData.get("city") ?? "").trim() || undefined,
    state: String(formData.get("state") ?? "").trim() || undefined,
    auctionDate: parseDate(formData.get("auctionDate")),
    bidDate: parseDate(formData.get("bidDate")),
    fipeValue: parseNumber(formData.get("fipeValue")),
    marketEstimatedValue: parseNumber(formData.get("marketEstimatedValue")),
    bidValue: parseNumber(formData.get("bidValue")),
    auctionCommission: parseNumber(formData.get("auctionCommission")),
    administrativeFees: parseNumber(formData.get("administrativeFees")),
    yardCost: parseNumber(formData.get("yardCost")),
    towCost: parseNumber(formData.get("towCost")),
    documentationExpected: parseNumber(formData.get("documentationExpected")),
    repairsExpected: parseNumber(formData.get("repairsExpected")),
    predictedSalePrice: parseNumber(formData.get("predictedSalePrice")),
    snapshotConfirmed: parseBoolean(formData.get("snapshotConfirmed")) ?? false,
    snapshotDate: parseDate(formData.get("snapshotDate")),
    notes: String(formData.get("notes") ?? "").trim() || undefined
  };

  const viability = deriveLotAnalysisViability({
    fipeValue: payload.fipeValue,
    marketValue: payload.marketEstimatedValue,
    bidValue: payload.bidValue,
    auctionCommission: payload.auctionCommission,
    administrativeFees: payload.administrativeFees,
    documentationCost: payload.documentationExpected,
    predictedSalePrice: payload.predictedSalePrice
  });

  const normalizedPayload = {
    ...payload,
    bidValue: viability.bidValue,
    auctionCommission: viability.auctionCommission,
    administrativeFees: viability.administrativeFees,
    documentationExpected: viability.documentationCost,
    predictedSalePrice: viability.predictedSalePrice
  };

  const calculations = calculateVehicleFinancials({
    fipeValue: normalizedPayload.fipeValue,
    marketValue: normalizedPayload.marketEstimatedValue,
    bidValue: normalizedPayload.bidValue,
    auctionCommission: normalizedPayload.auctionCommission,
    administrativeFees: normalizedPayload.administrativeFees,
    yardCost: normalizedPayload.yardCost,
    towCost: normalizedPayload.towCost,
    documentationCost: normalizedPayload.documentationExpected,
    repairCost: normalizedPayload.repairsExpected,
    predictedSalePrice: normalizedPayload.predictedSalePrice,
    desiredMarginPercent: LOT_ANALYSIS_DEFAULTS.desiredMarginPercent
  });

  const pendingFields = detectPendingVehicleFields(normalizedPayload);
  const maxBidSet = calculateRecommendedBid({
    predictedSalePrice: normalizedPayload.predictedSalePrice ?? normalizedPayload.marketEstimatedValue ?? normalizedPayload.fipeValue,
    desiredMarginPercent: LOT_ANALYSIS_DEFAULTS.desiredMarginPercent,
    extraCosts:
      (normalizedPayload.auctionCommission ?? 0) +
      (normalizedPayload.administrativeFees ?? 0) +
      (normalizedPayload.yardCost ?? 0) +
      (normalizedPayload.towCost ?? 0) +
      (normalizedPayload.documentationExpected ?? 0) +
      (normalizedPayload.repairsExpected ?? 0),
    riskFactor: pendingFields.length > 2 ? 1.08 : 1
  });

  const data = {
    ...normalizedPayload,
    fipeValue: normalizeMoneyValue(normalizedPayload.fipeValue ?? undefined),
    marketEstimatedValue: normalizeMoneyValue(normalizedPayload.marketEstimatedValue ?? undefined),
    bidValue: normalizeMoneyValue(normalizedPayload.bidValue ?? undefined),
    auctionCommission: normalizeMoneyValue(normalizedPayload.auctionCommission ?? undefined),
    administrativeFees: normalizeMoneyValue(normalizedPayload.administrativeFees ?? undefined),
    yardCost: normalizeMoneyValue(normalizedPayload.yardCost ?? undefined),
    towCost: normalizeMoneyValue(normalizedPayload.towCost ?? undefined),
    documentationExpected: normalizeMoneyValue(normalizedPayload.documentationExpected ?? undefined),
    repairsExpected: normalizeMoneyValue(normalizedPayload.repairsExpected ?? undefined),
    predictedSalePrice: normalizeMoneyValue(normalizedPayload.predictedSalePrice ?? undefined),
    totalPredictedCost: normalizeMoneyValue(calculations.totalPredictedCost ?? undefined),
    totalActualCost: normalizeMoneyValue(calculations.totalActualCost ?? undefined),
    predictedProfit: normalizeMoneyValue(calculations.predictedProfit ?? undefined),
    predictedMargin: normalizeMoneyValue(calculations.predictedMargin ?? undefined),
    predictedRoi: normalizeMoneyValue(calculations.predictedRoi ?? undefined),
    minimumAcceptablePrice: normalizeMoneyValue(calculations.priceMinimum ?? undefined),
    maxRecommendedBid: normalizeMoneyValue(maxBidSet.moderate ?? undefined),
    snapshotConfirmed: payload.snapshotConfirmed,
    snapshotDate: payload.snapshotDate,
    completenessPercent: Math.max(10, 100 - pendingFields.length * 12),
    pendingFields,
    alerts:
      [
        ...(pendingFields.length > 0
          ? ["Cadastro salvo com pendencias. Complete as informacoes faltantes quando estiverem disponiveis."]
          : []),
        ...viability.assumptionsSummary
      ]
  };

  const savedVehicle = vehicleId
    ? await prisma.vehicle.update({
        where: { id: vehicleId },
        data
      })
    : await prisma.vehicle.create({
        data: {
          ...data,
          createdById: session?.user.id
        }
      });

  const score = calculateOpportunityScore({
    discountToFipePercent:
      normalizedPayload.fipeValue && normalizedPayload.bidValue ? ((normalizedPayload.fipeValue - normalizedPayload.bidValue) / normalizedPayload.fipeValue) * 100 : 0,
    projectedMarginPercent: calculations.predictedMargin,
    repairEaseScore:
      normalizedPayload.repairsExpected && normalizedPayload.fipeValue
        ? Math.max(20, 100 - (normalizedPayload.repairsExpected / normalizedPayload.fipeValue) * 100)
        : 60,
    liquidityScore: normalizedPayload.marketEstimatedValue ? 78 : 52,
    documentaryRiskScore: pendingFields.includes("documentType") ? 75 : 35,
    estimatedSaleTimeScore: pendingFields.length > 2 ? 45 : 72
  });

  await prisma.opportunityScore.upsert({
    where: {
      vehicleId: savedVehicle.id
    },
    update: {
      score: score.score,
      classification: score.classification,
      breakdown: score.breakdown as never,
      weights: score.weights as never,
      manualOverride: false
    },
    create: {
      vehicleId: savedVehicle.id,
      score: score.score,
      classification: score.classification,
      breakdown: score.breakdown as never,
      weights: score.weights as never
    }
  });

  const ai = generateLotRiskAnalysis({
    brand: payload.brand,
    model: normalizedPayload.model,
    version: normalizedPayload.version,
    manufacturingYear: normalizedPayload.manufacturingYear,
    modelYear: normalizedPayload.modelYear,
    condition: normalizedPayload.condition,
    documentType: normalizedPayload.documentType,
    mountType: normalizedPayload.mountType,
    mileage: normalizedPayload.mileage,
    hasKey: normalizedPayload.hasKey,
    runningCondition: normalizedPayload.runningCondition,
    notes: normalizedPayload.notes,
    fipeValue: normalizedPayload.fipeValue,
    marketEstimatedValue: normalizedPayload.marketEstimatedValue,
    bidValue: normalizedPayload.bidValue,
    auctionCommission: normalizedPayload.auctionCommission,
    administrativeFees: normalizedPayload.administrativeFees,
    yardCost: normalizedPayload.yardCost,
    towCost: normalizedPayload.towCost,
    documentationExpected: normalizedPayload.documentationExpected,
    repairsExpected: normalizedPayload.repairsExpected,
    predictedSalePrice: normalizedPayload.predictedSalePrice
  });

  await prisma.aiAnalysis.create({
    data: {
      vehicleId: savedVehicle.id,
      analysisType: AiAnalysisType.LOT_RISK,
      input: payload as never,
      output: ai as never,
      summary: ai.summary,
      riskLevel: ai.riskLevel as AiRiskLevel
    }
  });

  await createAuditLog({
    userId: session?.user.id,
    entityType: "Vehicle",
    entityId: savedVehicle.id,
    action: vehicleId ? "UPDATE" : "CREATE",
    afterData: data,
    message: vehicleId ? "Veiculo atualizado" : "Veiculo criado"
  });

  if (!vehicleId && payload.lotUrl) {
    await prisma.lotSnapshot.create({
      data: {
        vehicleId: savedVehicle.id,
        auctionHouseId: payload.auctionHouseId,
        sourceUrl: payload.lotUrl,
        auctionHouseName:
          (await prisma.auctionHouse.findUnique({ where: { id: payload.auctionHouseId } }))?.name ?? undefined,
        lotCode: payload.lotCode,
        brand: payload.brand,
        model: payload.model,
        version: payload.version,
        manufacturingYear: payload.manufacturingYear,
        modelYear: payload.modelYear,
        informedFipe: normalizeMoneyValue(payload.fipeValue ?? undefined),
        documentType: payload.documentType,
        mountType: payload.mountType,
        condition: payload.condition,
        hasKey: payload.hasKey,
        runningCondition: payload.runningCondition,
        fuel: payload.fuel,
        transmission: payload.transmission,
        color: payload.color,
        mileage: payload.mileage,
        yard: payload.yard,
        city: payload.city,
        state: payload.state,
        auctionDate: payload.auctionDate,
        originalNotes: payload.notes,
        rawJson: payload as never,
        importStatus: "PARTIAL",
        alerts: ["Snapshot inicial criado a partir do cadastro manual."],
        pendingFields
      }
    });
  }

  revalidatePath("/dashboard");
  revalidatePath("/vehicles");
  revalidatePath(`/vehicles/${savedVehicle.id}`);
  redirect(`/vehicles/${savedVehicle.id}`);
}

export async function saveExpenseAction(formData: FormData) {
  const session = await getServerAuthSession();
  const id = String(formData.get("id") ?? "").trim();
  const vehicleId = String(formData.get("vehicleId") ?? "").trim();

  const payload = {
    vehicleId,
    categoryId: String(formData.get("categoryId") ?? "").trim(),
    supplierId: String(formData.get("supplierId") ?? "").trim() || undefined,
    description: String(formData.get("description") ?? "").trim(),
    date: parseDate(formData.get("date")),
    predictedAmount: parseNumber(formData.get("predictedAmount")),
    actualAmount: parseNumber(formData.get("actualAmount")),
    paymentStatus: (String(formData.get("paymentStatus") ?? PaymentStatus.PENDING) as PaymentStatus) || PaymentStatus.PENDING,
    paymentMethod: (String(formData.get("paymentMethod") ?? "") as PaymentMethod) || undefined,
    dueDate: parseDate(formData.get("dueDate")),
    note: String(formData.get("note") ?? "").trim() || undefined
  };

  const expense = id
    ? await prisma.expense.update({
        where: { id },
        data: {
          ...payload,
          predictedAmount: normalizeMoneyValue(payload.predictedAmount ?? undefined),
          actualAmount: normalizeMoneyValue(payload.actualAmount ?? undefined)
        }
      })
    : await prisma.expense.create({
        data: {
          ...payload,
          predictedAmount: normalizeMoneyValue(payload.predictedAmount ?? undefined),
          actualAmount: normalizeMoneyValue(payload.actualAmount ?? undefined)
        }
      });

  const vehicle = await prisma.vehicle.findUnique({
    where: { id: vehicleId },
    include: {
      expenses: true
    }
  });

  if (vehicle) {
    const actualCosts = vehicle.expenses.reduce((total, item) => total + Number(item.actualAmount ?? 0), 0);
    const predictedCosts = vehicle.expenses.reduce((total, item) => total + Number(item.predictedAmount ?? 0), 0);

    const financials = calculateVehicleFinancials({
      bidValue: Number(vehicle.bidValue ?? 0),
      auctionCommission: Number(vehicle.auctionCommission ?? 0),
      administrativeFees: Number(vehicle.administrativeFees ?? 0),
      yardCost: Number(vehicle.yardCost ?? 0),
      towCost: Number(vehicle.towCost ?? 0),
      documentationCost: Number(vehicle.documentationExpected ?? 0),
      repairCost: Number(vehicle.repairsExpected ?? 0),
      additionalPredictedCosts: predictedCosts,
      additionalActualCosts: actualCosts,
      predictedSalePrice: Number(vehicle.predictedSalePrice ?? 0),
      actualSalePrice: Number(vehicle.actualSalePrice ?? 0)
    });

    await prisma.vehicle.update({
      where: {
        id: vehicle.id
      },
      data: {
        totalPredictedCost: normalizeMoneyValue(financials.totalPredictedCost ?? undefined),
        totalActualCost: normalizeMoneyValue(financials.totalActualCost ?? undefined),
        predictedProfit: normalizeMoneyValue(financials.predictedProfit ?? undefined),
        actualProfit: normalizeMoneyValue(financials.actualProfit ?? undefined),
        predictedMargin: normalizeMoneyValue(financials.predictedMargin ?? undefined),
        actualMargin: normalizeMoneyValue(financials.actualMargin ?? undefined),
        predictedRoi: normalizeMoneyValue(financials.predictedRoi ?? undefined),
        actualRoi: normalizeMoneyValue(financials.actualRoi ?? undefined)
      }
    });
  }

  await createAuditLog({
    userId: session?.user.id,
    entityType: "Expense",
    entityId: expense.id,
    action: id ? "UPDATE" : "CREATE",
    afterData: payload,
    message: "Gasto salvo"
  });

  revalidatePath("/expenses");
  revalidatePath(`/vehicles/${vehicleId}`);
}

export async function saveSupplierAction(formData: FormData) {
  const session = await getServerAuthSession();
  const id = String(formData.get("id") ?? "").trim();

  const payload = {
    name: String(formData.get("name") ?? "").trim(),
    phone: String(formData.get("phone") ?? "").trim() || undefined,
    email: String(formData.get("email") ?? "").trim() || undefined,
    document: String(formData.get("document") ?? "").trim() || undefined,
    address: String(formData.get("address") ?? "").trim() || undefined,
    category: String(formData.get("category") ?? "").trim(),
    notes: String(formData.get("notes") ?? "").trim() || undefined,
    rating: parseInteger(formData.get("rating")),
    averageLeadTime: parseInteger(formData.get("averageLeadTime")),
    averageCost: parseNumber(formData.get("averageCost"))
  };

  const supplier = id
    ? await prisma.supplier.update({
        where: { id },
        data: {
          ...payload,
          averageCost: normalizeMoneyValue(payload.averageCost ?? undefined)
        }
      })
    : await prisma.supplier.create({
        data: {
          ...payload,
          averageCost: normalizeMoneyValue(payload.averageCost ?? undefined)
        }
      });

  await createAuditLog({
    userId: session?.user.id,
    entityType: "Supplier",
    entityId: supplier.id,
    action: id ? "UPDATE" : "CREATE",
    afterData: payload,
    message: "Fornecedor salvo"
  });

  revalidatePath("/suppliers");
}

export async function saveSimulationAction(formData: FormData) {
  const session = await getServerAuthSession();
  const vehicleId = String(formData.get("vehicleId") ?? "").trim() || undefined;
  const payload = {
    vehicleId,
    brand: String(formData.get("brand") ?? "").trim() || undefined,
    model: String(formData.get("model") ?? "").trim() || undefined,
    version: String(formData.get("version") ?? "").trim() || undefined,
    year: parseInteger(formData.get("year")),
    fipeValue: parseNumber(formData.get("fipeValue")),
    marketAverageValue: parseNumber(formData.get("marketAverageValue")),
    intendedBid: parseNumber(formData.get("intendedBid")),
    auctionCommission: parseNumber(formData.get("auctionCommission")),
    administrativeFees: parseNumber(formData.get("administrativeFees")),
    yardCost: parseNumber(formData.get("yardCost")),
    towCost: parseNumber(formData.get("towCost")),
    documentationCost: parseNumber(formData.get("documentationCost")),
    estimatedRepairs: parseNumber(formData.get("estimatedRepairs")),
    desiredMargin: parseNumber(formData.get("desiredMargin")) ?? LOT_ANALYSIS_DEFAULTS.desiredMarginPercent,
    predictedSalePrice: parseNumber(formData.get("predictedSalePrice")),
    desiredDiscountOnFipe: parseNumber(formData.get("desiredDiscountOnFipe")),
    estimatedSellingDays: parseInteger(formData.get("estimatedSellingDays"))
  };

  const calculations = calculateVehicleFinancials({
    fipeValue: payload.fipeValue,
    marketValue: payload.marketAverageValue,
    bidValue: payload.intendedBid,
    auctionCommission: payload.auctionCommission,
    administrativeFees: payload.administrativeFees,
    yardCost: payload.yardCost,
    towCost: payload.towCost,
    documentationCost: payload.documentationCost,
    repairCost: payload.estimatedRepairs,
    predictedSalePrice: payload.predictedSalePrice,
    desiredMarginPercent: payload.desiredMargin
  });

  const recommendation =
    calculations.predictedMargin >= LOT_ANALYSIS_DEFAULTS.desiredMarginPercent
      ? "Excelente oportunidade"
      : calculations.predictedMargin >= LOT_ANALYSIS_DEFAULTS.desiredMarginPercent - 5
        ? "Boa oportunidade"
        : calculations.predictedMargin >= 5
          ? "Atencao"
          : "Evitar";

  const simulation = await prisma.simulation.create({
    data: {
      ...payload,
      fipeValue: normalizeMoneyValue(payload.fipeValue ?? undefined),
      marketAverageValue: normalizeMoneyValue(payload.marketAverageValue ?? undefined),
      intendedBid: normalizeMoneyValue(payload.intendedBid ?? undefined),
      auctionCommission: normalizeMoneyValue(payload.auctionCommission ?? undefined),
      administrativeFees: normalizeMoneyValue(payload.administrativeFees ?? undefined),
      yardCost: normalizeMoneyValue(payload.yardCost ?? undefined),
      towCost: normalizeMoneyValue(payload.towCost ?? undefined),
      documentationCost: normalizeMoneyValue(payload.documentationCost ?? undefined),
      estimatedRepairs: normalizeMoneyValue(payload.estimatedRepairs ?? undefined),
      desiredMargin: normalizeMoneyValue(payload.desiredMargin ?? undefined),
      predictedSalePrice: normalizeMoneyValue(payload.predictedSalePrice ?? undefined),
      desiredDiscountOnFipe: normalizeMoneyValue(payload.desiredDiscountOnFipe ?? undefined),
      totalPredictedCost: normalizeMoneyValue(calculations.totalPredictedCost ?? undefined),
      predictedProfit: normalizeMoneyValue(calculations.predictedProfit ?? undefined),
      predictedMargin: normalizeMoneyValue(calculations.predictedMargin ?? undefined),
      predictedRoi: normalizeMoneyValue(calculations.predictedRoi ?? undefined),
      minimumSellingPrice: normalizeMoneyValue(calculations.priceMinimum ?? undefined),
      idealSellingPrice: normalizeMoneyValue(calculations.priceIdeal ?? undefined),
      aggressiveSellingPrice: normalizeMoneyValue(calculations.priceAggressive ?? undefined),
      recommendedMaxBid: normalizeMoneyValue(calculations.recommendedMaxBid ?? undefined),
      recommendation
    }
  });

  await createAuditLog({
    userId: session?.user.id,
    entityType: "Simulation",
    entityId: simulation.id,
    action: "CREATE",
    afterData: payload,
    message: "Simulacao salva"
  });

  revalidatePath("/simulator");
}

export async function saveMarketResearchAction(formData: FormData) {
  const session = await getServerAuthSession();
  const vehicleId = String(formData.get("vehicleId") ?? "").trim();
  const source = String(formData.get("source") ?? "MANUAL");
  const price = parseNumber(formData.get("price"));

  const research = await prisma.marketResearch.create({
    data: {
      vehicleId,
      fipeValue: normalizeMoneyValue(parseNumber(formData.get("fipeValue")) ?? undefined),
      marketAverage: normalizeMoneyValue(parseNumber(formData.get("marketAverage")) ?? undefined),
      lowestPrice: normalizeMoneyValue(parseNumber(formData.get("lowestPrice")) ?? undefined),
      highestPrice: normalizeMoneyValue(parseNumber(formData.get("highestPrice")) ?? undefined),
      listingsCount: parseInteger(formData.get("listingsCount")) ?? 1,
      suggestedCompetitivePrice: normalizeMoneyValue(parseNumber(formData.get("suggestedCompetitivePrice")) ?? undefined),
      suggestedAggressivePrice: normalizeMoneyValue(parseNumber(formData.get("suggestedAggressivePrice")) ?? undefined),
      suggestedIdealPrice: normalizeMoneyValue(parseNumber(formData.get("suggestedIdealPrice")) ?? undefined),
      minimumAcceptablePrice: normalizeMoneyValue(parseNumber(formData.get("minimumAcceptablePrice")) ?? undefined),
      liquidityLevel: (String(formData.get("liquidityLevel") ?? LiquidityLevel.UNKNOWN) as LiquidityLevel) ?? LiquidityLevel.UNKNOWN,
      notes: String(formData.get("notes") ?? "").trim() || undefined,
      sourceStatus: {
        manual: true
      } as never,
      listings: {
        create: {
          source: source as MarketSourceType,
          marketSourceId: String(formData.get("marketSourceId") ?? "").trim() || undefined,
          listingUrl: String(formData.get("listingUrl") ?? "").trim() || undefined,
          price: normalizeMoneyValue(price ?? undefined),
          year: parseInteger(formData.get("year")),
          version: String(formData.get("version") ?? "").trim() || undefined,
          mileage: parseInteger(formData.get("mileage")),
          city: String(formData.get("city") ?? "").trim() || undefined,
          state: String(formData.get("state") ?? "").trim() || undefined,
          sellerType: (String(formData.get("sellerType") ?? "") as SellerType) || undefined,
          notes: String(formData.get("listingNotes") ?? "").trim() || undefined
        }
      }
    }
  });

  await createAuditLog({
    userId: session?.user.id,
    entityType: "MarketResearch",
    entityId: research.id,
    action: "CREATE",
    message: "Pesquisa de mercado registrada"
  });

  revalidatePath("/market-research");
  revalidatePath(`/vehicles/${vehicleId}`);
}

export async function saveSaleAction(formData: FormData) {
  const session = await getServerAuthSession();
  const vehicleId = String(formData.get("vehicleId") ?? "").trim();

  const vehicle = await prisma.vehicle.findUnique({
    where: {
      id: vehicleId
    }
  });

  if (!vehicle) {
    return;
  }

  const soldPrice = parseNumber(formData.get("soldPrice")) ?? 0;
  const listedPrice = parseNumber(formData.get("listedPrice")) ?? soldPrice;
  const discountGranted = parseNumber(formData.get("discountGranted")) ?? Math.max(listedPrice - soldPrice, 0);
  const salesCommission = parseNumber(formData.get("salesCommission")) ?? 0;
  const taxes = parseNumber(formData.get("taxes")) ?? 0;
  const baseCost = Number(vehicle.totalActualCost ?? vehicle.totalPredictedCost ?? 0);
  const grossProfit = soldPrice - baseCost;
  const netProfit = grossProfit - salesCommission - taxes;
  const netMargin = soldPrice > 0 ? (netProfit / soldPrice) * 100 : 0;
  const roi = baseCost > 0 ? (netProfit / baseCost) * 100 : 0;
  const daysToSale =
    vehicle.bidDate && parseDate(formData.get("soldAt"))
      ? Math.ceil((parseDate(formData.get("soldAt"))!.getTime() - vehicle.bidDate.getTime()) / 86400000)
      : undefined;

  const sale = await prisma.sale.upsert({
    where: {
      vehicleId
    },
    update: {
      soldAt: parseDate(formData.get("soldAt")),
      listedPrice: normalizeMoneyValue(listedPrice ?? undefined),
      soldPrice: normalizeMoneyValue(soldPrice ?? undefined),
      discountGranted: normalizeMoneyValue(discountGranted ?? undefined),
      buyerName: String(formData.get("buyerName") ?? "").trim() || undefined,
      saleChannel: String(formData.get("saleChannel") ?? "").trim() || undefined,
      salesCommission: normalizeMoneyValue(salesCommission ?? undefined),
      taxes: normalizeMoneyValue(taxes ?? undefined),
      paymentMethod: (String(formData.get("paymentMethod") ?? "") as PaymentMethod) || undefined,
      notes: String(formData.get("notes") ?? "").trim() || undefined,
      transferDate: parseDate(formData.get("transferDate")),
      transferStatus: String(formData.get("transferStatus") ?? "").trim() || undefined,
      grossProfit: normalizeMoneyValue(grossProfit ?? undefined),
      netProfit: normalizeMoneyValue(netProfit ?? undefined),
      netMargin: normalizeMoneyValue(netMargin ?? undefined),
      roi: normalizeMoneyValue(roi ?? undefined),
      daysToSale
    },
    create: {
      vehicleId,
      soldAt: parseDate(formData.get("soldAt")),
      listedPrice: normalizeMoneyValue(listedPrice ?? undefined),
      soldPrice: normalizeMoneyValue(soldPrice ?? undefined),
      discountGranted: normalizeMoneyValue(discountGranted ?? undefined),
      buyerName: String(formData.get("buyerName") ?? "").trim() || undefined,
      saleChannel: String(formData.get("saleChannel") ?? "").trim() || undefined,
      salesCommission: normalizeMoneyValue(salesCommission ?? undefined),
      taxes: normalizeMoneyValue(taxes ?? undefined),
      paymentMethod: (String(formData.get("paymentMethod") ?? "") as PaymentMethod) || undefined,
      notes: String(formData.get("notes") ?? "").trim() || undefined,
      transferDate: parseDate(formData.get("transferDate")),
      transferStatus: String(formData.get("transferStatus") ?? "").trim() || undefined,
      grossProfit: normalizeMoneyValue(grossProfit ?? undefined),
      netProfit: normalizeMoneyValue(netProfit ?? undefined),
      netMargin: normalizeMoneyValue(netMargin ?? undefined),
      roi: normalizeMoneyValue(roi ?? undefined),
      daysToSale
    }
  });

  await prisma.vehicle.update({
    where: { id: vehicleId },
    data: {
      status: VehicleStatus.VENDIDO,
      actualSalePrice: normalizeMoneyValue(soldPrice ?? undefined),
      actualProfit: normalizeMoneyValue(netProfit ?? undefined),
      actualMargin: normalizeMoneyValue(netMargin ?? undefined),
      actualRoi: normalizeMoneyValue(roi ?? undefined)
    }
  });

  await createAuditLog({
    userId: session?.user.id,
    entityType: "Sale",
    entityId: sale.id,
    action: "UPSERT",
    message: "Venda registrada"
  });

  revalidatePath("/sales");
  revalidatePath(`/vehicles/${vehicleId}`);
}

export async function updateVehicleStatusAction(formData: FormData) {
  const session = await getServerAuthSession();
  const vehicleId = String(formData.get("vehicleId") ?? "").trim();
  const status = String(formData.get("status") ?? VehicleStatus.ANALISE_LOTE) as VehicleStatus;

  await prisma.vehicle.update({
    where: {
      id: vehicleId
    },
    data: {
      status
    }
  });

  const slug = VEHICLE_STATUS_LABELS[status]
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");

  const processStep = await prisma.processStep.findFirst({
    where: {
      slug
    }
  });

  if (processStep) {
    await prisma.vehicleProcess.upsert({
      where: {
        vehicleId_processStepId: {
          vehicleId,
          processStepId: processStep.id
        }
      },
      update: {
        status: StepExecutionStatus.IN_PROGRESS,
        startedAt: new Date()
      },
      create: {
        vehicleId,
        processStepId: processStep.id,
        status: StepExecutionStatus.IN_PROGRESS,
        startedAt: new Date()
      }
    });
  }

  await createAuditLog({
    userId: session?.user.id,
    entityType: "Vehicle",
    entityId: vehicleId,
    action: "STATUS_UPDATE",
    afterData: { status },
    message: `Status alterado para ${status}`
  });

  revalidatePath("/processes");
  revalidatePath("/dashboard");
  revalidatePath(`/vehicles/${vehicleId}`);
}

export async function saveInitialInspectionAction(formData: FormData) {
  const session = await getServerAuthSession();
  const vehicleId = String(formData.get("vehicleId") ?? "").trim();

  if (!vehicleId) {
    return;
  }

  const processStep = await prisma.processStep.findFirst({
    where: {
      slug: "vistoria-inicial"
    }
  });
  const repairBudgetStep = await prisma.processStep.findFirst({
    where: {
      slug: "orcamento-de-reparos"
    }
  });

  if (!processStep) {
    return;
  }

  const inspectionPayload = {
    inspectorName: String(formData.get("inspectorName") ?? "").trim(),
    inspectedAt: String(formData.get("inspectedAt") ?? "").trim(),
    odometer: String(formData.get("odometer") ?? "").trim(),
    fuelLevel: String(formData.get("fuelLevel") ?? "").trim(),
    generalNotes: String(formData.get("generalNotes") ?? "").trim(),
    missingItems: String(formData.get("missingItems") ?? "").trim(),
    items: Object.fromEntries(
      INITIAL_INSPECTION_ITEMS.map((item) => [item.key, String(formData.get(`inspection_${item.key}`) ?? "").trim()])
    )
  };

  const summary = getInitialInspectionSummary(inspectionPayload);

  await prisma.vehicleProcess.upsert({
    where: {
      vehicleId_processStepId: {
        vehicleId,
        processStepId: processStep.id
      }
    },
    update: {
      status: summary.completed === summary.total ? StepExecutionStatus.DONE : StepExecutionStatus.IN_PROGRESS,
      startedAt: summary.completed > 0 ? new Date() : undefined,
      completedAt: summary.completed === summary.total ? new Date() : null,
      notes:
        summary.completed > 0
          ? `Checklist preenchido: ${summary.completed}/${summary.total} itens.`
          : "Checklist ainda nao iniciado.",
      attachments: {
        inspectionChecklist: inspectionPayload,
        inspectionSummary: summary
      } as never
    },
    create: {
      vehicleId,
      processStepId: processStep.id,
      status: summary.completed === summary.total ? StepExecutionStatus.DONE : StepExecutionStatus.IN_PROGRESS,
      startedAt: summary.completed > 0 ? new Date() : undefined,
      completedAt: summary.completed === summary.total ? new Date() : undefined,
      notes:
        summary.completed > 0
          ? `Checklist preenchido: ${summary.completed}/${summary.total} itens.`
          : "Checklist ainda nao iniciado.",
      attachments: {
        inspectionChecklist: inspectionPayload,
        inspectionSummary: summary
      } as never
    }
  });

  if (summary.completed === summary.total && summary.total > 0 && repairBudgetStep) {
    await prisma.vehicleProcess.upsert({
      where: {
        vehicleId_processStepId: {
          vehicleId,
          processStepId: repairBudgetStep.id
        }
      },
      update: {
        notes: "Vistoria inicial concluida. Pronto para iniciar orcamento de reparos."
      },
      create: {
        vehicleId,
        processStepId: repairBudgetStep.id,
        status: StepExecutionStatus.NOT_STARTED,
        notes: "Vistoria inicial concluida. Pronto para iniciar orcamento de reparos."
      }
    });

    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
      select: { alerts: true }
    });

    const nextAlert = "Vistoria inicial concluida. Revisar checklist e avancar para orcamento de reparos.";
    const alerts = [...(vehicle?.alerts ?? []).filter((item) => item !== nextAlert), nextAlert];

    await prisma.vehicle.update({
      where: { id: vehicleId },
      data: {
        alerts
      }
    });
  }

  await createAuditLog({
    userId: session?.user.id,
    entityType: "VehicleProcess",
    entityId: vehicleId,
    action: "INSPECTION_UPDATE",
    afterData: inspectionPayload,
    message: "Checklist de vistoria inicial atualizado"
  });

  revalidatePath("/processes");
  revalidatePath(`/vehicles/${vehicleId}`);
}

export async function saveSettingAction(formData: FormData) {
  const session = await getServerAuthSession();
  const id = String(formData.get("id") ?? "").trim();
  const rawValue = String(formData.get("value") ?? "").trim();

  const value =
    rawValue.startsWith("{") || rawValue.startsWith("[")
      ? JSON.parse(rawValue)
      : /^\d+(\.\d+)?$/.test(rawValue)
        ? Number(rawValue)
        : rawValue;

  const setting = await prisma.setting.update({
    where: {
      id
    },
    data: {
      value: value as never
    }
  });

  await createAuditLog({
    userId: session?.user.id,
    entityType: "Setting",
    entityId: setting.id,
    action: "UPDATE",
    afterData: { value },
    message: `Configuracao ${setting.key} atualizada`
  });

  revalidatePath("/settings");
  revalidatePath("/dashboard");
}

export async function deleteExpenseAction(formData: FormData) {
  const session = await getServerAuthSession();
  const id = String(formData.get("id") ?? "").trim();
  const vehicleId = String(formData.get("vehicleId") ?? "").trim();

  if (!id) {
    return;
  }

  await prisma.expense.delete({
    where: {
      id
    }
  });

  if (vehicleId) {
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
      include: {
        expenses: true
      }
    });

    if (vehicle) {
      const actualCosts = vehicle.expenses.reduce((total, item) => total + Number(item.actualAmount ?? 0), 0);
      const predictedCosts = vehicle.expenses.reduce((total, item) => total + Number(item.predictedAmount ?? 0), 0);

      const financials = calculateVehicleFinancials({
        bidValue: Number(vehicle.bidValue ?? 0),
        auctionCommission: Number(vehicle.auctionCommission ?? 0),
        administrativeFees: Number(vehicle.administrativeFees ?? 0),
        yardCost: Number(vehicle.yardCost ?? 0),
        towCost: Number(vehicle.towCost ?? 0),
        documentationCost: Number(vehicle.documentationExpected ?? 0),
        repairCost: Number(vehicle.repairsExpected ?? 0),
        additionalPredictedCosts: predictedCosts,
        additionalActualCosts: actualCosts,
        predictedSalePrice: Number(vehicle.predictedSalePrice ?? 0),
        actualSalePrice: Number(vehicle.actualSalePrice ?? 0)
      });

      await prisma.vehicle.update({
        where: {
          id: vehicle.id
        },
        data: {
          totalPredictedCost: normalizeMoneyValue(financials.totalPredictedCost ?? undefined),
          totalActualCost: normalizeMoneyValue(financials.totalActualCost ?? undefined),
          predictedProfit: normalizeMoneyValue(financials.predictedProfit ?? undefined),
          actualProfit: normalizeMoneyValue(financials.actualProfit ?? undefined),
          predictedMargin: normalizeMoneyValue(financials.predictedMargin ?? undefined),
          actualMargin: normalizeMoneyValue(financials.actualMargin ?? undefined),
          predictedRoi: normalizeMoneyValue(financials.predictedRoi ?? undefined),
          actualRoi: normalizeMoneyValue(financials.actualRoi ?? undefined)
        }
      });
    }
  }

  await createAuditLog({
    userId: session?.user.id,
    entityType: "Expense",
    entityId: id,
    action: "DELETE",
    message: "Gasto excluido"
  });

  revalidatePath("/expenses");
  if (vehicleId) {
    revalidatePath(`/vehicles/${vehicleId}`);
  }
}

export async function deleteVehicleAction(formData: FormData) {
  const session = await getServerAuthSession();
  const id = String(formData.get("id") ?? "").trim();

  if (!id) {
    return;
  }

  await prisma.vehicle.delete({
    where: {
      id
    }
  });

  await createAuditLog({
    userId: session?.user.id,
    entityType: "Vehicle",
    entityId: id,
    action: "DELETE",
    message: "Veiculo excluido"
  });

  revalidatePath("/vehicles");
  revalidatePath("/dashboard");
  redirect("/vehicles");
}
