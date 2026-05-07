import { prisma } from "@/lib/prisma";

export async function createAuditLog(input: {
  userId?: string | null;
  entityType: string;
  entityId: string;
  action: string;
  beforeData?: unknown;
  afterData?: unknown;
  message?: string;
}) {
  await prisma.auditLog.create({
    data: {
      userId: input.userId ?? undefined,
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      beforeData: input.beforeData as never,
      afterData: input.afterData as never,
      message: input.message
    }
  });
}
