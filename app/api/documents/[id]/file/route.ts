import { readFile, stat } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function isInsideStorage(storagePath: string) {
  const storageRoot = path.resolve(process.env.LOCAL_STORAGE_PATH ?? "./public/uploads");
  const absolutePath = path.resolve(storagePath);

  return absolutePath.startsWith(storageRoot + path.sep);
}

function contentDisposition(fileName: string, download: boolean) {
  const safeName = fileName.replace(/["\r\n]/g, "_");
  const disposition = download ? "attachment" : "inline";

  return `${disposition}; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(safeName)}`;
}

export async function GET(
  request: Request,
  {
    params
  }: {
    params: { id: string };
  }
) {
  const session = await getServerAuthSession();

  if (!session) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  const url = new URL(request.url);
  const download = url.searchParams.get("download") === "1";
  const document = await prisma.vehicleDocument.findUnique({
    where: {
      id: params.id
    },
    select: {
      id: true,
      fileName: true,
      mimeType: true,
      fileSize: true,
      storagePath: true
    }
  });

  if (!document) {
    return NextResponse.json({ error: "Documento nao encontrado." }, { status: 404 });
  }

  if (!isInsideStorage(document.storagePath)) {
    console.error("[documents:file]", {
      event: "unsafe_storage_path",
      documentId: document.id,
      storagePath: document.storagePath
    });

    return NextResponse.json({ error: "Arquivo indisponivel." }, { status: 404 });
  }

  try {
    const [fileBuffer, fileStat] = await Promise.all([readFile(document.storagePath), stat(document.storagePath)]);

    return new NextResponse(fileBuffer, {
      headers: {
        "content-type": document.mimeType || "application/octet-stream",
        "content-length": String(fileStat.size || document.fileSize),
        "content-disposition": contentDisposition(document.fileName, download),
        "cache-control": "private, max-age=0, no-store"
      }
    });
  } catch (error) {
    console.error("[documents:file]", {
      event: "file_read_failed",
      documentId: document.id,
      error
    });

    return NextResponse.json({ error: "Arquivo indisponivel." }, { status: 404 });
  }
}
