import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { PAYMENT_METHOD_OPTIONS, PAYMENT_STATUS_OPTIONS, VEHICLE_STATUS_LABELS } from "@/lib/constants";

export function FinancialFilters({
  vehicles = [],
  suppliers = [],
  categories = [],
  compact = false
}: {
  vehicles?: any[];
  suppliers?: any[];
  categories?: any[];
  compact?: boolean;
}) {
  return (
    <Card>
      <CardHeader title="Filtros financeiros" description="Refine por periodo, veiculo, fornecedor, categoria, pagamento e status." />
      <CardContent>
        <form className={`grid gap-3 ${compact ? "md:grid-cols-3 xl:grid-cols-6" : "md:grid-cols-4 xl:grid-cols-8"}`}>
          <Input name="from" type="date" aria-label="Periodo inicial" />
          <Input name="to" type="date" aria-label="Periodo final" />
          <Select name="vehicleStatus" aria-label="Status do veiculo">
            <option value="">Status do veiculo</option>
            {Object.entries(VEHICLE_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </Select>
          <Select name="vehicleId" aria-label="Veiculo">
            <option value="">Veiculo/lote</option>
            {vehicles.map((vehicle) => (
              <option key={vehicle.id} value={vehicle.id}>{vehicle.stockCode} {vehicle.brand} {vehicle.model}</option>
            ))}
          </Select>
          <Select name="supplierId" aria-label="Fornecedor">
            <option value="">Fornecedor</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
            ))}
          </Select>
          <Select name="categoryId" aria-label="Categoria financeira">
            <option value="">Categoria</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </Select>
          <Select name="paymentMethod" aria-label="Forma de pagamento">
            <option value="">Pagamento</option>
            {PAYMENT_METHOD_OPTIONS.map((method) => (
              <option key={method} value={method}>{method}</option>
            ))}
          </Select>
          <Select name="paymentStatus" aria-label="Status do pagamento">
            <option value="">Status</option>
            {PAYMENT_STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </Select>
        </form>
      </CardContent>
    </Card>
  );
}
