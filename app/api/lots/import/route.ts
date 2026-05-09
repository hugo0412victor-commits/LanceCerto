import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LotImporter } from "@/lib/lot-importer";
import { createAuditLog } from "@/lib/audit";
import { LotImportError } from "@/lib/lot-importer/types";
import { calculateVehicleFinancials, calculateRecommendedBid, deriveLotAnalysisViability, LOT_ANALYSIS_DEFAULTS } from "@/lib/calculations";
import { calculateOpportunityScore } from "@/lib/scoring";
import { generateLotRiskAnalysis } from "@/lib/ai";
import { runAutomaticMarketResearch } from "@/lib/market-research";
import { AiAnalysisType, AiRiskLevel, MarketSourceType } from "@prisma/client";
import { recalculateVehicleCostsFromExpenses, syncVehicleCoreExpenses } from "@/lib/vehicle-costs";
import { canWrite } from "@/lib/permissions";
import { canUseLocalBrowserFallback } from "@/lib/lot-importer/utils";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function summarizeUrl(url?: string) {
  if (!url) {
    return undefined;
  }

  try {
    const parsed = new URL(url);
    return {
      protocol: parsed.protocol,
      hostname: parsed.hostname,
      pathname: parsed.pathname
    };
  } catch {
    return { invalid: true };
  }
}

function logLotImport(level: "info" | "warn" | "error", requestId: string, event: string, meta?: Record<string, unknown>) {
  console[level]("[lot-import]", {
    requestId,
    event,
    ...meta
  });
}

