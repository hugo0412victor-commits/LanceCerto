import {
  ExpenseCategoryType,
  FinancialCategoryScope,
  FinancialCategoryType,
  FinancialEntrySourceType,
  FinancialEntryStatus,
  FinancialEntryType,
  PaymentMethod,
  PaymentStatus,
  Prisma,
  type PrismaClient
} from "@prisma/client";
import { EXPENSE_CATEGORY_LABELS } from "@/lib/constants";

type LedgerPrisma = PrismaClient | Prisma.TransactionClient;

const toNumber = (value?: number | string | Prisma.Decimal | null) => {
  if (value === null || value === undefined) return 0;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toDecimal = (value: number) => new Prisma.Decimal(Math.round(value * 100) / 100);

const normalizeAmount = (value?: number | string | Prisma.Decimal | null) => toDecimal(toNumber(value));

const VEHICLE_CORE_FIELDS = [
  { field: "bidValue", categoryCode: ExpenseCategoryType.ARREMATE, label: "Valor de arremate" },
  { field: "auctionCommission", categoryCode: ExpenseCategoryType.COMISSAO_LEILAO, label: "Comissao do leilao" },
  { field: "administrativeFees", categoryCode: ExpenseCategoryType.TAXA_ADMINISTRATIVA, label: "Taxas administrativas" },
  { field: "yardCost", categoryCode: ExpenseCategoryType.PATIO, label: "Patio" },
  { field: "towCost", categoryCode: ExpenseCategoryType.GUINCHO, label: "Guincho" },
  { field: "documentationExpected", categoryCode: ExpenseCategoryType.DOCUMENTACAO, label: "Documentacao" },
  { field: "repairsExpected", categoryCode: ExpenseCategoryType.MECANICA, label: "Reparos previstos" }
] as const;

const SALE_COST_CATEGORIES = new Set<ExpenseCategoryType>([
  ExpenseCategoryType.ANUNCIOS,
  ExpenseCategoryType.COMISSAO_VENDA,
  ExpenseCategoryType.IMPOSTOS,
  ExpenseCategoryType.TAXAS_BANCARIAS,
  ExpenseCategoryType.JUROS
]);

const REPAIR_CATEGORIES = new Set<ExpenseCategoryType>([
  ExpenseCategoryType.MECANICA,
  ExpenseCategoryType.FUNILARIA,
  ExpenseCategoryType.PINTURA,
  ExpenseCategoryType.ESTETICA,
  ExpenseCategoryType.HIGIENIZACAO,
  ExpenseCategoryType.PECAS
]);

const AUCTION_FEE_CATEGORIES = new Set<ExpenseCategoryType>([
  ExpenseCategoryType.COMISSAO_LEILAO,
  ExpenseCategoryType.TAXA_ADMINISTRATIVA,
  ExpenseCategoryType.PATIO
]);

function paymentStatusToFinancialStatus(status?: PaymentStatus | null, actualAmount = 0) {
  if (status === PaymentStatus.PAID) return FinancialEntryStatus.PAID;
  if (status === PaymentStatus.PARTIAL) return FinancialEntryStatus.PARTIAL;
  if (status === PaymentStatus.CANCELLED) return FinancialEntryStatus.CANCELLED;
  if (actualAmount > 0) return FinancialEntryStatus.PAID;
  return FinancialEntryStatus.PENDING;
}

function receivedStatus(amount: number, receivedAmount: number) {
  if (receivedAmount >= amount && amount > 0) return FinancialEntryStatus.RECEIVED;
  if (receivedAmount > 0) return FinancialEntryStatus.PARTIAL;
  return FinancialEntryStatus.PENDING;
}

function scopeForExpenseCategory(code?: ExpenseCategoryType | null) {
  if (!code) return FinancialCategoryScope.OTHER;
  if (SALE_COST_CATEGORIES.has(code)) return FinancialCategoryScope.SALE;
  if (code === ExpenseCategoryType.IMPOSTOS || code === ExpenseCategoryType.TAXAS_BANCARIAS || code === ExpenseCategoryType.JUROS) {
    return FinancialCategoryScope.TAX;
  }
  return FinancialCategoryScope.VEHICLE;
}

async function ensureCategory(
  prisma: LedgerPrisma,
  name: string,
  type: FinancialCategoryType,
  scope: FinancialCategoryScope,
  legacyExpenseCategoryCode?: ExpenseCategoryType
) {
  return prisma.financialCategory.upsert({
    where: {
      name_type_scope: {
        name,
        type,
        scope
      }
    },
    update: {
      isDefault: true,
      legacyExpenseCategoryCode
    },
    create: {
      name,
      type,
      scope,
      isDefault: true,
      legacyExpenseCategoryCode
    }
  });
}

async function ensureSubcategory(prisma: LedgerPrisma, categoryId: string, name: string) {
  return prisma.financialSubcategory.upsert({
    where: {
      categoryId_name: {
        categoryId,
        name
      }
    },
    update: {},
    create: {
      categoryId,
      name
    }
  });
}

export async function ensureFinancialDefaults(prisma: LedgerPrisma) {
  const vehicleExpenseCategories = new Map<ExpenseCategoryType, string>();

  for (const [code, label] of Object.entries(EXPENSE_CATEGORY_LABELS) as Array<[ExpenseCategoryType, string]>) {
    const category = await ensureCategory(prisma, label, FinancialCategoryType.EXPENSE, scopeForExpenseCategory(code), code);
    vehicleExpenseCategories.set(code, category.id);
    await ensureSubcategory(prisma, category.id, "Importado do sistema anterior");
  }

  const operational = await ensureCategory(prisma, "Despesa operacional", FinancialCategoryType.EXPENSE, FinancialCategoryScope.OPERATIONAL);
  const sale = await ensureCategory(prisma, "Venda de veiculo", FinancialCategoryType.INCOME, FinancialCategoryScope.SALE);
  const legacy = await ensureCategory(prisma, "Fluxo legado", FinancialCategoryType.ADJUSTMENT, FinancialCategoryScope.OTHER);
  const manualIn = await ensureCategory(prisma, "Entrada manual", FinancialCategoryType.INCOME, FinancialCategoryScope.OTHER);
  const manualOut = await ensureCategory(prisma, "Saida manual", FinancialCategoryType.EXPENSE, FinancialCategoryScope.OTHER);

  await Promise.all([
    ensureSubcategory(prisma, operational.id, "Sem veiculo vinculado"),
    ensureSubcategory(prisma, sale.id, "Recebimento de venda"),
    ensureSubcategory(prisma, legacy.id, "Importado do CashFlow legado"),
    ensureSubcategory(prisma, manualIn.id, "Lancamento manual"),
    ensureSubcategory(prisma, manualOut.id, "Lancamento manual")
  ]);

  await prisma.financialAccount.upsert({
    where: {
      id: "default-operational-account"
    },
    update: {
      name: "Conta operacional principal",
      active: true
    },
    create: {
      id: "default-operational-account",
      name: "Conta operacional principal"
    }
  });

  return {
    expenseCategories: vehicleExpenseCategories,
    operationalCategoryId: operational.id,
    saleCategoryId: sale.id,
    legacyCategoryId: legacy.id,
    manualInCategoryId: manualIn.id,
    manualOutCategoryId: manualOut.id
  };
}

async function upsertPayableForEntry(
  prisma: LedgerPrisma,
  entry: { id: string; vehicleId: string | null; supplierId: string | null; amount: Prisma.Decimal; paidAmount: Prisma.Decimal | null; dueDate: Date | null; status: FinancialEntryStatus }
) {
  await prisma.payable.upsert({
    where: {
      transactionId: entry.id
    },
    update: {
      vehicleId: entry.vehicleId,
      supplierId: entry.supplierId,
      amount: entry.amount,
      paidAmount: entry.paidAmount ?? toDecimal(0),
      dueDate: entry.dueDate,
      status: entry.status
    },
    create: {
      transactionId: entry.id,
      vehicleId: entry.vehicleId,
      supplierId: entry.supplierId,
      amount: entry.amount,
      paidAmount: entry.paidAmount ?? toDecimal(0),
      dueDate: entry.dueDate,
      status: entry.status
    }
  });
}

async function upsertReceivableForEntry(
  prisma: LedgerPrisma,
  entry: { id: string; vehicleId: string | null; amount: Prisma.Decimal; paidAmount: Prisma.Decimal | null; dueDate: Date | null; status: FinancialEntryStatus; customerName: string | null },
  saleId?: string | null
) {
  await prisma.receivable.upsert({
    where: {
      transactionId: entry.id
    },
    update: {
      vehicleId: entry.vehicleId,
      saleId,
      customerName: entry.customerName,
      amount: entry.amount,
      receivedAmount: entry.paidAmount ?? toDecimal(0),
      dueDate: entry.dueDate,
      status: entry.status
    },
    create: {
      transactionId: entry.id,
      vehicleId: entry.vehicleId,
      saleId,
      customerName: entry.customerName,
      amount: entry.amount,
      receivedAmount: entry.paidAmount ?? toDecimal(0),
      dueDate: entry.dueDate,
      status: entry.status
    }
  });
}

export async function syncFinancialLedgerFromLegacy(prisma: LedgerPrisma) {
  const defaults = await ensureFinancialDefaults(prisma);
  let createdOrUpdated = 0;

  const expenses = await prisma.expense.findMany({
    include: {
      category: true
    }
  });

  for (const expense of expenses) {
    const actual = toNumber(expense.actualAmount);
    const predicted = toNumber(expense.predictedAmount);
    const amount = actual || predicted;
    if (amount <= 0) {
      if (expense.paymentStatus === PaymentStatus.CANCELLED) {
        await prisma.financialEntry.updateMany({
          where: {
            sourceType: FinancialEntrySourceType.EXPENSE,
            sourceId: expense.id
          },
          data: {
            amount: toDecimal(0),
            paidAmount: toDecimal(0),
            status: FinancialEntryStatus.CANCELLED,
            notes: expense.note ?? "Despesa original preservada e cancelada."
          }
        });
      }
      continue;
    }

    const categoryId =
      defaults.expenseCategories.get(expense.category.code) ??
      defaults.expenseCategories.get(ExpenseCategoryType.OUTROS) ??
      defaults.operationalCategoryId;
    const importedSubcategory = await ensureSubcategory(prisma, categoryId, "Importado do sistema anterior");
    const status = paymentStatusToFinancialStatus(expense.paymentStatus, actual);

    const entry = await prisma.financialEntry.upsert({
      where: {
        sourceType_sourceId: {
          sourceType: FinancialEntrySourceType.EXPENSE,
          sourceId: expense.id
        }
      },
      update: {
        description: expense.description,
        amount: normalizeAmount(amount),
        paidAmount: normalizeAmount(actual),
        categoryId,
        subcategoryId: importedSubcategory.id,
        vehicleId: expense.vehicleId,
        supplierId: expense.supplierId,
        dueDate: expense.dueDate,
        competenceDate: expense.date ?? expense.createdAt,
        paidAt: status === FinancialEntryStatus.PAID ? expense.date ?? expense.updatedAt : null,
        paymentMethod: expense.paymentMethod,
        status,
        notes: expense.note,
        attachmentUrl: expense.proofPath,
        isLegacy: true,
        isAnomalous: false
      },
      create: {
        type: FinancialEntryType.OUT,
        status,
        sourceType: FinancialEntrySourceType.EXPENSE,
        sourceId: expense.id,
        legacyReference: `Expense:${expense.id}`,
        description: expense.description,
        amount: normalizeAmount(amount),
        paidAmount: normalizeAmount(actual),
        categoryId,
        subcategoryId: importedSubcategory.id,
        vehicleId: expense.vehicleId,
        supplierId: expense.supplierId,
        dueDate: expense.dueDate,
        competenceDate: expense.date ?? expense.createdAt,
        paidAt: status === FinancialEntryStatus.PAID ? expense.date ?? expense.updatedAt : null,
        paymentMethod: expense.paymentMethod,
        notes: expense.note,
        attachmentUrl: expense.proofPath,
        isLegacy: true
      }
    });

    await upsertPayableForEntry(prisma, entry);
    createdOrUpdated += 1;
  }

  const vehicles = await prisma.vehicle.findMany({
    include: {
      expenses: {
        include: {
          category: true
        }
      },
      sale: true
    }
  });

  for (const vehicle of vehicles) {
    for (const definition of VEHICLE_CORE_FIELDS) {
      const amount = toNumber(vehicle[definition.field]);
      if (amount <= 0) continue;

      const alreadyRepresentedByExpense = vehicle.expenses.some((expense) => expense.category.code === definition.categoryCode);
      if (alreadyRepresentedByExpense) continue;

      const categoryId =
        defaults.expenseCategories.get(definition.categoryCode) ??
        defaults.expenseCategories.get(ExpenseCategoryType.OUTROS) ??
        defaults.operationalCategoryId;
      const importedSubcategory = await ensureSubcategory(prisma, categoryId, "Importado do sistema anterior");

      const entry = await prisma.financialEntry.upsert({
        where: {
          sourceType_sourceId: {
            sourceType: FinancialEntrySourceType.VEHICLE_CORE_COST,
            sourceId: `${vehicle.id}:${definition.field}`
          }
        },
        update: {
          description: definition.label,
          amount: normalizeAmount(amount),
          paidAmount: normalizeAmount(amount),
          categoryId,
          subcategoryId: importedSubcategory.id,
          vehicleId: vehicle.id,
          dueDate: vehicle.bidDate,
          competenceDate: vehicle.bidDate ?? vehicle.createdAt,
          paidAt: vehicle.bidDate,
          status: FinancialEntryStatus.PAID,
          isLegacy: true,
          isAnomalous: false
        },
        create: {
          type: FinancialEntryType.OUT,
          status: FinancialEntryStatus.PAID,
          sourceType: FinancialEntrySourceType.VEHICLE_CORE_COST,
          sourceId: `${vehicle.id}:${definition.field}`,
          legacyReference: `Vehicle:${vehicle.id}:${definition.field}`,
          description: definition.label,
          amount: normalizeAmount(amount),
          paidAmount: normalizeAmount(amount),
          categoryId,
          subcategoryId: importedSubcategory.id,
          vehicleId: vehicle.id,
          dueDate: vehicle.bidDate,
          competenceDate: vehicle.bidDate ?? vehicle.createdAt,
          paidAt: vehicle.bidDate,
          isLegacy: true
        }
      });

      await upsertPayableForEntry(prisma, entry);
      createdOrUpdated += 1;
    }

    if (vehicle.sale && toNumber(vehicle.sale.soldPrice) > 0) {
      const amount = toNumber(vehicle.sale.soldPrice);
      const receivedAmount = toNumber(vehicle.sale.soldPrice);
      const status = receivedStatus(amount, receivedAmount);
      const entry = await prisma.financialEntry.upsert({
        where: {
          sourceType_sourceId: {
            sourceType: FinancialEntrySourceType.SALE,
            sourceId: vehicle.sale.id
          }
        },
        update: {
          description: `Recebimento da venda ${vehicle.stockCode ?? vehicle.id}`,
          amount: normalizeAmount(amount),
          paidAmount: normalizeAmount(receivedAmount),
          categoryId: defaults.saleCategoryId,
          vehicleId: vehicle.id,
          customerName: vehicle.sale.buyerName,
          dueDate: vehicle.sale.soldAt,
          competenceDate: vehicle.sale.soldAt ?? vehicle.sale.createdAt,
          receivedAt: vehicle.sale.soldAt,
          paymentMethod: vehicle.sale.paymentMethod,
          status,
          notes: vehicle.sale.notes,
          isLegacy: true,
          isAnomalous: false
        },
        create: {
          type: FinancialEntryType.IN,
          status,
          sourceType: FinancialEntrySourceType.SALE,
          sourceId: vehicle.sale.id,
          legacyReference: `Sale:${vehicle.sale.id}`,
          description: `Recebimento da venda ${vehicle.stockCode ?? vehicle.id}`,
          amount: normalizeAmount(amount),
          paidAmount: normalizeAmount(receivedAmount),
          categoryId: defaults.saleCategoryId,
          vehicleId: vehicle.id,
          customerName: vehicle.sale.buyerName,
          dueDate: vehicle.sale.soldAt,
          competenceDate: vehicle.sale.soldAt ?? vehicle.sale.createdAt,
          receivedAt: vehicle.sale.soldAt,
          paymentMethod: vehicle.sale.paymentMethod,
          notes: vehicle.sale.notes,
          isLegacy: true
        }
      });

      await upsertReceivableForEntry(prisma, entry, vehicle.sale.id);
      createdOrUpdated += 1;
    }
  }

  const cashFlows = await prisma.cashFlow.findMany();
  const vehicleIds = new Set(vehicles.map((vehicle) => vehicle.id));

  for (const cashFlow of cashFlows) {
    const amount = toNumber(cashFlow.amount);
    const vehicleId = cashFlow.vehicleId && vehicleIds.has(cashFlow.vehicleId) ? cashFlow.vehicleId : null;
    const isAnomalous = !vehicleId || amount > 5_000_000;
    const entryType = cashFlow.type === "IN" ? FinancialEntryType.IN : FinancialEntryType.OUT;
    const status =
      cashFlow.status === "REALIZED"
        ? entryType === FinancialEntryType.IN
          ? FinancialEntryStatus.RECEIVED
          : FinancialEntryStatus.PAID
        : cashFlow.status === "CANCELLED"
          ? FinancialEntryStatus.CANCELLED
          : FinancialEntryStatus.PENDING;

    await prisma.financialEntry.upsert({
      where: {
        sourceType_sourceId: {
          sourceType: FinancialEntrySourceType.CASHFLOW_LEGACY,
          sourceId: cashFlow.id
        }
      },
      update: {
        type: entryType,
        description: cashFlow.description,
        amount: normalizeAmount(amount),
        paidAmount: status === FinancialEntryStatus.PAID || status === FinancialEntryStatus.RECEIVED ? normalizeAmount(amount) : toDecimal(0),
        categoryId: defaults.legacyCategoryId,
        vehicleId,
        dueDate: cashFlow.expectedAt,
        competenceDate: cashFlow.occurredAt ?? cashFlow.expectedAt ?? cashFlow.createdAt,
        paidAt: entryType === FinancialEntryType.OUT ? cashFlow.occurredAt : null,
        receivedAt: entryType === FinancialEntryType.IN ? cashFlow.occurredAt : null,
        paymentMethod: cashFlow.paymentMethod,
        status,
        notes: [cashFlow.notes, isAnomalous ? "Importado como legado/anomalo; excluido dos calculos principais ate validacao." : null]
          .filter(Boolean)
          .join(" "),
        isLegacy: true,
        isAnomalous
      },
      create: {
        type: entryType,
        status,
        sourceType: FinancialEntrySourceType.CASHFLOW_LEGACY,
        sourceId: cashFlow.id,
        legacyReference: `CashFlow:${cashFlow.id}`,
        description: cashFlow.description,
        amount: normalizeAmount(amount),
        paidAmount: status === FinancialEntryStatus.PAID || status === FinancialEntryStatus.RECEIVED ? normalizeAmount(amount) : toDecimal(0),
        categoryId: defaults.legacyCategoryId,
        vehicleId,
        dueDate: cashFlow.expectedAt,
        competenceDate: cashFlow.occurredAt ?? cashFlow.expectedAt ?? cashFlow.createdAt,
        paidAt: entryType === FinancialEntryType.OUT ? cashFlow.occurredAt : null,
        receivedAt: entryType === FinancialEntryType.IN ? cashFlow.occurredAt : null,
        paymentMethod: cashFlow.paymentMethod,
        notes: isAnomalous ? "Importado como legado/anomalo; excluido dos calculos principais ate validacao." : cashFlow.notes,
        isLegacy: true,
        isAnomalous
      }
    });
    createdOrUpdated += 1;
  }

  await refreshAllVehicleFinancialSummaries(prisma);

  return {
    syncedEntries: createdOrUpdated
  };
}

export async function refreshAllVehicleFinancialSummaries(prisma: LedgerPrisma) {
  const vehicles = await prisma.vehicle.findMany({
    select: {
      id: true
    }
  });

  for (const vehicle of vehicles) {
    await refreshVehicleFinancialSummary(prisma, vehicle.id);
  }
}

export async function refreshVehicleFinancialSummary(prisma: LedgerPrisma, vehicleId: string) {
  const vehicle = await prisma.vehicle.findUnique({
    where: {
      id: vehicleId
    },
    include: {
      sale: true,
      financialEntries: {
        where: {
          isAnomalous: false,
          status: {
            not: FinancialEntryStatus.CANCELLED
          }
        },
        include: {
          category: true
        }
      }
    }
  });

  if (!vehicle) return null;

  let purchaseAmount = 0;
  let auctionFees = 0;
  let transportCost = 0;
  let documentationCost = 0;
  let repairCost = 0;
  let sellingCost = 0;
  let operationalCost = 0;
  let pendingExpenses = 0;
  let receivedAmount = 0;

  for (const entry of vehicle.financialEntries) {
    const amount = toNumber(entry.amount);
    const paidAmount = toNumber(entry.paidAmount);
    const legacyCode = entry.category?.legacyExpenseCategoryCode ?? undefined;

    if (entry.type === FinancialEntryType.IN) {
      receivedAmount += paidAmount || (entry.status === FinancialEntryStatus.RECEIVED ? amount : 0);
      continue;
    }

    if (entry.type !== FinancialEntryType.OUT) continue;

    if (legacyCode === ExpenseCategoryType.ARREMATE) purchaseAmount += amount;
    else if (legacyCode && AUCTION_FEE_CATEGORIES.has(legacyCode)) auctionFees += amount;
    else if (legacyCode === ExpenseCategoryType.GUINCHO) transportCost += amount;
    else if (legacyCode === ExpenseCategoryType.DOCUMENTACAO || legacyCode === ExpenseCategoryType.DESPACHANTE) documentationCost += amount;
    else if (legacyCode && REPAIR_CATEGORIES.has(legacyCode)) repairCost += amount;
    else if (legacyCode && SALE_COST_CATEGORIES.has(legacyCode)) sellingCost += amount;
    else operationalCost += amount;

    if (entry.status === FinancialEntryStatus.PENDING || entry.status === FinancialEntryStatus.OVERDUE || entry.status === FinancialEntryStatus.PARTIAL) {
      pendingExpenses += Math.max(amount - paidAmount, 0);
    }
  }

  const totalCost = purchaseAmount + auctionFees + transportCost + documentationCost + repairCost + sellingCost + operationalCost;
  const expectedSalePrice = toNumber(vehicle.predictedSalePrice);
  const actualSalePrice = toNumber(vehicle.sale?.soldPrice ?? vehicle.actualSalePrice);
  const saleBase = actualSalePrice || expectedSalePrice;
  const receivableBalance = Math.max(actualSalePrice - receivedAmount, 0);
  const grossProfit = saleBase - totalCost;
  const salesCommission = toNumber(vehicle.sale?.salesCommission);
  const taxes = toNumber(vehicle.sale?.taxes);
  const netProfit = grossProfit - salesCommission - taxes;
  const marginPercent = saleBase > 0 ? (netProfit / saleBase) * 100 : 0;
  const roiPercent = totalCost > 0 ? (netProfit / totalCost) * 100 : 0;
  const financialStatus =
    actualSalePrice > 0 && receivableBalance <= 0
      ? "SETTLED"
      : pendingExpenses > 0
        ? "HAS_PAYABLES"
        : actualSalePrice > 0
          ? "HAS_RECEIVABLES"
          : "PROJECTED";

  const summary = await prisma.vehicleFinancialSummary.upsert({
    where: {
      vehicleId
    },
    update: {
      purchaseAmount: toDecimal(purchaseAmount),
      auctionFees: toDecimal(auctionFees),
      transportCost: toDecimal(transportCost),
      documentationCost: toDecimal(documentationCost),
      repairCost: toDecimal(repairCost),
      sellingCost: toDecimal(sellingCost + operationalCost),
      totalCost: toDecimal(totalCost),
      pendingExpenses: toDecimal(pendingExpenses),
      expectedSalePrice: toDecimal(expectedSalePrice),
      actualSalePrice: toDecimal(actualSalePrice),
      receivedAmount: toDecimal(receivedAmount),
      receivableBalance: toDecimal(receivableBalance),
      grossProfit: toDecimal(grossProfit),
      netProfit: toDecimal(netProfit),
      marginPercent: toDecimal(marginPercent),
      roiPercent: toDecimal(roiPercent),
      financialStatus
    },
    create: {
      vehicleId,
      purchaseAmount: toDecimal(purchaseAmount),
      auctionFees: toDecimal(auctionFees),
      transportCost: toDecimal(transportCost),
      documentationCost: toDecimal(documentationCost),
      repairCost: toDecimal(repairCost),
      sellingCost: toDecimal(sellingCost + operationalCost),
      totalCost: toDecimal(totalCost),
      pendingExpenses: toDecimal(pendingExpenses),
      expectedSalePrice: toDecimal(expectedSalePrice),
      actualSalePrice: toDecimal(actualSalePrice),
      receivedAmount: toDecimal(receivedAmount),
      receivableBalance: toDecimal(receivableBalance),
      grossProfit: toDecimal(grossProfit),
      netProfit: toDecimal(netProfit),
      marginPercent: toDecimal(marginPercent),
      roiPercent: toDecimal(roiPercent),
      financialStatus
    }
  });

  await prisma.vehicle.update({
    where: {
      id: vehicleId
    },
    data: {
      totalPredictedCost: toDecimal(totalCost),
      totalActualCost: toDecimal(totalCost),
      actualSalePrice: actualSalePrice > 0 ? toDecimal(actualSalePrice) : vehicle.actualSalePrice,
      predictedProfit: toDecimal(expectedSalePrice - totalCost),
      actualProfit: toDecimal(netProfit),
      predictedMargin: toDecimal(expectedSalePrice > 0 ? ((expectedSalePrice - totalCost) / expectedSalePrice) * 100 : 0),
      actualMargin: toDecimal(marginPercent),
      predictedRoi: toDecimal(totalCost > 0 ? ((expectedSalePrice - totalCost) / totalCost) * 100 : 0),
      actualRoi: toDecimal(roiPercent),
      minimumAcceptablePrice: toDecimal(totalCost * 1.1)
    }
  });

  return summary;
}

export async function createManualFinancialEntry(
  prisma: LedgerPrisma,
  input: {
    type: FinancialEntryType;
    description: string;
    amount: number;
    categoryId?: string;
    vehicleId?: string;
    supplierId?: string;
    customerName?: string;
    dueDate?: Date;
    competenceDate?: Date;
    paidAt?: Date;
    receivedAt?: Date;
    status?: FinancialEntryStatus;
    paymentMethod?: PaymentMethod;
    notes?: string;
    createdById?: string;
  }
) {
  const defaults = await ensureFinancialDefaults(prisma);
  const status =
    input.status ??
    (input.type === FinancialEntryType.IN
      ? input.receivedAt
        ? FinancialEntryStatus.RECEIVED
        : FinancialEntryStatus.PENDING
      : input.paidAt
        ? FinancialEntryStatus.PAID
        : FinancialEntryStatus.PENDING);

  const entry = await prisma.financialEntry.create({
    data: {
      type: input.type,
      status,
      sourceType: FinancialEntrySourceType.MANUAL,
      sourceId: new Prisma.Decimal(Date.now()).toString() + `-${Math.random().toString(36).slice(2)}`,
      description: input.description,
      amount: normalizeAmount(input.amount),
      paidAmount:
        status === FinancialEntryStatus.PAID || status === FinancialEntryStatus.RECEIVED
          ? normalizeAmount(input.amount)
          : toDecimal(0),
      categoryId: input.categoryId ?? (input.type === FinancialEntryType.IN ? defaults.manualInCategoryId : defaults.manualOutCategoryId),
      vehicleId: input.vehicleId,
      supplierId: input.supplierId,
      customerName: input.customerName,
      dueDate: input.dueDate,
      competenceDate: input.competenceDate ?? input.dueDate ?? new Date(),
      paidAt: input.paidAt,
      receivedAt: input.receivedAt,
      paymentMethod: input.paymentMethod,
      notes: input.notes,
      createdById: input.createdById
    }
  });

  if (entry.type === FinancialEntryType.OUT) {
    await upsertPayableForEntry(prisma, entry);
  }

  if (entry.type === FinancialEntryType.IN) {
    await upsertReceivableForEntry(prisma, entry);
  }

  if (entry.vehicleId) {
    await refreshVehicleFinancialSummary(prisma, entry.vehicleId);
  }

  return entry;
}
