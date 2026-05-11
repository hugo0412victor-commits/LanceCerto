import { ExpenseCategoryType, PaymentStatus, Prisma, type PrismaClient } from "@prisma/client";

type VehicleCostFields = {
  bidValue?: number | Prisma.Decimal | null;
  auctionCommission?: number | Prisma.Decimal | null;
  administrativeFees?: number | Prisma.Decimal | null;
  yardCost?: number | Prisma.Decimal | null;
  towCost?: number | Prisma.Decimal | null;
  documentationExpected?: number | Prisma.Decimal | null;
  repairsExpected?: number | Prisma.Decimal | null;
};

type ExpenseWithCategory = {
  actualAmount?: number | Prisma.Decimal | null;
  predictedAmount?: number | Prisma.Decimal | null;
  paymentStatus?: PaymentStatus | string | null;
  category?: {
    code?: ExpenseCategoryType | string | null;
  } | null;
};

const CORE_EXPENSE_DEFINITIONS = [
  {
    field: "bidValue",
    categoryCode: ExpenseCategoryType.ARREMATE,
    description: "Valor do arremate"
  },
  {
    field: "auctionCommission",
    categoryCode: ExpenseCategoryType.COMISSAO_LEILAO,
    description: "Comissao do leilao"
  },
  {
    field: "administrativeFees",
    categoryCode: ExpenseCategoryType.TAXA_ADMINISTRATIVA,
    description: "Taxas administrativas"
  },
  {
    field: "yardCost",
    categoryCode: ExpenseCategoryType.PATIO,
    description: "Patio"
  },
  {
    field: "towCost",
    categoryCode: ExpenseCategoryType.GUINCHO,
    description: "Guincho"
  },
  {
    field: "documentationExpected",
    categoryCode: ExpenseCategoryType.DOCUMENTACAO,
    description: "Documentacao"
  },
  {
    field: "repairsExpected",
    categoryCode: ExpenseCategoryType.MECANICA,
    description: "Reparos previstos"
  }
] as const;

const toNumber = (value?: number | Prisma.Decimal | null) => {
  if (value === null || value === undefined) {
    return 0;
  }

  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toDecimal = (value: number) => new Prisma.Decimal(Math.round(value * 100) / 100);

export function calculateExpenseTotals(expenses: ExpenseWithCategory[]) {
  let auctionBidAlreadyCounted = false;

  return expenses.reduce(
    (totals, expense) => {
      if (expense.paymentStatus === PaymentStatus.CANCELLED) {
        return totals;
      }

      if (expense.category?.code === ExpenseCategoryType.ARREMATE) {
        if (auctionBidAlreadyCounted) {
          return totals;
        }

        auctionBidAlreadyCounted = true;
      }

      const actual = toNumber(expense.actualAmount);
      const predicted = toNumber(expense.predictedAmount);
      const currentAmount = actual || predicted;
      const predictedAmount = predicted || actual;

      return {
        currentCost: totals.currentCost + currentAmount,
        predictedCost: totals.predictedCost + predictedAmount
      };
    },
    {
      currentCost: 0,
      predictedCost: 0
    }
  );
}

export async function syncVehicleCoreExpenses(prisma: PrismaClient, vehicleId: string, costs: VehicleCostFields) {
  const categories = await prisma.expenseCategory.findMany({
    where: {
      code: {
        in: CORE_EXPENSE_DEFINITIONS.map((definition) => definition.categoryCode)
      }
    }
  });
  const categoryMap = new Map(categories.map((category) => [category.code, category.id]));

  for (const definition of CORE_EXPENSE_DEFINITIONS) {
    const amount = toNumber(costs[definition.field]);
    const categoryId = categoryMap.get(definition.categoryCode);

    if (!categoryId) {
      continue;
    }

    const manuallyDeletedCoreExpense = await prisma.expense.findFirst({
      where: {
        vehicleId,
        categoryId,
        description: definition.description,
        paymentStatus: PaymentStatus.CANCELLED,
        note: {
          contains: "Excluida manualmente"
        }
      }
    });

    if (manuallyDeletedCoreExpense) {
      continue;
    }

    const existing = await prisma.expense.findMany({
      where: {
        vehicleId,
        categoryId,
        description: definition.description,
        paymentStatus: {
          not: PaymentStatus.CANCELLED
        }
      },
      orderBy: {
        createdAt: "asc"
      }
    });

    if (amount > 0) {
      const data = {
        vehicleId,
        categoryId,
        description: definition.description,
        predictedAmount: toDecimal(amount),
        actualAmount: toDecimal(amount),
        paymentStatus: existing[0]?.paymentStatus ?? PaymentStatus.PENDING,
        paymentMethod: existing[0]?.paymentMethod,
        date: existing[0]?.date
      };

      if (existing[0]) {
        await prisma.expense.update({
          where: {
            id: existing[0].id
          },
          data
        });
      } else {
        await prisma.expense.create({
          data
        });
      }
    } else if (existing.length > 0) {
      await prisma.expense.update({
        where: {
          id: existing[0].id
        },
        data: {
          predictedAmount: toDecimal(0),
          actualAmount: toDecimal(0),
          paymentStatus: PaymentStatus.CANCELLED,
          note: "Registro preservado e cancelado porque o custo central atual esta zerado."
        }
      });
    }
  }
}

export async function recalculateVehicleCostsFromExpenses(prisma: PrismaClient, vehicleId: string) {
  const vehicle = await prisma.vehicle.findUnique({
    where: {
      id: vehicleId
    },
    include: {
      expenses: {
        include: {
          category: true
        }
      }
    }
  });

  if (!vehicle) {
    return;
  }

  const { currentCost, predictedCost } = calculateExpenseTotals(vehicle.expenses);
  const predictedSalePrice = toNumber(vehicle.predictedSalePrice);
  const actualSalePrice = toNumber(vehicle.actualSalePrice);
  const predictedProfit = predictedSalePrice - predictedCost;
  const actualProfit = actualSalePrice - currentCost;
  const predictedMargin = predictedSalePrice > 0 ? (predictedProfit / predictedSalePrice) * 100 : 0;
  const actualMargin = actualSalePrice > 0 ? (actualProfit / actualSalePrice) * 100 : 0;
  const predictedRoi = predictedCost > 0 ? (predictedProfit / predictedCost) * 100 : 0;
  const actualRoi = currentCost > 0 ? (actualProfit / currentCost) * 100 : 0;

  await prisma.vehicle.update({
    where: {
      id: vehicleId
    },
    data: {
      totalPredictedCost: toDecimal(predictedCost),
      totalActualCost: toDecimal(currentCost),
      predictedProfit: toDecimal(predictedProfit),
      actualProfit: toDecimal(actualProfit),
      predictedMargin: toDecimal(predictedMargin),
      actualMargin: toDecimal(actualMargin),
      predictedRoi: toDecimal(predictedRoi),
      actualRoi: toDecimal(actualRoi),
      minimumAcceptablePrice: toDecimal(currentCost * 1.1)
    }
  });
}
