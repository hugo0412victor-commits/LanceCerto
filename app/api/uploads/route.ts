import { randomUUID } from "crypto";
import { unlink } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { DocumentCategory, PhotoCategory } from "@prisma/client";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { saveFileLocally } from "@/lib/storage";
import { createAuditLog } from "@/lib/audit";
import { canDelete, canWrite } from "@/lib/permissions";
import { slugify } from "@/lib/utils";

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
const DOCUMENT_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
]);
const PHOTO_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const EXTENSION_BY_MIME: Record<string, string[]> = {
  "application/pdf": [".pdf"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
  "application/msword": [".doc"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
  "application/vnd.ms-excel": [".xls"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"]
};

function sanitizeOriginalName(value: string) {
  const name = path.basename(value).replace(/[^\w.\- ()]/g, "_").slice(0, 180);
  return name || "documento";
}

function buildStoredName(vehicleId: string, file: File) {
  const mimeType = file.type || "application/octet-stream";
  const extension = path.extname(file.name).toLowerCase();
  const allowedExtensions = EXTENSION_BY_MIME[mimeType] ?? [];
  const safeExtension = allowedExtensions.includes(extension) ? extension : allowedExtensions[0] ?? "";
  const safeVehicleId = slugify(vehicleId) || "vehicle";

  return `${safeVehicleId}_${Date.now()}_${randomUUID()}${safeExtension}`;
}

function validateUploadedFile(file: File, type: "document" | "photo") {
  const mimeType = file.type || "application/octet-stream";
  const extension = path.extname(file.name).toLowerCase();
  const allowedMimeTypes = type === "photo" ? PHOTO_MIME_TYPES : DOCUMENT_MIME_TYPES;
  const allowedExtensions = EXTENSION_BY_MIME[mimeType] ?? [];

  if (file.size <= 0) {
    return "Arquivo vazio nao pode ser enviado.";
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return "Arquivo acima do limite de 15 MB.";
  }

  if (!allowedMimeTypes.has(mimeType) || !allowedExtensions.includes(extension)) {
    return "Tipo de arquivo nao permitido. Envie PDF ou imagem.";
  }

  if (/[\\/]/.test(file.name) || file.name.includes("..")) {
    return "Nome de arquivo invalido.";
  }

  return null;
}

async function removeLocalFile(storagePath: string) {
  const storageRoot = path.resolve(process.env.LOCAL_STORAGE_PATH ?? "./public/uploads");
  const absolutePath = path.resolve(storagePath);

  if (!absolutePath.startsWith(storageRoot + path.sep)) {
    throw new Error("Arquivo fora da pasta de armazenamento local.");
  }

  await unlink(absolutePath);
}

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
    const type = String(formData.get("type") ?? "document") === "photo" ? "photo" : "document";
    const category = String(formData.get("category") ?? "");
    const caption = String(formData.get("caption") ?? "").trim();
    const note = String(formData.get("note") ?? "").trim();
    const file = formData.get("file");

    console.log("[documents:upload]", {
      event: "upload_started",
      vehicleId,
      type,
      category,
      userId: session.user.id
    });

    if (!vehicleId || !(file instanceof File)) {
      return NextResponse.json({ error: "Veiculo e arquivo sao obrigatorios" }, { status: 400 });
    }

    const vehicle = await prisma.vehicle.findUnique({
      where: {
        id: vehicleId
      },
      select: {
        id: true
      }
    });

    if (!vehicle) {
      return NextResponse.json({ error: "Veiculo nao encontrado para vincular o arquivo." }, { status: 404 });
    }

    const validationError = validateUploadedFile(file, type);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    if (type === "photo" && !Object.values(PhotoCategory).includes(category as PhotoCategory)) {
      return NextResponse.json({ error: "Categoria de foto invalida." }, { status: 400 });
    }

    console.log("[documents:upload]", {
      event: "file_received",
      vehicleId,
      originalName: file.name,
      mimeType: file.type,
      size: file.size
    });

    const saved = await saveFileLocally(file, `${vehicleId}/${type}s`, buildStoredName(vehicleId, file));

    console.log("[documents:upload]", {
      event: "file_saved",
      vehicleId,
      storagePath: saved.storagePath
    });

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
    const documentCategory = Object.values(DocumentCategory).includes(category as DocumentCategory)
      ? (category as DocumentCategory)
      : DocumentCategory.OUTROS;

    if (documentCategory === "GATEPASS") {
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
        VALUES (${id}, ${vehicleId}, ${session.user.id}, CAST(${documentCategory} AS "DocumentCategory"), ${sanitizeOriginalName(file.name)}, ${file.type || "application/octet-stream"}, ${file.size}, ${saved.storagePath}, ${saved.publicUrl}, ${note || null}, NOW(), NOW())
        RETURNING *`;

      document = rows[0];
    } else {
      document = await prisma.vehicleDocument.create({
        data: {
          vehicleId,
          uploadedById: session.user.id,
          category: documentCategory,
          fileName: sanitizeOriginalName(file.name),
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

    console.log("[documents:upload]", {
      event: "record_created",
      vehicleId,
      documentId: document.id,
      category: documentCategory
    });

    return NextResponse.json({ ok: true, document });
  } catch (error) {
    console.error("[documents:upload]", {
      event: "upload_failed",
      error
    });

    return NextResponse.json(
      {
        error: "Falha inesperada ao enviar o documento."
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

  console.log("[documents:delete]", {
    event: "delete_started",
    id,
    type,
    userId: session.user.id
  });

  if (type === "photo") {
    const existingPhoto = await prisma.vehiclePhoto.findUnique({
      where: { id }
    });

    if (!existingPhoto) {
      return NextResponse.json({ error: "Arquivo nao encontrado." }, { status: 404 });
    }

    try {
      await removeLocalFile(existingPhoto.storagePath);
    } catch (error) {
      console.error("[documents:delete]", {
        event: "file_remove_failed",
        id,
        type,
        error
      });

      return NextResponse.json({ error: "Nao foi possivel remover o arquivo fisico." }, { status: 500 });
    }

    const photo = await prisma.vehiclePhoto.delete({
      where: { id }
    });

    await createAuditLog({
      userId: session.user.id,
      entityType: "VehiclePhoto",
      entityId: id,
      action: "DELETE",
      message: "Foto removida"
    });

    console.log("[documents:delete]", {
      event: "record_removed",
      id,
      type,
      storagePath: photo.storagePath
    });

    return NextResponse.json({ ok: true });
  }

  const existingDocument = await prisma.vehicleDocument.findUnique({
    where: { id }
  });

  if (!existingDocument) {
    return NextResponse.json({ error: "Documento nao encontrado." }, { status: 404 });
  }

  try {
    await removeLocalFile(existingDocument.storagePath);
  } catch (error) {
    console.error("[documents:delete]", {
      event: "file_remove_failed",
      id,
      type,
      error
    });

    return NextResponse.json({ error: "Nao foi possivel remover o arquivo fisico." }, { status: 500 });
  }

  console.log("[documents:delete]", {
    event: "file_removed",
    id,
    storagePath: existingDocument.storagePath
  });

  const document = await prisma.vehicleDocument.delete({
    where: { id }
  });

  await createAuditLog({
    userId: session.user.id,
    entityType: "VehicleDocument",
    entityId: id,
    action: "DELETE",
    message: "Documento removido"
  });

  console.log("[documents:delete]", {
    event: "record_removed",
    id,
    type,
    vehicleId: document.vehicleId
  });

  return NextResponse.json({ ok: true });
}