export async function POST(request: Request) {
  const requestId = randomUUID();
  const startedAt = Date.now();
  let submittedUrl: string | undefined;

  try {
    logLotImport("info", requestId, "request_started", {
      nodeEnv: process.env.NODE_ENV,
      vercel: process.env.VERCEL === "1",
      vercelEnv: process.env.VERCEL_ENV,
      hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
      hasDatabaseUrlUnpooled: Boolean(process.env.DATABASE_URL_UNPOOLED),
      hasNextAuthUrl: Boolean(process.env.NEXTAUTH_URL),
      hasNextAuthSecret: Boolean(process.env.NEXTAUTH_SECRET),
      localBrowserFallback: canUseLocalBrowserFallback()
    });

    const session = await getServerAuthSession();

    if (!session) {
      logLotImport("warn", requestId, "unauthorized");
      return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
    }

    if (!canWrite(session.user.role)) {
      logLotImport("warn", requestId, "forbidden", {
        role: session.user.role
      });
      return NextResponse.json({ error: "Permissao insuficiente para importar lotes." }, { status: 403 });
    }

    const { url } = (await request.json()) as { url?: string };
    submittedUrl = url;

    if (!url) {
      logLotImport("warn", requestId, "missing_url");
      return NextResponse.json({ error: "Informe a URL do lote" }, { status: 400 });
    }

    logLotImport("info", requestId, "import_started", {
      url: summarizeUrl(url)
    });

    const importer = new LotImporter();
    const result = await importer.importFromUrl(url);

    logLotImport("info", requestId, "provider_finished", {
      provider: result.provider,
      status: result.status,
      pendingFields: result.pendingFields,
      alertsCount: result.alerts.length,
      sourceMethod: typeof result.rawJson === "object" && result.rawJson ? (result.rawJson as { sourceMethod?: unknown }).sourceMethod : undefined
    });

    const createdById = session.user.id || undefined;
    const automaticMarketResearch = await runAutomaticMarketResearch({
      brand: result.vehicleData.brand,
      model: result.vehicleData.model,
      version: result.vehicleData.version,
      modelYear: result.vehicleData.modelYear,
      fuel: result.vehicleData.fuel,
      city: result.vehicleData.city,
      state: result.vehicleData.state,
      fipeValue: result.vehicleData.fipeValue
    });
    const viability = deriveLotAnalysisViability({
      fipeValue: result.vehicleData.fipeValue,
      marketValue: automaticMarketResearch.marketAverage
    });
    const calculations = calculateVehicleFinancials({
      fipeValue: result.vehicleData.fipeValue,
      marketValue: automaticMarketResearch.marketAverage,
      bidValue: viability.bidValue,
      auctionCommission: viability.auctionCommission,
      administrativeFees: viability.administrativeFees,
      documentationCost: viability.documentationCost,
      predictedSalePrice: viability.predictedSalePrice,
      desiredMarginPercent: LOT_ANALYSIS_DEFAULTS.desiredMarginPercent
    });
    const recommendedBid = calculateRecommendedBid({
      predictedSalePrice: viability.predictedSalePrice ?? result.vehicleData.fipeValue,
      desiredMarginPercent: LOT_ANALYSIS_DEFAULTS.desiredMarginPercent,
      extraCosts:
        (viability.auctionCommission ?? 0) +
        (viability.administrativeFees ?? 0) +
        (viability.documentationCost ?? 0)
    });
    const aggregatedAlerts = [...result.alerts, ...automaticMarketResearch.alerts, ...viability.assumptionsSummary];

    const auctionHouse = result.vehicleData.auctionHouseName
      ? await prisma.auctionHouse.findFirst({
          where: {
            name: {
              equals: result.vehicleData.auctionHouseName,
              mode: "insensitive"
            }
          }
        })
      : null;

    const vehicle = await prisma.vehicle.create({
      data: {
        createdById,
        lotUrl: result.vehicleData.lotUrl,
        lotCode: result.vehicleData.lotCode,
        auctionHouseId: auctionHouse?.id,
        status: "ANALISE_LOTE",
        brand: result.vehicleData.brand,
        model: result.vehicleData.model,
        version: result.vehicleData.version,
        manufacturingYear: result.vehicleData.manufacturingYear,
        modelYear: result.vehicleData.modelYear,
        documentType: result.vehicleData.documentType,
        mountType: result.vehicleData.mountType,
        condition: result.vehicleData.condition,
        hasKey: result.vehicleData.hasKey,
        runningCondition: result.vehicleData.runningCondition,
        fuel: result.vehicleData.fuel,
        transmission: result.vehicleData.transmission,
        color: result.vehicleData.color,
        mileage: result.vehicleData.mileage,
        chassis: result.vehicleData.chassis,
        chassisType: result.vehicleData.chassisType,
        plateFinal: result.vehicleData.plateOrFinal,
        yard: result.vehicleData.yard,
        city: result.vehicleData.city,
        state: result.vehicleData.state,
        auctionDate: result.vehicleData.auctionDate,
        fipeValue: result.vehicleData.fipeValue,
        marketEstimatedValue: automaticMarketResearch.marketAverage,
        bidValue: viability.bidValue,
        auctionCommission: viability.auctionCommission,
        administrativeFees: viability.administrativeFees,
        documentationExpected: viability.documentationCost,
        predictedSalePrice: viability.predictedSalePrice,
        totalPredictedCost: calculations.totalPredictedCost,
        predictedProfit: calculations.predictedProfit,
        predictedMargin: calculations.predictedMargin,
        predictedRoi: calculations.predictedRoi,
        minimumAcceptablePrice: calculations.priceMinimum,
        maxRecommendedBid: recommendedBid.moderate,
        notes: result.vehicleData.originalNotes,
        rawMetadata: result.rawJson as never,
        mainPhotoUrl: result.vehicleData.originalPhotoUrls?.[0],
        snapshotConfirmed: true,
        snapshotDate: new Date(),
        completenessPercent: Math.max(10, 100 - result.pendingFields.length * 12),
        pendingFields: result.pendingFields,
        alerts: aggregatedAlerts
      }
    });

    await syncVehicleCoreExpenses(prisma, vehicle.id, {
      bidValue: viability.bidValue,
      auctionCommission: viability.auctionCommission,
      administrativeFees: viability.administrativeFees,
      documentationExpected: viability.documentationCost
    });
    await recalculateVehicleCostsFromExpenses(prisma, vehicle.id);

    const score = calculateOpportunityScore({
      discountToFipePercent:
        result.vehicleData.fipeValue && viability.bidValue
          ? ((result.vehicleData.fipeValue - viability.bidValue) / result.vehicleData.fipeValue) * 100
          : 0,
      projectedMarginPercent: calculations.predictedMargin,
      repairEaseScore: 60,
      liquidityScore: 52,
      documentaryRiskScore: result.vehicleData.documentType ? 35 : 75,
      estimatedSaleTimeScore: result.pendingFields.length > 2 ? 45 : 72
    });

    await prisma.opportunityScore.create({
      data: {
        vehicleId: vehicle.id,
        score: score.score,
        classification: score.classification,
        breakdown: score.breakdown as never,
        weights: score.weights as never
      }
    });

    const ai = generateLotRiskAnalysis({
      brand: result.vehicleData.brand,
      model: result.vehicleData.model,
      version: result.vehicleData.version,
      manufacturingYear: result.vehicleData.manufacturingYear,
      modelYear: result.vehicleData.modelYear,
      condition: result.vehicleData.condition,
      documentType: result.vehicleData.documentType,
      mountType: result.vehicleData.mountType,
      mileage: result.vehicleData.mileage,
      hasKey: result.vehicleData.hasKey,
      runningCondition: result.vehicleData.runningCondition,
      notes: result.vehicleData.originalNotes,
      fipeValue: result.vehicleData.fipeValue,
      marketEstimatedValue: automaticMarketResearch.marketAverage ?? viability.predictedSalePrice,
      bidValue: viability.bidValue,
      auctionCommission: viability.auctionCommission,
      administrativeFees: viability.administrativeFees,
      documentationExpected: viability.documentationCost,
      predictedSalePrice: viability.predictedSalePrice
    });

    await prisma.aiAnalysis.create({
      data: {
        vehicleId: vehicle.id,
        analysisType: AiAnalysisType.LOT_RISK,
        input: {
          provider: result.provider,
          viability
        } as never,
        output: ai as never,
        summary: ai.summary,
        riskLevel: ai.riskLevel as AiRiskLevel
      }
    });

    await prisma.lotSnapshot.create({
      data: {
        vehicleId: vehicle.id,
        auctionHouseId: auctionHouse?.id,
        sourceUrl: result.vehicleData.lotUrl,
        auctionHouseName: result.vehicleData.auctionHouseName,
        lotCode: result.vehicleData.lotCode,
        brand: result.vehicleData.brand,
        model: result.vehicleData.model,
        version: result.vehicleData.version,
        manufacturingYear: result.vehicleData.manufacturingYear,
        modelYear: result.vehicleData.modelYear,
        informedFipe: result.vehicleData.fipeValue,
        documentType: result.vehicleData.documentType,
        mountType: result.vehicleData.mountType,
        condition: result.vehicleData.condition,
        hasKey: result.vehicleData.hasKey,
        runningCondition: result.vehicleData.runningCondition,
        fuel: result.vehicleData.fuel,
        transmission: result.vehicleData.transmission,
        color: result.vehicleData.color,
        mileage: result.vehicleData.mileage,
        chassis: result.vehicleData.chassis,
        plateOrFinal: result.vehicleData.plateOrFinal,
        yard: result.vehicleData.yard,
        city: result.vehicleData.city,
        state: result.vehicleData.state,
        auctionDate: result.vehicleData.auctionDate,
        originalNotes: result.vehicleData.originalNotes,
        photoUrls: result.vehicleData.originalPhotoUrls ?? [],
        rawJson: result.rawJson as never,
        importStatus: result.status,
        alerts: aggregatedAlerts,
        pendingFields: result.pendingFields
      }
    });

    if (automaticMarketResearch.listings.length > 0 || automaticMarketResearch.marketAverage) {
      const sources = await prisma.marketSource.findMany({
        where: {
          code: {
            in: [MarketSourceType.WEBMOTORS, MarketSourceType.OLX]
          }
        }
      });

      const sourceMap = new Map(sources.map((source) => [source.code, source.id]));

      await prisma.marketResearch.create({
        data: {
          vehicleId: vehicle.id,
          fipeValue: result.vehicleData.fipeValue,
          marketAverage: automaticMarketResearch.marketAverage,
          lowestPrice: automaticMarketResearch.lowestPrice,
          highestPrice: automaticMarketResearch.highestPrice,
          listingsCount: automaticMarketResearch.listingsCount,
          suggestedCompetitivePrice: automaticMarketResearch.suggestedCompetitivePrice,
          suggestedAggressivePrice: automaticMarketResearch.suggestedAggressivePrice,
          suggestedIdealPrice: automaticMarketResearch.suggestedIdealPrice,
          minimumAcceptablePrice: calculations.priceMinimum,
          liquidityLevel: automaticMarketResearch.liquidityLevel,
          notes: automaticMarketResearch.notes,
          sourceStatus: automaticMarketResearch.sourceStatus as never,
          listings: {
            create: automaticMarketResearch.listings.map((listing) => ({
              source: listing.source,
              marketSourceId: sourceMap.get(listing.source),
              listingUrl: listing.listingUrl,
              price: listing.price,
              year: listing.year,
              version: listing.version,
              mileage: listing.mileage,
              city: listing.city,
              state: listing.state,
              notes: listing.notes
            }))
          }
        }
      });
    }

    await createAuditLog({
      userId: createdById,
      entityType: "LotImport",
      entityId: vehicle.id,
      action: "IMPORT",
      afterData: result,
      message: `Lote importado via ${result.provider}`
    });

    logLotImport("info", requestId, "vehicle_created", {
      vehicleId: vehicle.id,
      durationMs: Date.now() - startedAt
    });

    return NextResponse.json({
      ok: true,
      vehicleId: vehicle.id,
      status: result.status,
      alerts: aggregatedAlerts,
      pendingFields: result.pendingFields,
      message:
        result.status === "SUCCESS"
          ? "Lote importado com sucesso e salvo no banco."
          : "Lote importado parcialmente e salvo no banco para revisao."
    });
  } catch (error) {
    if (error instanceof LotImportError) {
      logLotImport("error", requestId, "lot_import_error", {
        code: error.code,
        httpStatus: error.httpStatus,
        message: error.message,
        details: error.details,
        url: summarizeUrl(submittedUrl),
        durationMs: Date.now() - startedAt
      });

      return NextResponse.json(
        {
          ok: false,
          code: error.code,
          error: error.message,
          details: error.details
        },
        { status: error.httpStatus }
      );
    }

    logLotImport("error", requestId, "unexpected_error", {
      message: error instanceof Error ? error.message : "unknown",
      stack: error instanceof Error ? error.stack : undefined,
      url: summarizeUrl(submittedUrl),
      durationMs: Date.now() - startedAt
    });

    return NextResponse.json(
      {
        ok: false,
        code: "IMPORT_FAILED",
        error: "Falha inesperada ao importar o lote."
      },
      { status: 500 }
    );
  }
}
