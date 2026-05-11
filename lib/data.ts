import { FinancialEntryStatus, FinancialEntryType, Prisma, VehicleStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { calculateTurnoverDays } from "@/lib/calculations";
import { getInitialInspectionSummary, parseInitialInspectionPayload } from "@/lib/inspection";
import { buildAuctionHouseRanking, buildSupplierRanking } from "@/lib/rankings";

const toNumber = (value: Prisma.Decimal | number | string | null | undefined) => {
  if (value === null || value === undefined) {
    return 0;
  }

  return Number(value);
};

const payableStatuses: FinancialEntryStatus[] = [FinancialEntryStatus.PENDING, FinancialEntryStatus.PARTIAL, FinancialEntryStatus.OVERDUE];
const settledOutStatuses: FinancialEntryStatus[] = [FinancialEntryStatus.PAID];
const receivableStatuses: FinancialEntryStatus[] = [FinancialEntryStatus.PENDING, FinancialEntryStatus.PARTIAL, FinancialEntryStatus.OVERDUE];
const settledInStatuses: FinancialEntryStatus[] = [FinancialEntryStatus.RECEIVED];

type RawVehicleDocumentRow = {
  id: string;
  vehicleId: string;
  uploadedById: string | null;
  category: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  storagePath: string;
  publicUrl: string;
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
  vehicleStockCode: string | null;
  vehicleBrand: string | null;
  vehicleModel: string | null;
  uploaderName: string | null;
};

async function getVehicleDocumentsRaw(vehicleId?: string) {
  const filter = vehicleId
    ? Prisma.sql`WHERE d."vehicleId" = ${vehicleId}`
    : Prisma.empty;

  const rows = await prisma.$queryRaw<RawVehicleDocumentRow[]>(Prisma.sql`
    SELECT
      d."id",
      d."vehicleId",
      d."uploadedById",
      d."category"::text AS "category",
      d."fileName",
      d."mimeType",
      d."fileSize",
      d."storagePath",
      d."publicUrl",
      d."note",
      d."createdAt",
      d."updatedAt",
      v."stockCode" AS "vehicleStockCode",
      v."brand" AS "vehicleBrand",
      v."model" AS "vehicleModel",
      u."name" AS "uploaderName"
    FROM "VehicleDocument" d
    INNER JOIN "Vehicle" v ON v."id" = d."vehicleId"
    LEFT JOIN "User" u ON u."id" = d."uploadedById"
    ${filter}
    ORDER BY d."createdAt" DESC
  `);

  return rows.map((row) => ({
    id: row.id,
    vehicleId: row.vehicleId,
    uploadedById: row.uploadedById,
    category: row.category,
    fileName: row.fileName,
    mimeType: row.mimeType,
    fileSize: row.fileSize,
    storagePath: row.storagePath,
    publicUrl: row.publicUrl,
    note: row.note,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    vehicle: {
      id: row.vehicleId,
      stockCode: row.vehicleStockCode,
      brand: row.vehicleBrand,
      model: row.vehicleModel
    },
    uploadedBy: row.uploadedById
      ? {
          id: row.uploadedById,
          name: row.uploaderName
        }
      : null
  }));
}

export async function getReferenceData() {
  const [auctionHouses, expenseCategories, suppliers, processSteps, marketSources, settings] =
    await Promise.all([
      prisma.auctionHouse.findMany({ orderBy: { name: "asc" } }),
      prisma.expenseCategory.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
      prisma.supplier.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
      prisma.processStep.findMany({ where: { active: true }, orderBy: { order: "asc" } }),
      prisma.marketSource.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
      prisma.setting.findMany({ orderBy: [{ group: "asc" }, { label: "asc" }] })
    ]);

  return {
    auctionHouses,
    expenseCategories,
    suppliers,
    processSteps,
    marketSources,
    settings
  };
}

export async function getDashboardData() {
  const vehicles = await prisma.vehicle.findMany({
    include: {
      expenses: {
        include: {
          category: true
        }
      },
      sale: true,
      auctionHouse: true
    },
    orderBy: {
      createdAt: "desc"
    }
  });

  const inactiveStatuses: VehicleStatus[] = [VehicleStatus.VENDIDO, VehicleStatus.FINALIZADO, VehicleStatus.CANCELADO];
  const preparationStatuses: VehicleStatus[] = [
    VehicleStatus.ARREMATADO,
    VehicleStatus.PAGO,
    VehicleStatus.AGUARDANDO_RETIRADA,
    VehicleStatus.RETIRADO,
    VehicleStatus.VISTORIA_INICIAL,
    VehicleStatus.ORCAMENTO_REPAROS,
    VehicleStatus.MECANICA,
    VehicleStatus.FUNILARIA,
    VehicleStatus.PINTURA,
    VehicleStatus.ESTETICA
  ];

  const totalInvested = vehicles.reduce((total, vehicle) => total + toNumber(vehicle.totalActualCost || vehicle.totalPredictedCost), 0);
  const capitalParado = vehicles
    .filter((vehicle) => !inactiveStatuses.includes(vehicle.status))
    .reduce((total, vehicle) => total + toNumber(vehicle.totalActualCost || vehicle.totalPredictedCost), 0);
  const retornoPrevisto = vehicles.reduce((total, vehicle) => total + toNumber(vehicle.predictedSalePrice), 0);
  const lucroPrevisto = vehicles.reduce((total, vehicle) => total + toNumber(vehicle.predictedProfit), 0);
  const lucroReal = vehicles.reduce((total, vehicle) => total + toNumber(vehicle.sale?.netProfit ?? vehicle.actualProfit), 0);
  const margemMediaPrevista =
    vehicles.length > 0 ? vehicles.reduce((total, vehicle) => total + toNumber(vehicle.predictedMargin), 0) / vehicles.length : 0;
  const soldVehicles = vehicles.filter((vehicle) => vehicle.sale?.soldAt);
  const margemMediaReal =
    soldVehicles.length > 0
      ? soldVehicles.reduce((total, vehicle) => total + toNumber(vehicle.sale?.netMargin ?? vehicle.actualMargin), 0) / soldVehicles.length
      : 0;
  const vehiclesInPreparation = vehicles.filter((vehicle) => preparationStatuses.includes(vehicle.status)).length;
  const vehiclesAdvertised = vehicles.filter((vehicle) => vehicle.status === VehicleStatus.ANUNCIADO).length;
  const vehiclesSold = vehicles.filter((vehicle) => vehicle.status === VehicleStatus.VENDIDO || vehicle.status === VehicleStatus.FINALIZADO).length;
  const averageTurnover =
    soldVehicles.length > 0
      ? soldVehicles.reduce((total, vehicle) => total + (calculateTurnoverDays(vehicle.bidDate, vehicle.sale?.soldAt) ?? 0), 0) / soldVehicles.length
      : 0;

  const expensesByCategory = Object.values(
    vehicles
      .flatMap((vehicle) => vehicle.expenses)
      .reduce<Record<string, { name: string; value: number }>>((accumulator, expense) => {
        const key = expense.category.name;
        accumulator[key] ??= {
          name: key,
          value: 0
        };
        accumulator[key].value += toNumber(expense.actualAmount || expense.predictedAmount);
        return accumulator;
      }, {})
  );

  const profitByVehicle = vehicles.map((vehicle) => ({
    name: vehicle.stockCode ?? `${vehicle.brand ?? "Lote"} ${vehicle.model ?? ""}`.trim(),
    previsto: toNumber(vehicle.predictedProfit),
    real: toNumber(vehicle.sale?.netProfit ?? vehicle.actualProfit)
  }));

  const statusFunnel = Object.values(
    vehicles.reduce<Record<string, { status: string; total: number }>>((accumulator, vehicle) => {
      accumulator[vehicle.status] ??= {
        status: vehicle.status,
        total: 0
      };
      accumulator[vehicle.status].total += 1;
      return accumulator;
    }, {})
  );

  const capitalEvolution = vehicles
    .slice()
    .sort((first, second) => (first.bidDate?.getTime() ?? 0) - (second.bidDate?.getTime() ?? 0))
    .reduce<Array<{ date: string; invested: number }>>((accumulator, vehicle) => {
      const previous = accumulator.at(-1)?.invested ?? 0;
      accumulator.push({
        date: vehicle.bidDate?.toISOString().slice(0, 10) ?? vehicle.createdAt.toISOString().slice(0, 10),
        invested: previous + toNumber(vehicle.totalPredictedCost || vehicle.bidValue)
      });
      return accumulator;
    }, []);

  const expectedCashIn = vehicles
    .filter((vehicle) => !vehicle.sale)
    .map((vehicle) => ({
      vehicle: `${vehicle.brand ?? ""} ${vehicle.model ?? ""}`.trim(),
      value: toNumber(vehicle.predictedSalePrice),
      status: vehicle.status
    }));

  return {
    metrics: {
      totalInvested,
      capitalParado,
      retornoPrevisto,
      lucroPrevisto,
      lucroReal,
      margemMediaPrevista,
      margemMediaReal,
      vehiclesCount: vehicles.length,
      vehiclesInPreparation,
      vehiclesAdvertised,
      vehiclesSold,
      averageTurnover
    },
    charts: {
      expensesByCategory,
      profitByVehicle,
      statusFunnel,
      capitalEvolution
    },
    expectedCashIn,
    vehicles
  };
}

export async function getVehiclesList() {
  return prisma.vehicle.findMany({
    include: {
      auctionHouse: true,
      opportunityScore: true,
      sale: true,
      financialSummary: true,
      photos: {
        orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
        take: 1
      }
    },
    orderBy: {
      updatedAt: "desc"
    }
  });
}

export async function getVehicleDetail(id: string) {
  const vehicle = await prisma.vehicle.findUnique({
    where: { id },
    include: {
      auctionHouse: true,
      lotSnapshots: {
        orderBy: {
          capturedAt: "desc"
        }
      },
      photos: {
        orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }]
      },
      expenses: {
        include: {
          category: true,
          supplier: true
        },
        orderBy: {
          createdAt: "desc"
        }
      },
      processes: {
        include: {
          processStep: true,
          assignedTo: true
        },
        orderBy: {
          processStep: {
            order: "asc"
          }
        }
      },
      marketResearches: {
        include: {
          listings: {
            include: {
              marketSource: true
            }
          }
        },
        orderBy: {
          researchedAt: "desc"
        }
      },
      simulations: {
        orderBy: {
          createdAt: "desc"
        }
      },
      advertisements: {
        orderBy: {
          createdAt: "desc"
        }
      },
      sale: true,
      financialSummary: true,
      financialEntries: {
        include: {
          category: true,
          subcategory: true,
          payable: true,
          receivable: true,
          supplier: true
        },
        orderBy: {
          createdAt: "desc"
        }
      },
      cashFlows: {
        orderBy: {
          createdAt: "desc"
        }
      },
      opportunityScore: true,
      aiAnalyses: {
        orderBy: {
          createdAt: "desc"
        }
      }
    }
  });

  if (!vehicle) {
    return null;
  }

  const documents = await getVehicleDocumentsRaw(id);

  return {
    ...vehicle,
    documents
  };
}

