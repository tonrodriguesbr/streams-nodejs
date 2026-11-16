import { Request, Response, Router } from "express";
import { VideoNotFoundError, VideoService } from "../services/video.service";

const videoRouter = Router();
const videoService = new VideoService();

videoRouter.post("/upload/:filename", async (req: Request, res: Response) => {
  const filename = String(req.params.filename);
  try {
    await videoService.uploadVideo(filename, req);
    res.send(`File ${filename} uploaded successfully`);
  } catch (error) {
    return res.status(500).send((error as Error).message);
  }
});

videoRouter.get("/videos", async (req: Request, res: Response) => {
  try {
    const videos = await videoService.listVideos();
    res.writeHead(200).json(videos);
  } catch (error) {
    return res.status(500).send((error as Error).message);
  }
});

videoRouter.get("/video/:filename", async (req: Request, res: Response) => {
  const filename = String(req.params.filename);
  const abortController = new AbortController();

  res.on("close", () => {
    if (!res.writableFinished) {
      abortController.abort();
    }
  });

  try {
    await videoService.streamVideo(filename, res, {
      signal: abortController.signal,
      onReady: () => {
        res.writeHead(200, { "Content-Type": "video/mp4" });
      },
    });
  } catch (error) {
    if (abortController.signal.aborted) {
      return;
    }

    if (res.headersSent) {
      console.error("Error during video streaming:", error);
      if (!res.writableEnded) {
        res.destroy();
      }
      return;
    }

    if (error instanceof VideoNotFoundError) {
      return res.status(404).send(error.message);
    }

    return res.status(500).send((error as Error).message);
  }
});

export { videoRouter };
