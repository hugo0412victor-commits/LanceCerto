import { prisma } from "@/lib/prisma";

export async function getBrandingSettings() {
  try {
    const settings = await prisma.setting.findMany({
      where: {
        key: {
          in: ["system_name", "company_name"]
        }
      }
    });

    const systemName =
      typeof settings.find((item) => item.key === "system_name")?.value === "string"
        ? (settings.find((item) => item.key === "system_name")?.value as string)
        : process.env.SYSTEM_NAME ?? "AutoArremate Gestao";

    const companyName =
      typeof settings.find((item) => item.key === "company_name")?.value === "string"
        ? (settings.find((item) => item.key === "company_name")?.value as string)
        : process.env.COMPANY_NAME ?? "Empresa Demo";

    return { systemName, companyName };
  } catch {
    return {
      systemName: process.env.SYSTEM_NAME ?? "AutoArremate Gestao",
      companyName: process.env.COMPANY_NAME ?? "Empresa Demo"
    };
  }
}
