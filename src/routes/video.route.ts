import { Request, Response, Router } from "express";
import { videoService } from "../services/video.service";

const videoRouter = Router();

videoRouter.post("/upload/:filename", async (req: Request, res: Response) => {
  const filename = String(req.params.filename);
  try {
    await videoService(filename, req);
    res.send(`File ${filename} uploaded successfully`);
  } catch (error) {
    return res.status(500).send((error as Error).message);
  }
});

export { videoRouter };
