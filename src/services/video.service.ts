import { ensureDirectoryExists, uploadDirectory } from "../utils/helper";

import path from "node:path";
import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import type { Readable } from "node:stream";

export async function videoService(
  filename: string,
  input: Readable,
): Promise<void> {
  ensureDirectoryExists(uploadDirectory);

  if (!filename) {
    throw new Error("Filename is required");
  }

  const safeFilename = path.basename(filename);

  if (safeFilename !== filename) {
    throw new Error("Invalid filename");
  }

  const filePath = path.join(uploadDirectory, safeFilename);
  const writeStream = createWriteStream(filePath);

  try {
    await pipeline(input, writeStream);
  } catch (error) {
    console.error("Pipeline failed", error);
    throw new Error("File upload failed", { cause: error });
  }
}
