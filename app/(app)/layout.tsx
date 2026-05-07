import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { getServerAuthSession } from "@/lib/auth";

export default async function ProtectedLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const session = await getServerAuthSession();

  if (!session) {
    redirect("/login");
  }

  return <AppShell>{children}</AppShell>;
}
