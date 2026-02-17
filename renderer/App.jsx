import { useState } from "react";
import logo from "./assets/logo.png";

function getVideoId(url) {
  try {
    const u = new URL(url);

    if (u.searchParams.get("v")) return u.searchParams.get("v");
    if (u.hostname.includes("youtu.be")) return u.pathname.split("/")[1];
    if (u.pathname.includes("/embed/")) return u.pathname.split("/embed/")[1];
    if (u.pathname.includes("/shorts/")) return u.pathname.split("/shorts/")[1];

    return null;
  } catch {
    return null;
  }
}

function timeToSeconds(t) {
  if (!t) return null;

  const parts = t.split(":").map(Number);
  if (parts.some(isNaN)) return null;

  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];

  return null;
}

// 🌍 Language dictionary
const translations = {
  tr: {
    title: "Penguverter",
    subtitle: "Ses & Video Dönüştürücü",
    urlPlaceholder: "YouTube URL",
    start: "Başlangıç",
    end: "Bitiş",
    filename: "Dosya adı (boşsa video adı)",
    folder: "Klasör Seç",
    download: "İndir",
    alertRequired: "URL ve klasör gerekli",
    alertDone: "İndirme tamamlandı",
    alertStart: "Başlangıç formatı yanlış",
    alertEnd: "Bitiş formatı yanlış",
    alertRange: "Başlangıç bitişten küçük olmalı",
    quality: "Kalite",
  },
  en: {
    title: "Penguverter",
    subtitle: "Audio & Video Converter",
    urlPlaceholder: "YouTube URL",
    start: "Start",
    end: "End",
    filename: "File name (leave empty for video title)",
    folder: "Select Folder",
    download: "Download",
    alertRequired: "URL and folder required",
    alertDone: "Download completed",
    alertStart: "Invalid start format",
    alertEnd: "Invalid end format",
    alertRange: "Start must be less than end",
    quality: "Quality",
  },
};

export default function App() {
  const [lang, setLang] = useState("tr");

  const t = translations[lang];

  const [url, setUrl] = useState("");
  const [folder, setFolder] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [format, setFormat] = useState("mp3");
  const [quality, setQuality] = useState("best");
  const [fileName, setFileName] = useState("");

  const videoId = getVideoId(url);

  const chooseFolder = async () => {
    const f = await window.electron.selectFolder();
    if (f) setFolder(f);
  };

  const download = async () => {
    console.log("DOWNLOAD START");

    if (!url || !folder) {
      alert(t.alertRequired);
      return;
    }

    const startSec = timeToSeconds(start);
    const endSec = timeToSeconds(end);

    if (start && startSec === null) {
      alert(t.alertStart);
      return;
    }

    if (end && endSec === null) {
      alert(t.alertEnd);
      return;
    }

    if (startSec !== null && endSec !== null && startSec >= endSec) {
      alert(t.alertRange);
      return;
    }

    const res = await window.electron.downloadVideo({
      url,
      folder,
      start: start || null,
      end: end || null,
      format,
      quality,
      fileName,
      includeTag: true,
    });

    console.log("DONE:", res);

    alert(t.alertDone);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-900 to-black text-white p-6 flex flex-col">
      
      {/* HEADER */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <img src={logo} className="w-12 h-12 rounded-xl" />

          <div>
            <h1 className="text-2xl font-bold">{t.title}</h1>
            <p className="text-xs text-gray-400">{t.subtitle}</p>
          </div>
        </div>

        {/* 🌍 Language Switch */}
        <select
          value={lang}
          onChange={(e) => setLang(e.target.value)}
          className="bg-zinc-800 border border-zinc-600 px-3 py-1 rounded-lg"
        >
          <option value="tr">TR</option>
          <option value="en">EN</option>
        </select>
      </div>

      {/* MAIN */}
      <div className="max-w-3xl mx-auto w-full flex-1">
        
        <input
          className="border border-zinc-600 bg-zinc-800 p-3 w-full mb-4 rounded-xl"
          placeholder={t.urlPlaceholder}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />

        {videoId && (
          <iframe
            className="w-full h-64 mb-4 rounded-xl"
            src={`https://www.youtube.com/embed/${videoId}`}
            allowFullScreen
          />
        )}

        {/* TIME RANGE */}
        <div className="mb-4 grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-gray-400">{t.start}</label>
            <input
              className="w-full p-2 rounded-lg bg-zinc-800 border border-zinc-600"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              placeholder="00:30"
            />
          </div>

          <div>
            <label className="text-xs text-gray-400">{t.end}</label>
            <input
              className="w-full p-2 rounded-lg bg-zinc-800 border border-zinc-600"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              placeholder="01:10"
            />
          </div>
        </div>

        {/* FILENAME */}
        <input
          className="border border-zinc-600 bg-zinc-800 p-3 w-full mb-4 rounded-xl"
          placeholder={t.filename}
          value={fileName}
          onChange={(e) => setFileName(e.target.value)}
        />

        {/* FORMAT */}
        <div className="flex gap-2 mb-4">
          <select
            className="bg-zinc-800 border border-zinc-600 p-2 rounded-lg"
            value={format}
            onChange={(e) => setFormat(e.target.value)}
          >
            <option value="mp3">MP3</option>
            <option value="mp4">MP4</option>
          </select>

          {format === "mp4" && (
            <select
              className="bg-zinc-800 border border-zinc-600 p-2 rounded-lg"
              value={quality}
              onChange={(e) => setQuality(e.target.value)}
            >
              <option value="best">{t.quality} (Best)</option>
              <option value="720">720p</option>
              <option value="480">480p</option>
            </select>
          )}
        </div>

        {/* ACTIONS */}
        <div className="flex gap-3 items-center">
          <button
            onClick={chooseFolder}
            className="bg-zinc-700 hover:bg-zinc-600 px-4 py-2 rounded-xl"
          >
            {t.folder}
          </button>

          <span className="text-xs text-gray-400 truncate">
            {folder}
          </span>
        </div>

        <button
          onClick={download}
          className="mt-4 w-full bg-blue-600 hover:bg-blue-500 py-3 rounded-xl font-semibold"
        >
          {t.download}
        </button>
      </div>

      {/* FOOTER */}
      <div className="text-center text-xs text-gray-500 mt-6">
        Made by Yusuf Emre Muştu🚀
        <br />
        <a
          href="https://github.com/emremustu/penguverter-Youtube-Converter"
          target="_blank"
          className="text-blue-400 hover:underline"
        >
          GitHub Repository
        </a>
      </div>
    </div>
  );
}
