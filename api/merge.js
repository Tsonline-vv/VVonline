const { exec } = require("child_process");
const fs = require("fs");
const https = require("https");
const ffmpeg = require("ffmpeg-static");
const path = require("path");
const { promisify } = require("util");
const { pipeline } = require("stream");

const streamPipeline = promisify(pipeline);
const execAsync = promisify(exec);

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Only POST method allowed" });
  }

  const { videoUrl, audioUrl } = req.body;
  if (!videoUrl || !audioUrl) {
    return res.status(400).json({ error: "Missing videoUrl or audioUrl" });
  }

  const download = (url, destPath) =>
    new Promise((resolve, reject) => {
      https.get(url, (response) => {
        const fileStream = fs.createWriteStream(destPath);
        response.pipe(fileStream);
        fileStream.on("finish", () => {
          fileStream.close(resolve);
        });
      }).on("error", reject);
    });

  try {
    const videoPath = "/tmp/input.mp4";
    const audioPath = "/tmp/audio.mp3";
    const outputPath = "/tmp/output.mp4";

    await download(videoUrl, videoPath);
    await download(audioUrl, audioPath);

    const cmd = `${ffmpeg} -y -i ${videoPath} -i ${audioPath} -c:v copy -c:a aac -map 0:v:0 -map 1:a:0 -shortest ${outputPath}`;
    await execAsync(cmd);

    const mergedBuffer = fs.readFileSync(outputPath);

    res.setHeader("Content-Type", "video/mp4");
    res.setHeader("Content-Disposition", "attachment; filename=merged.mp4");
    res.end(mergedBuffer);
  } catch (err) {
    console.error("Merge failed:", err);
    res.status(500).json({ error: "Merging failed", details: err.message });
  }
};
