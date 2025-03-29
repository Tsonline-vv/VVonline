const { exec } = require("child_process");
const fs = require("fs");
const https = require("https");
const ffmpeg = require("ffmpeg-static");
const { promisify } = require("util");

const execAsync = promisify(exec);

const download = (url, destPath) =>
  new Promise((resolve, reject) => {
    https.get(url, (response) => {
      const file = fs.createWriteStream(destPath);
      response.pipe(file);
      file.on("finish", () => file.close(resolve));
    }).on("error", reject);
  });

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Only POST method allowed" });
  }

  const { video1Url, video2Url } = req.body;

  if (!video1Url || !video2Url) {
    return res.status(400).json({ error: "Missing one or both video URLs" });
  }

  try {
    const video1Path = "/tmp/video1.mp4";
    const video2Path = "/tmp/video2.mp4";
    const listPath = "/tmp/fileList.txt";
    const outputPath = "/tmp/combined.mp4";

    // Download both videos
    await download(video1Url, video1Path);
    await download(video2Url, video2Path);

    // Create a file list for FFmpeg
    fs.writeFileSync(listPath, `file '${video1Path}'\nfile '${video2Path}'`);

    // Run FFmpeg concat
    const cmd = `${ffmpeg} -f concat -safe 0 -i ${listPath} -c copy ${outputPath}`;
    await execAsync(cmd);

    const outputBuffer = fs.readFileSync(outputPath);

    res.setHeader("Content-Type", "video/mp4");
    res.setHeader("Content-Disposition", "attachment; filename=joined.mp4");
    res.end(outputBuffer);
  } catch (err) {
    console.error("❌ Video Join Error:", err);
    res.status(500).json({ error: "Joining failed", details: err.message });
  }
};
