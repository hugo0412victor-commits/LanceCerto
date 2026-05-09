import { PrismaClient, AdPortal, AdStatus, AiAnalysisType, AiRiskLevel, CashFlowStatus, CashFlowType, DocumentCategory, ExpenseCategoryType, ImportStatus, LeadSource, LeadStage, LiquidityLevel, MarketSourceType, PaymentMethod, PaymentStatus, PhotoCategory, SellerType, StepExecutionStatus, UserRoleCode, VehicleStatus } from "@prisma/client";
import { hashPassword } from "../lib/auth/password";
import { EXPENSE_CATEGORY_LABELS, USER_ROLE_LABELS, VEHICLE_STATUS_LABELS } from "../lib/constants";
import { defaultSettings } from "../lib/default-settings";
import { calculateOpportunityScore } from "../lib/scoring";
import { generateAdCopy, generateLotRiskAnalysis } from "../lib/ai";
import { calculateVehicleFinancials } from "../lib/calculations";

const prisma = new PrismaClient();

const toSeedNumber = (value: number | { toString(): string } | null | undefined) => Number(value ?? 0);

const REQUIRED_AUTH_ROLES = [UserRoleCode.ADMIN, UserRoleCode.MANAGER, UserRoleCode.VIEWER] as const;

const ROLE_PERMISSIONS: Record<(typeof REQUIRED_AUTH_ROLES)[number], Record<string, boolean>> = {
  [UserRoleCode.ADMIN]: {
    read: true,
    create: true,
    update: true,
    delete: true,
    manageSettings: true
  },
  [UserRoleCode.MANAGER]: {
    read: true,
    create: true,
    update: true,
    delete: false,
    manageSettings: false
  },
  [UserRoleCode.VIEWER]: {
    read: true,
    create: false,
    update: false,
    delete: false,
    manageSettings: false
  }
};

const INITIAL_USERS = [
  {
    name: "Administrador",
    email: "admin@lancecerto.com.br",
    password: "Admin@12345",
    role: UserRoleCode.ADMIN
  },
  {
    name: "Gestor",
    email: "gestor@lancecerto.com.br",
    password: "Gestor@12345",
    role: UserRoleCode.MANAGER
  },
  {
    name: "Consulta",
    email: "consulta@lancecerto.com.br",
    password: "Consulta@12345",
    role: UserRoleCode.VIEWER
  }
] as const;

async function resetDatabase() {
  await prisma.aiAnalysis.deleteMany();
  await prisma.opportunityScore.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.cashFlow.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.advertisement.deleteMany();
  await prisma.sale.deleteMany();
  await prisma.marketListing.deleteMany();
  await prisma.marketResearch.deleteMany();
  await prisma.marketSource.deleteMany();
  await prisma.simulation.deleteMany();
  await prisma.vehicleProcess.deleteMany();
  await prisma.processStep.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.expenseCategory.deleteMany();
  await prisma.vehicleDocument.deleteMany();
  await prisma.vehiclePhoto.deleteMany();
  await prisma.lotSnapshot.deleteMany();
  await prisma.vehicle.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.user.deleteMany();
  await prisma.role.deleteMany();
  await prisma.setting.deleteMany();
  await prisma.auctionHouse.deleteMany();
}

