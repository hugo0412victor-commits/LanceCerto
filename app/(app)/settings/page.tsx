import { saveSettingAction } from "@/app/actions";
import { PageHeader } from "@/components/common/page-header";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { getSettingsOverview } from "@/lib/data";

export default async function SettingsPage() {
  const settings = await getSettingsOverview();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administracao"
        title="Configuracoes"
        description="Area editavel para branding, pesos do score, margens alvo e preferencias futuras do sistema."
      />

      <div className="grid gap-6 xl:grid-cols-2">
        {settings.map((setting) => (
          <Card key={setting.id}>
            <CardHeader title={setting.label} description={`${setting.group} • ${setting.key}`} />
            <CardContent>
              <form action={saveSettingAction} className="space-y-4">
                <input type="hidden" name="id" value={setting.id} />
                <Textarea
                  name="value"
                  defaultValue={
                    typeof setting.value === "string" ? setting.value : JSON.stringify(setting.value, null, 2)
                  }
                  className="min-h-[180px] font-mono text-xs"
                />
                <p className="text-sm text-muted">{setting.description ?? "Sem descricao adicional."}</p>
                <button type="submit" className="rounded-2xl bg-accent px-4 py-3 text-sm font-semibold text-white">
                  Salvar configuracao
                </button>
              </form>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
