import { NextResponse } from "next/server";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function toRows(resource: string, records: Record<string, unknown>[]): Record<string, unknown>[] {
  switch (resource) {
    case "vehicles":
      return records.map((record) => ({
        estoque: record.stockCode,
        marca: record.brand,
        modelo: record.model,
        status: record.status,
        leiloeira: record.auctionHouse,
        arremate: record.bidValue,
        venda_prevista: record.predictedSalePrice,
        lucro_previsto: record.predictedProfit
      }));
    case "expenses":
      return records.map((record) => ({
        veiculo: record.vehicle,
        categoria: record.category,
        descricao: record.description,
        previsto: record.predictedAmount,
        realizado: record.actualAmount,
        pagamento: record.paymentStatus
      }));
    case "financial-ledger":
      return records.map((record) => ({
        data_competencia: record.competenceDate,
        tipo: record.type,
        status: record.status,
        origem: record.sourceType,
        descricao: record.description,
        categoria: record.category,
        subcategoria: record.subcategory,
        veiculo: record.vehicle,
        fornecedor: record.supplier,
        cliente: record.customerName,
        valor: record.amount,
        valor_pago_recebido: record.paidAmount,
        vencimento: record.dueDate,
        pagamento: record.paidAt,
        recebimento: record.receivedAt,
        legado: record.isLegacy,
        anomalo: record.isAnomalous
      }));
    default:
      return records;
  }
}

export async function GET(
  request: Request,
  { params }: { params: { resource: string } }
) {
  const session = await getServerAuthSession();

  if (!session) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  const url = new URL(request.url);
  const format = url.searchParams.get("format") ?? "csv";
  const resource = params.resource;

  let rows: Record<string, unknown>[] = [];

  if (resource === "vehicles") {
    const vehicles = await prisma.vehicle.findMany({
      include: {
        auctionHouse: true
      }
    });
    rows = vehicles.map((vehicle) => ({
      stockCode: vehicle.stockCode ?? "",
      brand: vehicle.brand ?? "",
      model: vehicle.model ?? "",
      status: vehicle.status,
      auctionHouse: vehicle.auctionHouse?.name ?? "",
      bidValue: Number(vehicle.bidValue ?? 0),
      predictedSalePrice: Number(vehicle.predictedSalePrice ?? 0),
      predictedProfit: Number(vehicle.predictedProfit ?? 0)
    }));
  } else if (resource === "expenses") {
    const expenses = await prisma.expense.findMany({
      include: {
        vehicle: true,
        category: true
      }
    });
    rows = expenses.map((expense) => ({
      vehicle: `${expense.vehicle.brand ?? ""} ${expense.vehicle.model ?? ""}`.trim(),
      category: expense.category.name,
      description: expense.description,
      predictedAmount: Number(expense.predictedAmount ?? 0),
      actualAmount: Number(expense.actualAmount ?? 0),
      paymentStatus: expense.paymentStatus
    }));
  } else if (resource === "financial-ledger") {
    const entries = await prisma.financialEntry.findMany({
      include: {
        category: true,
        subcategory: true,
        vehicle: true,
        supplier: true
      },
      orderBy: {
        competenceDate: "desc"
      },
      take: 1000
    });
    rows = entries.map((entry) => ({
      competenceDate: entry.competenceDate?.toISOString().slice(0, 10) ?? "",
      type: entry.type,
      status: entry.status,
      sourceType: entry.sourceType,
      description: entry.description,
      category: entry.category?.name ?? "",
      subcategory: entry.subcategory?.name ?? "",
      vehicle: [entry.vehicle?.stockCode, entry.vehicle?.brand, entry.vehicle?.model].filter(Boolean).join(" "),
      supplier: entry.supplier?.name ?? "",
      customerName: entry.customerName ?? "",
      amount: Number(entry.amount),
      paidAmount: Number(entry.paidAmount ?? 0),
      dueDate: entry.dueDate?.toISOString().slice(0, 10) ?? "",
      paidAt: entry.paidAt?.toISOString().slice(0, 10) ?? "",
      receivedAt: entry.receivedAt?.toISOString().slice(0, 10) ?? "",
      isLegacy: entry.isLegacy ? "sim" : "nao",
      isAnomalous: entry.isAnomalous ? "sim" : "nao"
    }));
  } else if (resource === "simulations") {
    const simulations = await prisma.simulation.findMany();
    rows = simulations.map((simulation) => ({
      brand: simulation.brand ?? "",
      model: simulation.model ?? "",
      year: simulation.year ?? "",
      totalPredictedCost: Number(simulation.totalPredictedCost ?? 0),
      predictedProfit: Number(simulation.predictedProfit ?? 0),
      recommendation: simulation.recommendation ?? ""
    }));
  } else if (resource === "market-research") {
    const researches = await prisma.marketResearch.findMany({
      include: { vehicle: true }
    });
    rows = researches.map((research) => ({
      vehicle: `${research.vehicle.brand ?? ""} ${research.vehicle.model ?? ""}`.trim(),
      fipe: Number(research.fipeValue ?? 0),
      media_mercado: Number(research.marketAverage ?? 0),
      menor_preco: Number(research.lowestPrice ?? 0),
      maior_preco: Number(research.highestPrice ?? 0),
      liquidez: research.liquidityLevel
    }));
  }

  const normalizedRows = toRows(resource, rows);

  if (format === "xlsx") {
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(normalizedRows);
    XLSX.utils.book_append_sheet(workbook, worksheet, "Dados");
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
    return new NextResponse(buffer, {
      headers: {
        "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "content-disposition": `attachment; filename=${resource}.xlsx`
      }
    });
  }

  if (format === "pdf") {
    const document = new jsPDF();
    const headers = Object.keys(normalizedRows[0] ?? {});
    autoTable(document, {
      head: [headers],
      body: normalizedRows.map((row) => headers.map((header) => String(row[header] ?? "")))
    });

    return new NextResponse(Buffer.from(document.output("arraybuffer")), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename=${resource}.pdf`
      }
    });
  }

  const headers = Object.keys(normalizedRows[0] ?? {});
  const csv = [
    headers.join(";"),
    ...normalizedRows.map((row) => headers.map((header) => JSON.stringify(row[header] ?? "")).join(";"))
  ].join("\n");

  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename=${resource}.csv`
    }
  });
}