export async function getExpensesOverview() {
  const [expenses, vehicles, suppliers, categories] = await Promise.all([
    prisma.expense.findMany({
      include: {
        vehicle: true,
        category: true,
        supplier: true
      },
      orderBy: {
        createdAt: "desc"
      }
    }),
    prisma.vehicle.findMany({ orderBy: { stockCode: "asc" } }),
    prisma.supplier.findMany({ orderBy: { name: "asc" } }),
    prisma.expenseCategory.findMany({ where: { active: true }, orderBy: { name: "asc" } })
  ]);

  return { expenses, vehicles, suppliers, categories };
}

export async function getFinancialOverview() {
  const [
    entries,
    categories,
    vehicles,
    suppliers,
    payables,
    receivables,
    summaries,
    legacyCounts
  ] = await Promise.all([
    prisma.financialEntry.findMany({
      include: {
        category: true,
        subcategory: true,
        vehicle: {
          select: {
            id: true,
            stockCode: true,
            brand: true,
            model: true,
            version: true,
            status: true,
            auctionHouse: true
          }
        },
        supplier: true,
        payable: true,
        receivable: true
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 250
    }),
    prisma.financialCategory.findMany({
      include: {
        subcategories: {
          orderBy: {
            name: "asc"
          }
        }
      },
      orderBy: [{ scope: "asc" }, { name: "asc" }]
    }),
    prisma.vehicle.findMany({
      include: {
        auctionHouse: true,
        sale: true,
        financialSummary: true
      },
      orderBy: {
        updatedAt: "desc"
      }
    }),
    prisma.supplier.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.payable.findMany({
      include: {
        transaction: {
          include: {
            category: true,
            vehicle: true,
            supplier: true
          }
        },
        vehicle: true,
        supplier: true
      },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
      take: 80
    }),
    prisma.receivable.findMany({
      include: {
        transaction: {
          include: {
            category: true,
            vehicle: true
          }
        },
        vehicle: true,
        sale: true
      },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
      take: 80
    }),
    prisma.vehicleFinancialSummary.findMany({
      include: {
        vehicle: {
          include: {
            auctionHouse: true,
            sale: true
          }
        }
      },
      orderBy: {
        netProfit: "desc"
      }
    }),
    Promise.all([
      prisma.expense.count(),
      prisma.sale.count(),
      prisma.cashFlow.count(),
      prisma.financialEntry.count()
    ])
  ]);

  const [legacyExpensesCount, legacySalesCount, legacyCashFlowsCount, financialEntriesCount] = legacyCounts;
  const calculationEntries = entries.filter((entry) => !entry.isAnomalous && entry.status !== FinancialEntryStatus.CANCELLED);
  const outEntries = calculationEntries.filter((entry) => entry.type === FinancialEntryType.OUT);
  const inEntries = calculationEntries.filter((entry) => entry.type === FinancialEntryType.IN);

  const paidOut = outEntries
    .filter((entry) => settledOutStatuses.includes(entry.status))
    .reduce((total, entry) => total + toNumber(entry.paidAmount ?? entry.amount), 0);
  const receivedIn = inEntries
    .filter((entry) => settledInStatuses.includes(entry.status))
    .reduce((total, entry) => total + toNumber(entry.paidAmount ?? entry.amount), 0);
  const projectedOut = outEntries.reduce((total, entry) => total + toNumber(entry.amount), 0);
  const projectedIn = inEntries.reduce((total, entry) => total + toNumber(entry.amount), 0);
  const accountsPayable = outEntries
    .filter((entry) => payableStatuses.includes(entry.status))
    .reduce((total, entry) => total + Math.max(toNumber(entry.amount) - toNumber(entry.paidAmount), 0), 0);
  const accountsReceivable = inEntries
    .filter((entry) => receivableStatuses.includes(entry.status))
    .reduce((total, entry) => total + Math.max(toNumber(entry.amount) - toNumber(entry.paidAmount), 0), 0);

  const totalInvestedInStock = summaries.reduce((total, summary) => total + toNumber(summary.totalCost), 0);
  const analysisCapital = summaries
    .filter((summary) => summary.vehicle.status === VehicleStatus.ANALISE_LOTE)
    .reduce((total, summary) => total + toNumber(summary.totalCost), 0);
  const preparationStatuses: VehicleStatus[] = [
    VehicleStatus.ARREMATADO,
    VehicleStatus.AGUARDANDO_PAGAMENTO,
    VehicleStatus.PAGO,
    VehicleStatus.AGUARDANDO_RETIRADA,
    VehicleStatus.RETIRADO,
    VehicleStatus.VISTORIA_INICIAL,
    VehicleStatus.ORCAMENTO_REPAROS,
    VehicleStatus.MECANICA,
    VehicleStatus.FUNILARIA,
    VehicleStatus.PINTURA,
    VehicleStatus.ESTETICA,
    VehicleStatus.DOCUMENTACAO
  ];
  const preparationCapital = summaries
    .filter((summary) => preparationStatuses.includes(summary.vehicle.status))
    .reduce((total, summary) => total + toNumber(summary.totalCost), 0);
  const grossProfit = summaries.reduce((total, summary) => total + toNumber(summary.grossProfit), 0);
  const netProfit = summaries.reduce((total, summary) => total + toNumber(summary.netProfit), 0);
  const marginAverage = summaries.length > 0 ? summaries.reduce((total, summary) => total + toNumber(summary.marginPercent), 0) / summaries.length : 0;
  const roiAverage = summaries.length > 0 ? summaries.reduce((total, summary) => total + toNumber(summary.roiPercent), 0) / summaries.length : 0;

  const expensesByCategory = Object.values(
    outEntries.reduce<Record<string, { name: string; value: number }>>((accumulator, entry) => {
      const name = entry.category?.name ?? "Sem categoria";
      accumulator[name] ??= {
        name,
        value: 0
      };
      accumulator[name].value += toNumber(entry.amount);
      return accumulator;
    }, {})
  ).sort((first, second) => second.value - first.value);

  const entriesByMonth = Object.values(
    calculationEntries.reduce<Record<string, { month: string; entradas: number; saidas: number }>>((accumulator, entry) => {
      const date = entry.competenceDate ?? entry.dueDate ?? entry.createdAt;
      const month = date.toISOString().slice(0, 7);
      accumulator[month] ??= {
        month,
        entradas: 0,
        saidas: 0
      };
      if (entry.type === FinancialEntryType.IN) {
        accumulator[month].entradas += toNumber(entry.amount);
      } else if (entry.type === FinancialEntryType.OUT) {
        accumulator[month].saidas += toNumber(entry.amount);
      }
      return accumulator;
    }, {})
  ).sort((first, second) => first.month.localeCompare(second.month));

  const profitByVehicle = summaries.map((summary) => ({
    vehicle: summary.vehicle.stockCode ?? `${summary.vehicle.brand ?? ""} ${summary.vehicle.model ?? ""}`.trim(),
    bruto: toNumber(summary.grossProfit),
    liquido: toNumber(summary.netProfit),
    margem: toNumber(summary.marginPercent),
    roi: toNumber(summary.roiPercent)
  }));

  const investmentByStatus = Object.values(
    summaries.reduce<Record<string, { status: string; value: number }>>((accumulator, summary) => {
      accumulator[summary.vehicle.status] ??= {
        status: summary.vehicle.status,
        value: 0
      };
      accumulator[summary.vehicle.status].value += toNumber(summary.totalCost);
      return accumulator;
    }, {})
  );

  return {
    entries,
    categories,
    vehicles,
    suppliers,
    payables,
    receivables,
    summaries,
    legacyStatus: {
      legacyExpensesCount,
      legacySalesCount,
      legacyCashFlowsCount,
      financialEntriesCount,
      needsSync: legacyExpensesCount + legacySalesCount + legacyCashFlowsCount > 0 && financialEntriesCount === 0
    },
    metrics: {
      cashBalance: receivedIn - paidOut,
      periodIn: projectedIn,
      periodOut: projectedOut,
      accountsPayable,
      accountsReceivable,
      totalInvestedInStock,
      analysisCapital,
      preparationCapital,
      grossProfit,
      netProfit,
      marginAverage,
      roiAverage
    },
    charts: {
      expensesByCategory,
      entriesByMonth,
      profitByVehicle,
      investmentByStatus
    },
    recentEntries: entries.slice(0, 12),
    anomalousLegacyEntries: entries.filter((entry) => entry.isAnomalous),
    topProfitVehicles: summaries.slice().sort((first, second) => toNumber(second.netProfit) - toNumber(first.netProfit)).slice(0, 8),
    highCostVehicles: summaries.slice().sort((first, second) => toNumber(second.totalCost) - toNumber(first.totalCost)).slice(0, 8),
    negativeMarginVehicles: summaries.filter((summary) => toNumber(summary.marginPercent) < 0)
  };
}

export async function getProcessOverview() {
  const [vehicles, steps] = await Promise.all([
    prisma.vehicle.findMany({
      include: {
        opportunityScore: true,
        processes: {
          include: {
            processStep: true
          }
        }
      },
      orderBy: {
        updatedAt: "desc"
      }
    }),
    prisma.processStep.findMany({
      where: {
        active: true
      },
      orderBy: {
        order: "asc"
      }
    })
  ]);

  return {
    vehicles: vehicles.map((vehicle) => {
      const inspectionProcess = vehicle.processes.find((process) => process.processStep.slug === "vistoria-inicial");
      const inspectionPayload = parseInitialInspectionPayload(
        inspectionProcess?.attachments && typeof inspectionProcess.attachments === "object"
          ? (inspectionProcess.attachments as { inspectionChecklist?: unknown }).inspectionChecklist
          : undefined
      );

      return {
        ...vehicle,
        inspectionSummary: getInitialInspectionSummary(inspectionPayload),
        hasInspectionChecklist: Boolean(inspectionProcess),
        inspectionReadyForRepairs:
          getInitialInspectionSummary(inspectionPayload).completed === getInitialInspectionSummary(inspectionPayload).total &&
          getInitialInspectionSummary(inspectionPayload).total > 0
      };
    }),
    steps
  };
}

export async function getSimulationsOverview() {
  const [simulations, vehicles] = await Promise.all([
    prisma.simulation.findMany({
      include: {
        vehicle: true
      },
      orderBy: {
        createdAt: "desc"
      }
    }),
    prisma.vehicle.findMany({ orderBy: { stockCode: "asc" } })
  ]);

  return { simulations, vehicles };
}

export async function getMarketOverview() {
  const [researches, vehicles, sources] = await Promise.all([
    prisma.marketResearch.findMany({
      include: {
        vehicle: true,
        listings: {
          include: {
            marketSource: true
          }
        }
      },
      orderBy: {
        researchedAt: "desc"
      }
    }),
    prisma.vehicle.findMany({ orderBy: { stockCode: "asc" } }),
    prisma.marketSource.findMany({ where: { active: true }, orderBy: { name: "asc" } })
  ]);

  return { researches, vehicles, sources };
}

export async function getSuppliersOverview() {
  return prisma.supplier.findMany({
    include: {
      expenses: true
    },
    orderBy: {
      name: "asc"
    }
  });
}

export async function getDocumentsOverview() {
  return getVehicleDocumentsRaw();
}

export async function getPhotosOverview() {
  return prisma.vehiclePhoto.findMany({
    include: {
      vehicle: true,
      uploadedBy: true
    },
    orderBy: [{ createdAt: "desc" }, { sortOrder: "asc" }]
  });
}

export async function getSalesOverview() {
  const [vehicles, sales, leads, ads] = await Promise.all([
    prisma.vehicle.findMany({
      include: {
        sale: true,
        advertisements: true
      },
      orderBy: {
        updatedAt: "desc"
      }
    }),
    prisma.sale.findMany({
      include: {
        vehicle: true
      },
      orderBy: {
        soldAt: "desc"
      }
    }),
    prisma.lead.findMany({
      include: {
        vehicle: true
      },
      orderBy: {
        updatedAt: "desc"
      }
    }),
    prisma.advertisement.findMany({
      include: {
        vehicle: true
      },
      orderBy: {
        publishedAt: "desc"
      }
    })
  ]);

  return { vehicles, sales, leads, ads };
}

export async function getReportsOverview() {
  const dashboard = await getDashboardData();
  const [sales, suppliers, checklistVehicles] = await Promise.all([
    prisma.sale.findMany({
      include: {
        vehicle: true
      }
    }),
    prisma.supplier.findMany({
      include: {
        expenses: true
      }
    }),
    prisma.vehicle.findMany({
      include: {
        processes: {
          include: {
            processStep: true
          }
        }
      },
      orderBy: {
        updatedAt: "desc"
      }
    })
  ]);

  const marginByAuctionHouse = Object.values(
    dashboard.vehicles.reduce<Record<string, { name: string; value: number; count: number }>>((accumulator, vehicle) => {
      const name = vehicle.auctionHouseId ?? "sem_leiloeira";
      const label = vehicle.auctionHouse?.name ?? "Sem leiloeira";
      accumulator[name] ??= {
        name: label,
        value: 0,
        count: 0
      };
      accumulator[name].value += toNumber(vehicle.predictedMargin);
      accumulator[name].count += 1;
      return accumulator;
    }, {})
  ).map((item) => ({
    name: item.name,
    value: item.count ? item.value / item.count : 0
  }));

  const commercialRows = sales.map((sale) => ({
    vehicle: `${sale.vehicle.brand ?? ""} ${sale.vehicle.model ?? ""}`.trim(),
    anunciado: toNumber(sale.listedPrice),
    vendido: toNumber(sale.soldPrice),
    desconto: toNumber(sale.discountGranted),
    canal: sale.saleChannel ?? "Pendente",
    dias: sale.daysToSale ?? 0
  }));

  return {
    ...dashboard,
    marginByAuctionHouse,
    commercialRows,
    auctionHouseRanking: buildAuctionHouseRanking(
      dashboard.vehicles.map((vehicle) => ({
        auctionHouse: vehicle.auctionHouse,
        predictedMargin: toNumber(vehicle.predictedMargin),
        actualMargin: toNumber(vehicle.actualMargin),
        pendingFields: vehicle.pendingFields,
        predictedProfit: toNumber(vehicle.predictedProfit),
        actualProfit: toNumber(vehicle.actualProfit)
      }))
    ),
    supplierRanking: buildSupplierRanking(
      suppliers.map((supplier) => ({
        name: supplier.name,
        averageCost: toNumber(supplier.averageCost),
        averageLeadTime: supplier.averageLeadTime ?? 0,
        rating: supplier.rating ?? 0,
        expenses: supplier.expenses.map((expense) => ({
          actualAmount: toNumber(expense.actualAmount)
        }))
      }))
    ),
    checklistRows: checklistVehicles.map((vehicle) => {
      const inspectionProcess = vehicle.processes.find((process) => process.processStep.slug === "vistoria-inicial");
      const inspectionPayload = parseInitialInspectionPayload(
        inspectionProcess?.attachments && typeof inspectionProcess.attachments === "object"
          ? (inspectionProcess.attachments as { inspectionChecklist?: unknown }).inspectionChecklist
          : undefined
      );
      const inspectionSummary = getInitialInspectionSummary(inspectionPayload);

      return {
        vehicle: `${vehicle.stockCode ?? "Sem estoque"} - ${[vehicle.brand, vehicle.model].filter(Boolean).join(" ") || "Veiculo"}`,
        status: vehicle.status,
        completed: inspectionSummary.completed,
        total: inspectionSummary.total,
        progressPercent: inspectionSummary.progressPercent,
        okCount: inspectionSummary.okCount,
        attentionCount: inspectionSummary.attentionCount,
        notOkCount: inspectionSummary.notOkCount,
        hasChecklist: Boolean(inspectionProcess)
      };
    })
  };
}

export async function getSettingsOverview() {
  return prisma.setting.findMany({
    orderBy: [{ group: "asc" }, { label: "asc" }]
  });
}