async function seedBaseData() {
  for (const roleCode of Object.values(UserRoleCode)) {
    await prisma.role.create({
      data: {
        code: roleCode,
        name: USER_ROLE_LABELS[roleCode],
        description: `Perfil ${USER_ROLE_LABELS[roleCode]}`
      }
    });
  }

  const roleMap = new Map(
    (await prisma.role.findMany()).map((role) => [role.code, role.id])
  );

  const defaultPassword = hashPassword("Admin123!");

  await prisma.user.createMany({
    data: [
      {
        name: "Admin Demo",
        email: "admin@autoarremate.demo",
        passwordHash: defaultPassword,
        roleId: roleMap.get(UserRoleCode.ADMIN)!
      },
      {
        name: "Comprador Demo",
        email: "comprador@autoarremate.demo",
        passwordHash: defaultPassword,
        roleId: roleMap.get(UserRoleCode.BUYER)!
      },
      {
        name: "Financeiro Demo",
        email: "financeiro@autoarremate.demo",
        passwordHash: defaultPassword,
        roleId: roleMap.get(UserRoleCode.FINANCE)!
      },
      {
        name: "Operacional Demo",
        email: "operacional@autoarremate.demo",
        passwordHash: defaultPassword,
        roleId: roleMap.get(UserRoleCode.OPERATIONS)!
      },
      {
        name: "Vendas Demo",
        email: "vendas@autoarremate.demo",
        passwordHash: defaultPassword,
        roleId: roleMap.get(UserRoleCode.SALES)!
      }
    ]
  });

  await prisma.auctionHouse.createMany({
    data: [
      {
        name: "Copart Brasil",
        slug: "copart-brasil",
        website: "https://www.copart.com.br",
        importerKey: "copart"
      },
      {
        name: "Sodre Santoro",
        slug: "sodre-santoro",
        website: "https://www.sodresantoro.com.br",
        importerKey: "generic"
      },
      {
        name: "Superbid",
        slug: "superbid",
        website: "https://www.superbid.net",
        importerKey: "generic"
      }
    ]
  });

  await prisma.expenseCategory.createMany({
    data: Object.entries(EXPENSE_CATEGORY_LABELS).map(([code, name], index) => ({
      code: code as ExpenseCategoryType,
      name,
      description: `Categoria padrao ${name}`,
      color: ["#0f766e", "#f59e0b", "#1d4ed8", "#d97706", "#7c3aed"][index % 5]
    }))
  });

  await prisma.processStep.createMany({
    data: Object.values(VEHICLE_STATUS_LABELS).map((label, index) => ({
      name: label,
      slug: label
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-"),
      order: index + 1,
      color: index % 2 === 0 ? "#0f766e" : "#d97706",
      defaultRoleCode:
        index <= 2 ? UserRoleCode.BUYER : index <= 12 ? UserRoleCode.OPERATIONS : UserRoleCode.SALES
    }))
  });

  await prisma.marketSource.createMany({
    data: [
      { code: MarketSourceType.FIPE, name: "Tabela FIPE" },
      { code: MarketSourceType.WEBMOTORS, name: "Webmotors" },
      { code: MarketSourceType.MOBIAUTO, name: "Mobiauto" },
      { code: MarketSourceType.OLX, name: "OLX" },
      { code: MarketSourceType.MANUAL, name: "Manual assistido" }
    ]
  });

  await prisma.supplier.createMany({
    data: [
      {
        name: "Oficina Ponto Certo",
        category: "oficina mecanica",
        phone: "(11) 99999-0101",
        email: "mecanica@pontocerto.demo",
        rating: 4,
        averageLeadTime: 5,
        averageCost: 2400
      },
      {
        name: "Funilaria Bom Acabamento",
        category: "funilaria",
        phone: "(11) 99999-0202",
        rating: 5,
        averageLeadTime: 7,
        averageCost: 3800
      },
      {
        name: "Estetica Premium Car",
        category: "estetica",
        phone: "(11) 99999-0303",
        rating: 5,
        averageLeadTime: 2,
        averageCost: 650
      },
      {
        name: "Guincho Rapido SP",
        category: "guincho",
        phone: "(11) 99999-0404",
        rating: 4,
        averageLeadTime: 1,
        averageCost: 520
      },
      {
        name: "Despachante Alfa",
        category: "despachante",
        phone: "(11) 99999-0505",
        rating: 4,
        averageLeadTime: 4,
        averageCost: 900
      },
      {
        name: "FotoShow Veicular",
        category: "fotografo",
        phone: "(11) 99999-0606",
        rating: 5,
        averageLeadTime: 1,
        averageCost: 350
      }
    ]
  });

  for (const setting of defaultSettings) {
    await prisma.setting.create({
      data: {
        group: setting.group,
        key: setting.key,
        label: setting.label,
        value: setting.value as never,
        description: setting.description
      }
    });
  }
}

async function seedAuthUsers() {
  const roleMap = new Map<UserRoleCode, string>();

  for (const roleCode of REQUIRED_AUTH_ROLES) {
    await prisma.$executeRawUnsafe(`ALTER TYPE "UserRoleCode" ADD VALUE IF NOT EXISTS '${roleCode}'`);
  }

  for (const roleCode of REQUIRED_AUTH_ROLES) {
    const role = await prisma.role.upsert({
      where: {
        code: roleCode
      },
      update: {
        name: USER_ROLE_LABELS[roleCode],
        description: `Perfil ${USER_ROLE_LABELS[roleCode]}`,
        permissions: ROLE_PERMISSIONS[roleCode] as never
      },
      create: {
        code: roleCode,
        name: USER_ROLE_LABELS[roleCode],
        description: `Perfil ${USER_ROLE_LABELS[roleCode]}`,
        permissions: ROLE_PERMISSIONS[roleCode] as never
      }
    });

    roleMap.set(roleCode, role.id);
  }

  for (const user of INITIAL_USERS) {
    const roleId = roleMap.get(user.role);

    if (!roleId) {
      throw new Error(`Role ${user.role} nao encontrada para criar usuario ${user.email}.`);
    }

    await prisma.user.upsert({
      where: {
        email: user.email
      },
      update: {
        name: user.name,
        passwordHash: hashPassword(user.password),
        roleId,
        active: true
      },
      create: {
        name: user.name,
        email: user.email,
        passwordHash: hashPassword(user.password),
        roleId,
        active: true
      }
    });
  }
}

