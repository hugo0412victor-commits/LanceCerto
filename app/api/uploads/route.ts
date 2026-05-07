import { randomUUID } from "crypto";
import { unlink } from "fs/promises";
import { NextResponse } from "next/server";
import { DocumentCategory, PhotoCategory } from "@prisma/client";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { saveFileLocally } from "@/lib/storage";
import { createAuditLog } from "@/lib/audit";
import { canDelete, canWrite } from "@/lib/permissions";

export async function POST(request: Request) {
  try {
    const session = await getServerAuthSession();

    if (!session) {
      return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
    }

    if (!canWrite(session.user.role)) {
      return NextResponse.json({ error: "Permissao insuficiente para enviar arquivos." }, { status: 403 });
    }

    const formData = await request.formData();
    const vehicleId = String(formData.get("vehicleId") ?? "").trim();
    const type = String(formData.get("type") ?? "document");
    const category = String(formData.get("category") ?? "");
    const caption = String(formData.get("caption") ?? "").trim();
    const note = String(formData.get("note") ?? "").trim();
    const file = formData.get("file");

    if (!vehicleId || !(file instanceof File)) {
      return NextResponse.json({ error: "Veiculo e arquivo sao obrigatorios" }, { status: 400 });
    }

    const saved = await saveFileLocally(file, `${vehicleId}/${type}s`);

    if (type === "photo") {
      const photo = await prisma.vehiclePhoto.create({
        data: {
          vehicleId,
          uploadedById: session.user.id,
          category: (category as PhotoCategory) || PhotoCategory.OUTRAS,
          caption: caption || undefined,
          storagePath: saved.storagePath,
          publicUrl: saved.publicUrl
        }
      });

      await createAuditLog({
        userId: session.user.id,
        entityType: "VehiclePhoto",
        entityId: photo.id,
        action: "UPLOAD",
        message: "Foto enviada"
      });

      return NextResponse.json({ ok: true, photo });
    }

    let document;

    if (category === "GATEPASS") {
      const id = randomUUID();
      const rows = await prisma.$queryRaw<
        Array<{
          id: string;
          vehicleId: string;
          uploadedById: string | null;
          category: string;
          fileName: string;
          mimeType: string;
          fileSize: number;
          storagePath: string;
          publicUrl: string;
          note: string | null;
          createdAt: Date;
          updatedAt: Date;
        }>
      >`INSERT INTO "VehicleDocument" ("id", "vehicleId", "uploadedById", "category", "fileName", "mimeType", "fileSize", "storagePath", "publicUrl", "note", "createdAt", "updatedAt")
        VALUES (${id}, ${vehicleId}, ${session.user.id}, CAST(${category} AS "DocumentCategory"), ${file.name}, ${file.type || "application/octet-stream"}, ${file.size}, ${saved.storagePath}, ${saved.publicUrl}, ${note || null}, NOW(), NOW())
        RETURNING *`;

      document = rows[0];
    } else {
      document = await prisma.vehicleDocument.create({
        data: {
          vehicleId,
          uploadedById: session.user.id,
          category: (category as DocumentCategory) || DocumentCategory.OUTROS,
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
          fileSize: file.size,
          storagePath: saved.storagePath,
          publicUrl: saved.publicUrl,
          note: note || undefined
        }
      });
    }

    await createAuditLog({
      userId: session.user.id,
      entityType: "VehicleDocument",
      entityId: document.id,
      action: "UPLOAD",
      message: "Documento enviado"
    });

    return NextResponse.json({ ok: true, document });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Falha inesperada ao enviar o documento."
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  const session = await getServerAuthSession();

  if (!session) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  if (!canDelete(session.user.role)) {
    return NextResponse.json({ error: "Permissao insuficiente para excluir arquivos." }, { status: 403 });
  }

  const { id, type } = (await request.json()) as { id?: string; type?: "document" | "photo" };

  if (!id || !type) {
    return NextResponse.json({ error: "Parametros invalidos" }, { status: 400 });
  }

  if (type === "photo") {
    const photo = await prisma.vehiclePhoto.delete({
      where: { id }
    });

    try {
      await unlink(photo.storagePath);
    } catch {
      // arquivo pode ser placeholder, publico ou ja removido
    }

    await createAuditLog({
      userId: session.user.id,
      entityType: "VehiclePhoto",
      entityId: id,
      action: "DELETE",
      message: "Foto removida"
    });

    return NextResponse.json({ ok: true });
  }

  const document = await prisma.vehicleDocument.delete({
    where: { id }
  });

  try {
    await unlink(document.storagePath);
  } catch {
    // arquivo pode ser placeholder, publico ou ja removido
  }

  await createAuditLog({
    userId: session.user.id,
    entityType: "VehicleDocument",
    entityId: id,
    action: "DELETE",
    message: "Documento removido"
  });

  return NextResponse.json({ ok: true });
}
