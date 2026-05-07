import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { slugify } from "@/lib/utils";

export async function saveFileLocally(file: File, folder: string) {
  const storageRoot = process.env.LOCAL_STORAGE_PATH ?? "./public/uploads";
  const buffer = Buffer.from(await file.arrayBuffer());
  const extension = path.extname(file.name) || "";
  const baseName = slugify(path.basename(file.name, extension)) || "arquivo";
  const fileName = `${Date.now()}-${baseName}${extension}`;
  const targetDir = path.resolve(storageRoot, folder);

  await mkdir(targetDir, { recursive: true });

  const absolutePath = path.join(targetDir, fileName);
  await writeFile(absolutePath, buffer);

  const publicRoot = path.resolve("./public");
  const relativeToPublic = path.relative(publicRoot, absolutePath).replace(/\\/g, "/");
  const publicUrl = relativeToPublic.startsWith("..") ? absolutePath.replace(/\\/g, "/") : `/${relativeToPublic}`;

  return {
    storagePath: absolutePath,
    publicUrl,
    fileName
  };
}