async function seedVehicles() {
  const admin = await prisma.user.findUniqueOrThrow({
    where: {
      email: "admin@autoarremate.demo"
    }
  });

  const auctionHouses = await prisma.auctionHouse.findMany();
  const categories = await prisma.expenseCategory.findMany();
  const processSteps = await prisma.processStep.findMany({ orderBy: { order: "asc" } });
  const sources = await prisma.marketSource.findMany();
  const suppliers = await prisma.supplier.findMany();

  const supplierMap = new Map(suppliers.map((supplier) => [supplier.category, supplier.id]));
  const categoryMap = new Map(categories.map((category) => [category.code, category.id]));
  const sourceMap = new Map(sources.map((source) => [source.code, source.id]));
  const auctionHouseMap = new Map(auctionHouses.map((house) => [house.slug, house.id]));

  const vehiclesData = [
    {
      stockCode: "AA-1001",
      lotUrl: "https://www.copart.com.br/lot/1090276",
      lotCode: "1090276",
      auctionHouseId: auctionHouseMap.get("copart-brasil"),
      status: VehicleStatus.MECANICA,
      brand: "Ford",
      model: "Ka",
      version: "SE 1.5",
      manufacturingYear: 2020,
      modelYear: 2020,
      color: "Prata",
      fuel: "Flex",
      transmission: "Manual",
      mileage: 68400,
      documentType: "CRLV digital pendente",
      mountType: "Media monta",
      condition: "Sinistro recuperavel",
      hasKey: true,
      runningCondition: false,
      city: "Osasco",
      state: "SP",
      yard: "Patio Cotia",
      auctionDate: new Date("2026-04-15"),
      bidDate: new Date("2026-04-15"),
      fipeValue: 46200,
      marketEstimatedValue: 44800,
      bidValue: 24800,
      auctionCommission: 2150,
      administrativeFees: 890,
      yardCost: 240,
      towCost: 580,
      documentationExpected: 1500,
      repairsExpected: 7300,
      predictedSalePrice: 42900,
      notes: "Primeiro lote de referencia para importacao da Copart. Cadastro mantido mesmo com dados parciais."
    },
    {
      stockCode: "AA-1002",
      lotUrl: "https://www.sodresantoro.com.br/lote/demo-2019-onix",
      lotCode: "SS-88321",
      auctionHouseId: auctionHouseMap.get("sodre-santoro"),
      status: VehicleStatus.ANUNCIADO,
      brand: "Chevrolet",
      model: "Onix",
      version: "LT 1.0 Turbo",
      manufacturingYear: 2019,
      modelYear: 2020,
      color: "Branco",
      fuel: "Flex",
      transmission: "Manual",
      mileage: 54400,
      documentType: "ATPV-e pronta",
      mountType: "Pequena monta",
      condition: "Bom estado geral",
      hasKey: true,
      runningCondition: true,
      city: "Barueri",
      state: "SP",
      yard: "Patio Alphaville",
      auctionDate: new Date("2026-03-10"),
      bidDate: new Date("2026-03-10"),
      fipeValue: 55300,
      marketEstimatedValue: 54800,
      bidValue: 34100,
      auctionCommission: 2740,
      administrativeFees: 1100,
      yardCost: 0,
      towCost: 450,
      documentationExpected: 0,
      repairsExpected: 3200,
      predictedSalePrice: 52900,
      notes: "Veiculo pronto para funil comercial e fotos de anuncio."
    },
    {
      stockCode: "AA-1003",
      lotUrl: "https://www.superbid.net/lot/demo-hb20",
      lotCode: "SB-55472",
      auctionHouseId: auctionHouseMap.get("superbid"),
      status: VehicleStatus.VENDIDO,
      brand: "Hyundai",
      model: "HB20",
      version: "Comfort Plus 1.0",
      manufacturingYear: 2021,
      modelYear: 2022,
      color: "Cinza",
      fuel: "Flex",
      transmission: "Manual",
      mileage: 30800,
      documentType: "CRLV e ATPV-e ok",
      mountType: "Pequena monta",
      condition: "Leve avaria frontal",
      hasKey: true,
      runningCondition: true,
      city: "Campinas",
      state: "SP",
      yard: "Patio Campinas",
      auctionDate: new Date("2026-01-12"),
      bidDate: new Date("2026-01-12"),
      fipeValue: 61800,
      marketEstimatedValue: 60300,
      bidValue: 40200,
      auctionCommission: 2990,
      administrativeFees: 930,
      yardCost: 0,
      towCost: 380,
      documentationExpected: 980,
      repairsExpected: 2900,
      predictedSalePrice: 58900,
      notes: "Case de venda concluida para alimentar ROI real."
    },
    {
      stockCode: "AA-1004",
      lotUrl: "https://www.copart.com.br/lot/demo-corolla",
      lotCode: "CP-76210",
      auctionHouseId: auctionHouseMap.get("copart-brasil"),
      status: VehicleStatus.DOCUMENTACAO,
      brand: "Toyota",
      model: "Corolla",
      version: "GLi 1.8",
      manufacturingYear: 2018,
      modelYear: 2019,
      color: "Preto",
      fuel: "Flex",
      transmission: "Automatico",
      mileage: 86700,
      documentType: "",
      mountType: "Pequena monta",
      condition: "Boa estrutura, pendencia documental",
      hasKey: false,
      runningCondition: true,
      city: "Guarulhos",
      state: "SP",
      yard: "Patio Guarulhos",
      auctionDate: new Date("2026-02-05"),
      bidDate: new Date("2026-02-05"),
      fipeValue: 87400,
      marketEstimatedValue: 86200,
      bidValue: 60300,
      auctionCommission: 4150,
      administrativeFees: 1200,
      yardCost: 190,
      towCost: 0,
      documentationExpected: 2300,
      repairsExpected: 3400,
      predictedSalePrice: 82600,
      notes: "Exemplo de registro com dados faltantes marcados como pendentes."
    },
    {
      stockCode: "AA-1005",
      lotUrl: "https://www.sodresantoro.com.br/lote/demo-renegade",
      lotCode: "SS-99210",
      auctionHouseId: auctionHouseMap.get("sodre-santoro"),
      status: VehicleStatus.ANALISE_LOTE,
      brand: "Jeep",
      model: "Renegade",
      version: "Sport 1.8",
      manufacturingYear: 2020,
      modelYear: 2021,
      color: "Vermelho",
      fuel: "Flex",
      transmission: "Automatico",
      mileage: 51200,
      documentType: "Pendente",
      mountType: "Media monta",
      condition: "Analise preliminar",
      hasKey: null,
      runningCondition: null,
      city: "Sao Paulo",
      state: "SP",
      yard: "Patio Leste",
      auctionDate: new Date("2026-04-28"),
      bidDate: null,
      fipeValue: 94100,
      marketEstimatedValue: 92900,
      bidValue: 0,
      auctionCommission: 0,
      administrativeFees: 0,
      yardCost: 0,
      towCost: 0,
      documentationExpected: 1800,
      repairsExpected: 8800,
      predictedSalePrice: 89500,
      notes: "Veiculo em fase de compra com dados ainda incompletos."
    },
    {
      stockCode: "AA-1006",
      lotUrl: "https://www.copart.com.br/lot/demo-civic-2020",
      lotCode: "CP-88420",
      auctionHouseId: auctionHouseMap.get("copart-brasil"),
      status: VehicleStatus.ANALISE_LOTE,
      brand: "Honda",
      model: "Civic",
      version: "EXL 2.0 CVT",
      manufacturingYear: 2019,
      modelYear: 2020,
      color: "Prata",
      fuel: "Flex",
      transmission: "Automatico",
      mileage: 72100,
      documentType: "CRLV digital em analise",
      mountType: "Pequena monta",
      condition: "Avaria lateral direita, estrutura preservada",
      hasKey: true,
      runningCondition: true,
      city: "Itaquaquecetuba",
      state: "SP",
      yard: "Patio Alto Tiete",
      auctionDate: new Date("2026-05-14"),
      bidDate: null,
      fipeValue: 109800,
      marketEstimatedValue: 106900,
      bidValue: 0,
      auctionCommission: 0,
      administrativeFees: 0,
      yardCost: 260,
      towCost: 620,
      documentationExpected: 1900,
      repairsExpected: 7600,
      predictedSalePrice: 103500,
      notes: "Oportunidade em analise com boa liquidez, dependendo da confirmacao de funcionamento e historico documental."
    },
    {
      stockCode: "AA-1007",
      lotUrl: "https://www.superbid.net/lot/demo-kicks-2021",
      lotCode: "SB-78144",
      auctionHouseId: auctionHouseMap.get("superbid"),
      status: VehicleStatus.ANALISE_LOTE,
      brand: "Nissan",
      model: "Kicks",
      version: "SV 1.6 CVT",
      manufacturingYear: 2020,
      modelYear: 2021,
      color: "Cinza",
      fuel: "Flex",
      transmission: "Automatico",
      mileage: 63800,
      documentType: "Documento informado, aguardando validacao",
      mountType: "Media monta",
      condition: "Avaria frontal com airbags preservados",
      hasKey: true,
      runningCondition: null,
      city: "Sorocaba",
      state: "SP",
      yard: "Patio Sorocaba",
      auctionDate: new Date("2026-05-18"),
      bidDate: null,
      fipeValue: 98200,
      marketEstimatedValue: 95400,
      bidValue: 0,
      auctionCommission: 0,
      administrativeFees: 0,
      yardCost: 180,
      towCost: 740,
      documentationExpected: 2100,
      repairsExpected: 11800,
      predictedSalePrice: 92500,
      notes: "Analise conservadora por reparo frontal; lote util para alimentar funil e indicadores de oportunidades futuras."
    },
    {
      stockCode: "AA-1008",
      lotUrl: "https://www.sodresantoro.com.br/lote/demo-nivus-2022",
      lotCode: "SS-10452",
      auctionHouseId: auctionHouseMap.get("sodre-santoro"),
      status: VehicleStatus.ANUNCIADO,
      brand: "Volkswagen",
      model: "Nivus",
      version: "Comfortline 200 TSI",
      manufacturingYear: 2021,
      modelYear: 2022,
      color: "Azul",
      fuel: "Flex",
      transmission: "Automatico",
      mileage: 39200,
      documentType: "ATPV-e pronta",
      mountType: "Pequena monta",
      condition: "Reparos finalizados e cautelar aprovada",
      hasKey: true,
      runningCondition: true,
      city: "Santo Andre",
      state: "SP",
      yard: "Loja Santo Andre",
      auctionDate: new Date("2026-04-02"),
      bidDate: new Date("2026-04-02"),
      fipeValue: 112400,
      marketEstimatedValue: 109900,
      bidValue: 74200,
      auctionCommission: 4380,
      administrativeFees: 1280,
      yardCost: 0,
      towCost: 520,
      documentationExpected: 1200,
      repairsExpected: 6500,
      predictedSalePrice: 106900,
      notes: "Veiculo ja preparado para venda, com fotos de anuncio, precificacao competitiva e margem preservada."
    }
  ] as const;

  const vehicles = [];

  for (const [index, vehicleData] of vehiclesData.entries()) {
    const calculations = calculateVehicleFinancials({
      fipeValue: vehicleData.fipeValue,
      marketValue: vehicleData.marketEstimatedValue,
      bidValue: vehicleData.bidValue,
      auctionCommission: vehicleData.auctionCommission,
      administrativeFees: vehicleData.administrativeFees,
      yardCost: vehicleData.yardCost,
      towCost: vehicleData.towCost,
      documentationCost: vehicleData.documentationExpected,
      repairCost: vehicleData.repairsExpected,
      predictedSalePrice: vehicleData.predictedSalePrice,
      actualSalePrice: vehicleData.status === VehicleStatus.VENDIDO ? 57800 : undefined,
      desiredMarginPercent: 15
    });

    const vehicle = await prisma.vehicle.create({
      data: {
        ...vehicleData,
        createdById: admin.id,
        totalPredictedCost: calculations.totalPredictedCost,
        totalActualCost: vehicleData.status === VehicleStatus.VENDIDO ? 48350 : calculations.totalActualCost,
        predictedProfit: calculations.predictedProfit,
        actualProfit: vehicleData.status === VehicleStatus.VENDIDO ? 9450 : null,
        predictedMargin: calculations.predictedMargin,
        actualMargin: vehicleData.status === VehicleStatus.VENDIDO ? 16.35 : null,
        predictedRoi: calculations.predictedRoi,
        actualRoi: vehicleData.status === VehicleStatus.VENDIDO ? 24.3 : null,
        minimumAcceptablePrice: calculations.priceMinimum,
        maxRecommendedBid: calculations.recommendedMaxBid,
        snapshotConfirmed: true,
        snapshotDate: new Date(),
        completenessPercent: index === 3 ? 74 : index === 4 ? 58 : 92,
        pendingFields: index === 3 ? ["documentType", "hasKey"] : index === 4 ? ["documentType", "hasKey", "runningCondition", "bidValue"] : [],
        alerts:
          index === 0
            ? ["Funcionamento nao confirmado no momento da compra.", "Revisar custo final de reparo apos vistoria."]
            : index === 4
              ? ["Lote ainda em analise e com dados incompletos."]
              : []
      }
    });

    vehicles.push(vehicle);

    await prisma.lotSnapshot.create({
      data: {
        vehicleId: vehicle.id,
        auctionHouseId: vehicle.auctionHouseId ?? undefined,
        sourceUrl: vehicle.lotUrl ?? `https://origem.demo/${vehicle.stockCode}`,
        auctionHouseName: auctionHouses.find((item) => item.id === vehicle.auctionHouseId)?.name,
        lotCode: vehicle.lotCode ?? undefined,
        brand: vehicle.brand ?? undefined,
        model: vehicle.model ?? undefined,
        version: vehicle.version ?? undefined,
        manufacturingYear: vehicle.manufacturingYear ?? undefined,
        modelYear: vehicle.modelYear ?? undefined,
        informedFipe: vehicle.fipeValue ?? undefined,
        documentType: vehicle.documentType ?? undefined,
        mountType: vehicle.mountType ?? undefined,
        condition: vehicle.condition ?? undefined,
        hasKey: vehicle.hasKey ?? undefined,
        runningCondition: vehicle.runningCondition ?? undefined,
        fuel: vehicle.fuel ?? undefined,
        transmission: vehicle.transmission ?? undefined,
        color: vehicle.color ?? undefined,
        mileage: vehicle.mileage ?? undefined,
        plateOrFinal: index === 0 ? "3A21" : undefined,
        yard: vehicle.yard ?? undefined,
        city: vehicle.city ?? undefined,
        state: vehicle.state ?? undefined,
        auctionDate: vehicle.auctionDate ?? undefined,
        originalNotes: vehicle.notes ?? undefined,
        photoUrls: [`/placeholders/vehicle-${(index % 5) + 1}.svg`],
        rawJson: {
          source: vehicle.lotUrl,
          importedAt: new Date().toISOString(),
          htmlSnapshot: "Dados de exemplo preservados internamente."
        } as never,
        importStatus: index === 4 ? ImportStatus.PARTIAL : ImportStatus.SUCCESS,
        alerts: vehicle.alerts,
        pendingFields: vehicle.pendingFields
      }
    });

    await prisma.vehiclePhoto.createMany({
      data: [
        {
          vehicleId: vehicle.id,
          uploadedById: admin.id,
          category: PhotoCategory.ORIGINAIS_LEILAO,
          caption: "Foto principal do lote",
          storagePath: `/placeholders/vehicle-${(index % 5) + 1}.svg`,
          publicUrl: `/placeholders/vehicle-${(index % 5) + 1}.svg`,
          sortOrder: 0,
          isPrimary: true
        },
        {
          vehicleId: vehicle.id,
          uploadedById: admin.id,
          category: index < 2 ? PhotoCategory.APOS_REPARO : PhotoCategory.ANTES_REPARO,
          caption: "Imagem complementar",
          storagePath: `/placeholders/vehicle-${((index + 1) % 5) + 1}.svg`,
          publicUrl: `/placeholders/vehicle-${((index + 1) % 5) + 1}.svg`,
          sortOrder: 1,
          isPrimary: false
        }
      ]
    });

    await prisma.vehicleDocument.createMany({
      data: [
        {
          vehicleId: vehicle.id,
          uploadedById: admin.id,
          category: DocumentCategory.NOTA_VENDA_LEILAO,
          fileName: `${vehicle.stockCode}-nota-venda.txt`,
          mimeType: "text/plain",
          fileSize: 850,
          storagePath: "/placeholders/document-demo.txt",
          publicUrl: "/placeholders/document-demo.txt",
          note: "Documento ficticio para ambiente demo."
        },
        {
          vehicleId: vehicle.id,
          uploadedById: admin.id,
          category: DocumentCategory.ORCAMENTO,
          fileName: `${vehicle.stockCode}-orcamento.txt`,
          mimeType: "text/plain",
          fileSize: 620,
          storagePath: "/placeholders/document-demo.txt",
          publicUrl: "/placeholders/document-demo.txt",
          note: "Orcamento inicial de reparo."
        }
      ]
    });

    const expenseRecords = [
      {
        categoryCode: ExpenseCategoryType.ARREMATE,
        description: "Valor do arremate",
        predictedAmount: vehicle.bidValue ?? 0,
        actualAmount: vehicle.bidValue ?? 0,
        paymentStatus: PaymentStatus.PAID,
        paymentMethod: PaymentMethod.TRANSFER
      },
      {
        categoryCode: ExpenseCategoryType.COMISSAO_LEILAO,
        description: "Comissao da leiloeira",
        predictedAmount: vehicle.auctionCommission ?? 0,
        actualAmount: vehicle.auctionCommission ?? 0,
        paymentStatus: PaymentStatus.PAID,
        paymentMethod: PaymentMethod.PIX
      },
      {
        categoryCode: ExpenseCategoryType.MECANICA,
        description: "Reparo inicial",
        predictedAmount: Math.round(toSeedNumber(vehicle.repairsExpected) * 0.6),
        actualAmount:
          vehicle.status === VehicleStatus.VENDIDO
            ? Math.round(toSeedNumber(vehicle.repairsExpected) * 0.8)
            : Math.round(toSeedNumber(vehicle.repairsExpected) * 0.45),
        paymentStatus: vehicle.status === VehicleStatus.ANALISE_LOTE ? PaymentStatus.PENDING : PaymentStatus.PARTIAL,
        paymentMethod: PaymentMethod.PIX
      }
    ];

    for (const expense of expenseRecords) {
      await prisma.expense.create({
        data: {
          vehicleId: vehicle.id,
          categoryId: categoryMap.get(expense.categoryCode)!,
          supplierId:
            expense.categoryCode === ExpenseCategoryType.MECANICA
              ? supplierMap.get("oficina mecanica")
              : undefined,
          description: expense.description,
          date: new Date(),
          predictedAmount: expense.predictedAmount,
          actualAmount: expense.actualAmount,
          paymentStatus: expense.paymentStatus,
          paymentMethod: expense.paymentMethod,
          dueDate: new Date(),
          note: "Lancamento gerado no seed"
        }
      });
    }

    for (const processStep of processSteps.slice(0, 6)) {
      const stepOrder = processStep.order;
      const currentIndex = Object.values(VehicleStatus).indexOf(vehicle.status);
      const status =
        stepOrder - 1 < Math.min(currentIndex + 1, 6)
          ? StepExecutionStatus.DONE
          : stepOrder - 1 === Math.min(currentIndex + 1, 6)
            ? StepExecutionStatus.IN_PROGRESS
            : StepExecutionStatus.NOT_STARTED;

      await prisma.vehicleProcess.create({
        data: {
          vehicleId: vehicle.id,
          processStepId: processStep.id,
          status,
          dueDate: new Date(Date.now() + stepOrder * 86400000),
          startedAt: status !== StepExecutionStatus.NOT_STARTED ? new Date() : undefined,
          completedAt: status === StepExecutionStatus.DONE ? new Date() : undefined,
          notes: `Etapa ${processStep.name} seeded para demonstracao.`
        }
      });
    }

    await prisma.simulation.create({
      data: {
        vehicleId: vehicle.id,
        brand: vehicle.brand ?? undefined,
        model: vehicle.model ?? undefined,
        version: vehicle.version ?? undefined,
        year: vehicle.modelYear ?? undefined,
        fipeValue: vehicle.fipeValue ?? undefined,
        marketAverageValue: vehicle.marketEstimatedValue ?? undefined,
        intendedBid: vehicle.bidValue ?? undefined,
        auctionCommission: vehicle.auctionCommission ?? undefined,
        administrativeFees: vehicle.administrativeFees ?? undefined,
        yardCost: vehicle.yardCost ?? undefined,
        towCost: vehicle.towCost ?? undefined,
        documentationCost: vehicle.documentationExpected ?? undefined,
        estimatedRepairs: vehicle.repairsExpected ?? undefined,
        desiredMargin: 15,
        predictedSalePrice: vehicle.predictedSalePrice ?? undefined,
        desiredDiscountOnFipe: 3,
        estimatedSellingDays: index === 2 ? 24 : 38,
        totalPredictedCost: calculations.totalPredictedCost,
        predictedProfit: calculations.predictedProfit,
        predictedMargin: calculations.predictedMargin,
        predictedRoi: calculations.predictedRoi,
        minimumSellingPrice: calculations.priceMinimum,
        idealSellingPrice: calculations.priceIdeal,
        aggressiveSellingPrice: calculations.priceAggressive,
        recommendedMaxBid: calculations.recommendedMaxBid,
        recommendation:
          calculations.predictedMargin > 15
            ? "Excelente oportunidade"
            : calculations.predictedMargin > 10
              ? "Boa oportunidade"
              : "Comprar com cautela"
      }
    });

    await prisma.marketResearch.create({
      data: {
        vehicleId: vehicle.id,
        fipeValue: vehicle.fipeValue ?? undefined,
        marketAverage: vehicle.marketEstimatedValue ?? undefined,
        lowestPrice: toSeedNumber(vehicle.marketEstimatedValue) * 0.94,
        highestPrice: toSeedNumber(vehicle.marketEstimatedValue) * 1.05,
        listingsCount: 18 - index,
        suggestedCompetitivePrice: toSeedNumber(vehicle.marketEstimatedValue) * 0.985,
        suggestedAggressivePrice: toSeedNumber(vehicle.marketEstimatedValue) * 0.96,
        suggestedIdealPrice: vehicle.predictedSalePrice ?? undefined,
        minimumAcceptablePrice: calculations.priceMinimum,
        liquidityLevel: index <= 2 ? LiquidityLevel.HIGH : index === 3 ? LiquidityLevel.MEDIUM : LiquidityLevel.UNKNOWN,
        notes: "Pesquisa de mercado demo com mistura de fontes automaticas e manuais.",
        sourceStatus: {
          automaticSources: ["FIPE", "WEBMOTORS"],
          manualSources: ["OLX"]
        } as never,
        listings: {
          create: [
            {
              marketSourceId: sourceMap.get(MarketSourceType.FIPE),
              source: MarketSourceType.FIPE,
              price: vehicle.fipeValue ?? undefined,
              notes: "Referencia FIPE"
            },
            {
              marketSourceId: sourceMap.get(MarketSourceType.WEBMOTORS),
              source: MarketSourceType.WEBMOTORS,
              listingUrl: `https://www.webmotors.com.br/demo/${vehicle.stockCode}`,
              price: toSeedNumber(vehicle.marketEstimatedValue) * 1.02,
              year: vehicle.modelYear ?? undefined,
              version: vehicle.version ?? undefined,
              mileage: vehicle.mileage ?? undefined,
              city: vehicle.city ?? undefined,
              state: vehicle.state ?? undefined,
              sellerType: SellerType.LOJISTA,
              notes: "Anuncio semelhante encontrado"
            },
            {
              marketSourceId: sourceMap.get(MarketSourceType.OLX),
              source: MarketSourceType.OLX,
              listingUrl: `https://www.olx.com.br/demo/${vehicle.stockCode}`,
              price: toSeedNumber(vehicle.marketEstimatedValue) * 0.97,
              year: vehicle.modelYear ?? undefined,
              version: vehicle.version ?? undefined,
              mileage: vehicle.mileage ?? undefined,
              city: vehicle.city ?? undefined,
              state: vehicle.state ?? undefined,
              sellerType: SellerType.PARTICULAR,
              notes: "Entrada manual assistida"
            }
          ]
        }
      }
    });

    if (index <= 2) {
      await prisma.advertisement.create({
        data: {
          vehicleId: vehicle.id,
          portal: index === 0 ? AdPortal.OLX : AdPortal.WEBMOTORS,
          listingUrl: `https://portal.demo/anuncio/${vehicle.stockCode}`,
          publishedAt: new Date("2026-04-20"),
          listedPrice: vehicle.predictedSalePrice ?? undefined,
          status: index === 2 ? AdStatus.SOLD : AdStatus.PUBLISHED,
          receivedLeads: 4 + index,
          notes: "Anuncio ficticio do ambiente demo",
          adCost: 120,
          boostCost: index === 1 ? 89 : 0
        }
      });
    }

    if (vehicle.status === VehicleStatus.VENDIDO) {
      await prisma.sale.create({
        data: {
          vehicleId: vehicle.id,
          soldAt: new Date("2026-03-18"),
          listedPrice: 58900,
          soldPrice: 57800,
          discountGranted: 1100,
          buyerName: "Cliente Demo",
          saleChannel: "Webmotors",
          salesCommission: 900,
          taxes: 500,
          paymentMethod: PaymentMethod.PIX,
          notes: "Venda concluida no seed",
          transferDate: new Date("2026-03-25"),
          transferStatus: "Em andamento",
          grossProfit: 10450,
          netProfit: 9050,
          netMargin: 15.65,
          roi: 24.3,
          daysToSale: 65
        }
      });
    }

    const score = calculateOpportunityScore({
      discountToFipePercent:
        ((toSeedNumber(vehicle.fipeValue) - toSeedNumber(vehicle.bidValue)) / Math.max(toSeedNumber(vehicle.fipeValue), 1)) * 100,
      projectedMarginPercent: calculations.predictedMargin,
      repairEaseScore: index === 0 ? 54 : 72,
      liquidityScore: index <= 2 ? 82 : 57,
      documentaryRiskScore: index === 3 ? 78 : 38,
      estimatedSaleTimeScore: index <= 2 ? 78 : 52
    });

    await prisma.opportunityScore.create({
      data: {
        vehicleId: vehicle.id,
        score: score.score,
        classification: score.classification,
        breakdown: score.breakdown as never,
        weights: score.weights as never,
        notes: "Score calculado automaticamente na seed"
      }
    });

    const riskAnalysis = generateLotRiskAnalysis({
      ...vehicleData
    });

    await prisma.aiAnalysis.create({
      data: {
        vehicleId: vehicle.id,
        analysisType: AiAnalysisType.LOT_RISK,
        input: vehicleData as never,
        output: riskAnalysis as never,
        summary: riskAnalysis.summary,
        riskLevel: riskAnalysis.riskLevel as AiRiskLevel
      }
    });

    const adCopy = generateAdCopy({
      brand: vehicle.brand,
      model: vehicle.model,
      version: vehicle.version,
      year: vehicle.modelYear,
      mileage: vehicle.mileage,
      color: vehicle.color,
      fuel: vehicle.fuel,
      transmission: vehicle.transmission,
      differentials: ["historico organizado", "pronto para anuncio", "precificacao competitiva"],
      price: vehicle.predictedSalePrice == null ? undefined : toSeedNumber(vehicle.predictedSalePrice),
      notes: vehicle.notes,
      condition: vehicle.condition
    });

    await prisma.aiAnalysis.create({
      data: {
        vehicleId: vehicle.id,
        analysisType: AiAnalysisType.SALE_COPY,
        input: {
          price: vehicle.predictedSalePrice,
          condition: vehicle.condition
        } as never,
        output: adCopy as never,
        summary: adCopy.title
      }
    });

    await prisma.cashFlow.createMany({
      data: [
        {
          vehicleId: vehicle.id,
          type: CashFlowType.OUT,
          status: CashFlowStatus.REALIZED,
          description: "Arremate e taxas iniciais",
          amount:
            toSeedNumber(vehicle.bidValue) +
            toSeedNumber(vehicle.auctionCommission) +
            toSeedNumber(vehicle.administrativeFees),
          occurredAt: vehicle.bidDate ?? new Date(),
          paymentMethod: PaymentMethod.TRANSFER
        },
        {
          vehicleId: vehicle.id,
          type: CashFlowType.OUT,
          status: CashFlowStatus.PROJECTED,
          description: "Reparos e documentacao",
          amount: toSeedNumber(vehicle.repairsExpected) + toSeedNumber(vehicle.documentationExpected),
          expectedAt: new Date(),
          paymentMethod: PaymentMethod.PIX
        }
      ]
    });

    if (vehicle.status === VehicleStatus.VENDIDO) {
      await prisma.cashFlow.create({
        data: {
          vehicleId: vehicle.id,
          type: CashFlowType.IN,
          status: CashFlowStatus.REALIZED,
          description: "Recebimento da venda",
          amount: 57800,
          occurredAt: new Date("2026-03-18"),
          paymentMethod: PaymentMethod.PIX
        }
      });
    }
  }

  const publishedAd = await prisma.advertisement.findFirst();
  const vehicleForLead = vehicles[1];

  if (publishedAd && vehicleForLead) {
    await prisma.lead.create({
      data: {
        vehicleId: vehicleForLead.id,
        advertisementId: publishedAd.id,
        customerName: "Interessado Demo",
        phone: "(11) 98888-1001",
        source: LeadSource.WHATSAPP,
        stage: LeadStage.NEGOCIANDO,
        notes: "Cliente pediu fotos adicionais e condicao de financiamento.",
        conversationLog: {
          messages: [
            "Primeiro contato via WhatsApp",
            "Solicitou documento e historico de manutencao"
          ]
        } as never,
        lastContactAt: new Date()
      }
    });
  }
}

async function main() {
  await resetDatabase();
  await seedBaseData();
  await seedAuthUsers();
  await seedVehicles();
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
