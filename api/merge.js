import { exec } from "child_process";
import { writeFile, readFile } from "fs/promises";
import https from "https";
import ffmpeg from "ffmpeg-static";
import path from "path";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Only POST method allowed" });
  }

  const { videoUrl, audioUrl } = req.body;
  if (!videoUrl || !audioUrl) {
    return res.status(400).json({ error: "Missing videoUrl or audioUrl" });
  }

  const download = (url, filepath) =>
    new Promise((resolve, reject) => {
      const file = require("fs").createWriteStream(filepath);
      https.get(url, (response) => {
        response.pipe(file);
        file.on("finish", () => file.close(resolve));
      }).on("error", reject);
    });

  try {
    const videoPath = "/tmp/input.mp4";
    const audioPath = "/tmp/audio.mp3";
    const outputPath = "/tmp/output.mp4";

    await download(videoUrl, videoPath);
    await download(audioUrl, audioPath);

    const cmd = `${ffmpeg} -y -i ${videoPath} -i ${audioPath} -c:v copy -c:a aac -map 0:v:0 -map 1:a:0 -shortest ${outputPath}`;

    await new Promise((resolve, reject) => {
      exec(cmd, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });

    const outputBuffer = await readFile(outputPath);

    res.setHeader("Content-Type", "video/mp4");
    res.setHeader("Content-Disposition", "attachment; filename=merged.mp4");
    res.send(outputBuffer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Merging failed", details: err.message });
  }
}
