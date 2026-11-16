import {
  ensureDirectoryExists,
  fileExists,
  uploadDirectory,
} from "../utils/helper";

import path from "node:path";
import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import type { Readable, Writable } from "node:stream";
import { readdir } from "node:fs/promises";
import { spawn } from "node:child_process";

export class VideoNotFoundError extends Error {
  constructor(filename: string) {
    super(`Video "${filename}" not found`);
    this.name = "VideoNotFoundError";
  }
}

export interface StreamVideoOptions {
  signal?: AbortSignal;
  onReady?: () => void;
}

export class VideoService {
  private resolveSafeFilePath(filename: string): string {
    ensureDirectoryExists(uploadDirectory);

    if (!filename) {
      throw new Error("Filename is required");
    }

    const safeFilename = path.basename(filename);

    if (safeFilename !== filename) {
      throw new Error("Invalid filename");
    }

    return path.join(uploadDirectory, safeFilename);
  }

  async uploadVideo(filename: string, input: Readable): Promise<void> {
    const filePath = this.resolveSafeFilePath(filename);
    const writeStream = createWriteStream(filePath);

    try {
      await pipeline(input, writeStream);
    } catch (error) {
      console.error("Pipeline failed", error);
      throw new Error("File upload failed", { cause: error });
    }
  }

  async listVideos(): Promise<{ filename: string; url: string }[]> {
    ensureDirectoryExists(uploadDirectory);

    const files = await readdir(uploadDirectory);
    const videoFiles = files.filter((file) => {
      const ext = path.extname(file).toLowerCase();
      return [".mp4", ".avi", ".mkv", ".mov"].includes(ext);
    });

    const videos = videoFiles.map((file) => ({
      filename: file,
      url: `/uploads/${file}`,
    }));

    return videos;
  }

  async streamVideo(
    filename: string,
    response: Writable,
    options?: StreamVideoOptions,
  ): Promise<void> {
    const filePath = this.resolveSafeFilePath(filename);

    if (!(await fileExists(filePath))) {
      throw new VideoNotFoundError(filename);
    }

    if (options?.signal?.aborted) {
      return;
    }

    const ffmpegProcess = spawn("ffmpeg", [
      "-i",
      filePath,
      "-vcodec",
      "libx264",
      "-acodec",
      "aac",
      "-movflags",
      "frag_keyframe+empty_moov+default_base_moof",
      "-b:v",
      "1500k",
      "-maxrate",
      "1500k",
      "-bufsize",
      "1000k",
      "-f",
      "mp4",
      "pipe:1",
    ]);

    ffmpegProcess.stderr.on("data", (data) => {
      console.error(`FFmpeg stderr: ${data}`);
    });

    const killProcess = () => {
      if (!ffmpegProcess.killed && ffmpegProcess.exitCode === null) {
        ffmpegProcess.kill("SIGKILL");
      }
    };

    const onAbort = () => killProcess();
    options?.signal?.addEventListener("abort", onAbort, { once: true });

    try {
      await new Promise<void>((resolve, reject) => {
        ffmpegProcess.once("error", reject);
        ffmpegProcess.once("spawn", () => {
          ffmpegProcess.off("error", reject);
          resolve();
        });
      });

      options?.onReady?.();

      const exitPromise = new Promise<void>((resolve, reject) => {
        ffmpegProcess.once("error", reject);
        ffmpegProcess.once("close", (code, signal) => {
          if (code === 0 || options?.signal?.aborted) {
            resolve();
            return;
          }
          reject(
            new Error(
              `FFmpeg process exited with code ${code}${signal ? ` (signal ${signal})` : ""}`,
            ),
          );
        });
      });

      const pipelinePromise = pipeline(ffmpegProcess.stdout, response, {
        signal: options?.signal,
      }).catch((error) => {
        killProcess();
        throw error;
      });

      const [pipelineResult, exitResult] = await Promise.allSettled([
        pipelinePromise,
        exitPromise,
      ]);

      if (pipelineResult.status === "rejected") {
        throw pipelineResult.reason;
      }
      if (exitResult.status === "rejected") {
        throw exitResult.reason;
      }
    } catch (error) {
      killProcess();
      throw error;
    } finally {
      options?.signal?.removeEventListener("abort", onAbort);
    }
  }
}
