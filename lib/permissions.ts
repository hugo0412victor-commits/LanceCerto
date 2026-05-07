import type { Session } from "next-auth";
import { redirect } from "next/navigation";

const rolePermissions: Record<string, string[]> = {
  ADMIN: ["*"],
  BUYER: ["dashboard", "vehicles", "simulator", "market-research", "score"],
  FINANCE: ["dashboard", "expenses", "cashflow", "reports", "sales"],
  OPERATIONS: ["dashboard", "vehicles", "documents", "photos", "processes"],
  SALES: ["dashboard", "vehicles", "sales", "ads", "market-research"],
  PARTNER: ["partner-tasks"]
};

export function hasPermission(session: Session | null, permission: string) {
  const role = session?.user?.role;
  if (!role) {
    return false;
  }

  const permissions = rolePermissions[role] ?? [];
  return permissions.includes("*") || permissions.includes(permission);
}

export function requirePermission(session: Session | null, permission: string) {
  if (!hasPermission(session, permission)) {
    redirect("/dashboard");
  }
}
