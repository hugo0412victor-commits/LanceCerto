import { PageHeader } from "@/components/common/page-header";

export function FinancialPageHeader({
  title,
  description,
  actions
}: {
  title: string;
  description: string;
  actions?: React.ReactNode;
}) {
  return (
    <PageHeader
      eyebrow="Financeiro"
      title={title}
      description={description}
      actions={actions}
    />
  );
}
