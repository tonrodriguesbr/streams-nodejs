import { Request, Response, Router } from "express";
import { VideoService } from "../services/video.service";

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
    res.status(200).json(videos);
  } catch (error) {
    return res.status(500).send((error as Error).message);
  }
});

export { videoRouter };
