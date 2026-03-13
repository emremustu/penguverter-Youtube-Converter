const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const { spawn } = require("child_process");
const fs = require("fs");

const isDev = !app.isPackaged;

let win;


function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 900,
    backgroundColor: "#0f0f0f",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    },
    icon: path.join(__dirname, "renderer/assets/Penguverter.ico"),
  });

  const isDev = process.env.ELECTRON_IS_DEV === "true";

  win.loadURL("http://localhost:5173").catch(() => {
    console.log("❌ localhost:5173 başarısız, production yükleniyor...");
    const filePath = path.join(__dirname, "dist", "index.html");
    win.loadFile(filePath);
  });
}



app.whenReady().then(createWindow);

// 📂 klasör seç
ipcMain.handle("select-folder", async () => {
  const res = await dialog.showOpenDialog({
    properties: ["openDirectory"],
  });
  return res.canceled ? null : res.filePaths[0];
});
function getUniquePath(folder, baseName, ext) {
  let i = 0;
  let filePath;

  do {
    const suffix = i === 0 ? "" : `(${i})`;
    filePath = path.join(folder, `${baseName}${suffix}.${ext}`);
    i++;
  } while (fs.existsSync(filePath));

  console.log("FINAL PATH:", filePath);
  return filePath;
}

// 🎥 video info
ipcMain.handle("get-info", async (event, url) => {
  const basePath = isDev ? __dirname : process.resourcesPath;
  const ytDlp = path.join(basePath, "bin", "yt-dlp.exe");

  console.log("YTDLP PATH:", ytDlp);

  return new Promise((resolve, reject) => {
    const proc = spawn(ytDlp, ["-j", "--no-playlist", url]);

    let data = "";
    let error = "";

    // ✅ stdout
    proc.stdout.on("data", (d) => {
      console.log("STDOUT CHUNK:", d.toString());
      data += d.toString();
    });

    // ✅ stderr (ÇOK ÖNEMLİ)
    proc.stderr.on("data", (d) => {
      console.log("STDERR:", d.toString());
      error += d.toString();
    });

    proc.on("error", (err) => {
      console.log("SPAWN ERROR:", err);
      reject(err);
    });

    proc.on("close", (code) => {
      console.log("PROCESS CLOSED:", code);
      // console.log("RAW DATA:", data);
      console.log("ERROR DATA:", error);

      if (!data) {
        return reject("No data from yt-dlp");
      }

      try {
        const json = JSON.parse(data);
        console.log("PARSED JSON:", json);
        resolve({
          title: json.fulltitle,
          duration: json.duration,
          thumbnail: json.thumbnail,
          uploader: json.uploader,
        });
      } catch (e) {
        console.log("JSON PARSE ERROR:", e);
        reject(e);
      }
    });
  });
});


// 🧠 filename temizleme
function sanitize(name) {
  return name.replace(/[<>:"/\\|?*]+/g, "");
}

// 📊 progress parse
function parseProgress(line) {
  const match = line.match(/(\d+\.\d+)%/);
  return match ? parseFloat(match[1]) : null;
}

// 🎬 download
ipcMain.handle("download-video", async (event, data) => {
  const { url, folder, start, end, format, quality, fileName, includeTag } = data;

  const basePath = isDev
    ? __dirname
    : process.resourcesPath;

  const ytDlp = path.join(basePath, "bin", "yt-dlp.exe");
  const ffmpeg = path.join(basePath, "bin", "ffmpeg.exe");

  let name = sanitize(fileName || "output");

  if (includeTag) {
    name = `${name} (Converted by Penguverter)`;
  }

  return new Promise((resolve, reject) => {
    let formatArg = "best";

    if (quality === "720")
      formatArg = "bestvideo[height<=720]+bestaudio";
    if (quality === "480")
      formatArg = "bestvideo[height<=480]+bestaudio";

    const tempPath = `${folder}/temp.%(ext)s`;

    const ytdlp = spawn(ytDlp, [
      "--no-playlist",
      "-f", formatArg,
      "-o", tempPath,
      url,
    ]);

    ytdlp.stderr.on("data", (d) => {
      const line = d.toString();
      const p = parseProgress(line);
      if (p) win.webContents.send("progress", p);
    });

    ytdlp.on("close", () => {
      const file = fs.readdirSync(folder).find(f => f.startsWith("temp."));
      const inputFile = path.join(folder, file);

      const output = getUniquePath(folder, name, format);


      let args = ["-i", inputFile];

      // ⏱ sadece varsa ekle
      if (start) {
        console.log("START CUT:", start);
        args.push("-ss", start);
      }

      if (end) {
        console.log("END CUT:", end);
        args.push("-to", end);
      }

      args.push("-y");

      if (format === "mp3") {
        args.push(
          "-vn",
          "-ab", "192k",
          "-metadata", `title=${name}`
        );
      } else {
        args.push("-c", "copy");
      }

      const ff = spawn(ffmpeg, args.concat(output));

      ff.on("close", () => {
        fs.unlinkSync(inputFile);
        resolve(output);
      });
    });
  });
});
