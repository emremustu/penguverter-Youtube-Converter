import { useState, useEffect, useRef } from "react";
import logo from "./assets/logo.png";

// ─────────────────────────── helpers ───────────────────────────
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

function fmtDuration(sec) {
  const m = Math.floor(sec / 60);
  const s = (sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

// ─────────────────────────── i18n ───────────────────────────
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
    downloadAll: "Tümünü İndir",
    alertRequired: "URL ve klasör gerekli",
    alertDone: "İndirme tamamlandı",
    alertAllDone: "Tüm indirmeler tamamlandı!",
    alertStart: "Başlangıç formatı yanlış",
    alertEnd: "Bitiş formatı yanlış",
    alertRange: "Başlangıç bitişten küçük olmalı",
    quality: "Kalite",
    loadingInfo: "Video bilgisi yükleniyor, lütfen bekleyin…",
    singleMode: "Tekli",
    bulkMode: "Toplu",
    addUrl: "Ekle",
    removeUrl: "Kaldır",
    bulkPlaceholder: "YouTube URL ekle…",
    bulkHint: "Birden fazla link ekleyerek toplu indirme yapın",
    bulkStatus: (done, total) => `${done} / ${total} tamamlandı`,
    downloading: "İndiriliyor…",
    infoError: "Video bilgisi alınamadı",
    filenamePlaceholder: "Dosya adı (varsayılan: video başlığı)",
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
    downloadAll: "Download All",
    alertRequired: "URL and folder required",
    alertDone: "Download completed",
    alertAllDone: "All downloads completed!",
    alertStart: "Invalid start format",
    alertEnd: "Invalid end format",
    alertRange: "Start must be less than end",
    quality: "Quality",
    loadingInfo: "Loading video info, please wait…",
    singleMode: "Single",
    bulkMode: "Bulk",
    addUrl: "Add",
    removeUrl: "Remove",
    bulkPlaceholder: "Add a YouTube URL…",
    bulkHint: "Add multiple links to download them all at once",
    bulkStatus: (done, total) => `${done} / ${total} done`,
    downloading: "Downloading…",
    infoError: "Could not load video info",
    filenamePlaceholder: "File name (default: video title)",
  },
};

// ─────────────────────────── bulk item helpers ───────────────────────────
// item shape: { id, url, status, progress, info, loadingInfo, infoError, fileName }

function makeBulkItem(id, url) {
  return { id, url, status: "idle", progress: 0, info: null, loadingInfo: false, infoError: false, fileName: "" };
}

// ─────────────────────────── component ───────────────────────────
export default function App() {
  const [lang, setLang] = useState("tr");
  const t = translations[lang];

  const [mode, setMode] = useState("single");

  // ── single mode ──
  const [url, setUrl] = useState("");
  const [info, setInfo] = useState(null);
  const [loadingInfo, setLoadingInfo] = useState(false);
  const [infoError, setInfoError] = useState(false);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [fileName, setFileName] = useState("");

  // ── bulk mode ──
  const [bulkItems, setBulkItems] = useState([]);
  const [bulkInput, setBulkInput] = useState("");
  const nextId = useRef(1);
  const [bulkDone, setBulkDone] = useState(0);

  // ── shared ──
  const [folder, setFolder] = useState("");
  const [format, setFormat] = useState("mp3");
  const [quality, setQuality] = useState("best");
  const [progress, setProgress] = useState(0);
  const [downloading, setDownloading] = useState(false);

  // ── progress listener (single mode) ──
  useEffect(() => {
    if (!window.electron?.onProgress) return;
    const handler = (p) => setProgress(p);
    window.electron.onProgress(handler);
    return () => window.electron.removeProgress?.(handler);
  }, []);

  // ── auto-fetch video info (single mode) ──
  useEffect(() => {
    if (!url) { setInfo(null); setInfoError(false); setLoadingInfo(false); return; }
    let cancelled = false;
    setInfo(null); setInfoError(false); setLoadingInfo(true);
    window.electron.getInfo(url)
      .then((data) => {
        if (cancelled) return;
        setInfo(data);
        setLoadingInfo(false);
        if (!fileName && data?.title) setFileName(data.title);
      })
      .catch(() => { if (!cancelled) { setLoadingInfo(false); setInfoError(true); } });
    return () => { cancelled = true; };
  }, [url]);

  const videoId = getVideoId(url);

  // ── fetch info for a single bulk item ──
  const fetchBulkInfo = (id, itemUrl) => {
    updateBulkItem(id, { loadingInfo: true, info: null, infoError: false });
    window.electron.getInfo(itemUrl)
      .then((data) => {
        updateBulkItem(id, {
          loadingInfo: false,
          info: data,
          fileName: data?.title || "",
        });
      })
      .catch(() => updateBulkItem(id, { loadingInfo: false, infoError: true }));
  };

  const updateBulkItem = (id, patch) =>
    setBulkItems(prev => prev.map(i => i.id === id ? { ...i, ...patch } : i));

  // ── add URL to bulk list ──
  const addBulkUrl = () => {
    const trimmed = bulkInput.trim();
    if (!trimmed) return;
    const id = nextId.current++;
    const newItem = makeBulkItem(id, trimmed);
    setBulkItems(prev => [...prev, newItem]);
    setBulkInput("");
    fetchBulkInfo(id, trimmed);
  };

  const removeBulkItem = (id) => setBulkItems(prev => prev.filter(i => i.id !== id));

  // ── folder ──
  const chooseFolder = async () => {
    const f = await window.electron.selectFolder();
    if (f) setFolder(f);
  };

  // ── single download ──
  const download = async () => {
    if (!url || !folder) { alert(t.alertRequired); return; }
    const startSec = timeToSeconds(start);
    const endSec = timeToSeconds(end);
    if (start && startSec === null) { alert(t.alertStart); return; }
    if (end && endSec === null) { alert(t.alertEnd); return; }
    if (startSec !== null && endSec !== null && startSec >= endSec) { alert(t.alertRange); return; }
    setDownloading(true); setProgress(0);
    await window.electron.downloadVideo({ url, folder, start: start || null, end: end || null, format, quality, fileName, includeTag: true });
    setDownloading(false);
    alert(t.alertDone);
  };

  // ── bulk download all ──
  const downloadAll = async () => {
    if (!folder) { alert(t.alertRequired); return; }
    const items = bulkItems.filter(i => i.url.trim());
    if (!items.length) { alert(t.alertRequired); return; }
    setBulkDone(0);
    setDownloading(true);

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      updateBulkItem(item.id, { status: "downloading", progress: 0 });
      const progressHandler = (p) => updateBulkItem(item.id, { progress: p });
      window.electron?.onProgress?.(progressHandler);
      try {
        await window.electron.downloadVideo({
          url: item.url, folder, start: null, end: null,
          format, quality,
          fileName: item.fileName || "",
          includeTag: true,
        });
        updateBulkItem(item.id, { status: "done", progress: 100 });
      } catch {
        updateBulkItem(item.id, { status: "error", progress: 0 });
      } finally {
        window.electron?.removeProgress?.(progressHandler);
        setBulkDone(d => d + 1);
      }
    }

    setDownloading(false);
    setBulkItems([]);
    setBulkDone(0);
    alert(t.alertAllDone);
  };

  // ─────────────────────────── render ───────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-900 to-black text-white p-6 flex flex-col">

      {/* HEADER */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <img src={logo} className="w-12 h-12 rounded-xl" alt="logo" />
          <div>
            <h1 className="text-2xl font-bold">{t.title}</h1>
            <p className="text-xs text-gray-400">{t.subtitle}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Mode Toggle */}
          <div className="flex bg-zinc-800 border border-zinc-600 rounded-lg overflow-hidden">
            <button
              onClick={() => setMode("single")}
              className={`px-4 py-1.5 text-sm transition-colors ${mode === "single" ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white"}`}
            >
              {t.singleMode}
            </button>
            <button
              onClick={() => setMode("bulk")}
              className={`px-4 py-1.5 text-sm transition-colors ${mode === "bulk" ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white"}`}
            >
              {t.bulkMode}
            </button>
          </div>

          {/* Language */}
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value)}
            className="bg-zinc-800 border border-zinc-600 px-3 py-1 rounded-lg"
          >
            <option value="tr">TR</option>
            <option value="en">EN</option>
          </select>
        </div>
      </div>

      {/* MAIN */}
      <div className="max-w-3xl mx-auto w-full flex-1">

        {/* ══════════ SINGLE MODE ══════════ */}
        {mode === "single" && (
          <>
            <input
              className="border border-zinc-600 bg-zinc-800 p-3 w-full mb-4 rounded-xl"
              placeholder={t.urlPlaceholder}
              value={url}
              onChange={(e) => { setUrl(e.target.value); setFileName(""); }}
            />

            {loadingInfo && (
              <div className="flex items-center gap-3 bg-zinc-800 border border-zinc-700 p-3 rounded-xl mb-4 animate-pulse">
                <svg className="w-5 h-5 text-blue-400 animate-spin shrink-0" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
                <p className="text-sm text-blue-300">{t.loadingInfo}</p>
              </div>
            )}

            {infoError && !loadingInfo && (
              <div className="bg-red-900/40 border border-red-700 p-3 rounded-xl mb-4 text-sm text-red-300">
                ⚠️ {t.infoError}
              </div>
            )}

            {videoId && (
              <iframe
                className="w-full h-64 mb-4 rounded-xl"
                src={`https://www.youtube.com/embed/${videoId}`}
                allowFullScreen
              />
            )}

            {info && (
              <div className="bg-zinc-800 p-3 rounded-xl mb-4">
                <p className="text-sm font-semibold">{info.title}</p>
                <div className="text-xs text-gray-400 mt-1 flex gap-3">
                  <span>👤 {info.uploader}</span>
                  <span>⏱ {fmtDuration(info.duration)}</span>
                </div>
              </div>
            )}

            <div className="mb-4 grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-400">{t.start}</label>
                <input className="w-full p-2 rounded-lg bg-zinc-800 border border-zinc-600" value={start} onChange={(e) => setStart(e.target.value)} placeholder="00:30" />
              </div>
              <div>
                <label className="text-xs text-gray-400">{t.end}</label>
                <input className="w-full p-2 rounded-lg bg-zinc-800 border border-zinc-600" value={end} onChange={(e) => setEnd(e.target.value)} placeholder="01:10" />
              </div>
            </div>

            <input
              className="border border-zinc-600 bg-zinc-800 p-3 w-full mb-4 rounded-xl"
              placeholder={t.filename}
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
            />
          </>
        )}

        {/* ══════════ BULK MODE ══════════ */}
        {mode === "bulk" && (
          <>
            <p className="text-xs text-gray-400 mb-3">{t.bulkHint}</p>

            {/* Add URL row */}
            <div className="flex gap-2 mb-4">
              <input
                className="flex-1 border border-zinc-600 bg-zinc-800 p-3 rounded-xl"
                placeholder={t.bulkPlaceholder}
                value={bulkInput}
                onChange={(e) => setBulkInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addBulkUrl()}
                disabled={downloading}
              />
              <button
                onClick={addBulkUrl}
                disabled={downloading}
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-5 rounded-xl font-semibold transition-colors"
              >
                + {t.addUrl}
              </button>
            </div>

            {/* URL List */}
            <div className="flex flex-col gap-3 mb-4">
              {bulkItems.map((item) => (
                <div
                  key={item.id}
                  className="bg-zinc-800 border border-zinc-700 rounded-xl p-3 flex flex-col gap-2"
                >
                  {/* Row 1: URL + status icon + remove */}
                  <div className="flex items-center gap-2">
                    <span className="text-lg shrink-0">
                      {item.status === "idle" && "🔗"}
                      {item.status === "downloading" && "⏬"}
                      {item.status === "done" && "✅"}
                      {item.status === "error" && "❌"}
                    </span>
                    <span className="text-xs text-gray-500 truncate flex-1">{item.url}</span>
                    {item.status === "idle" && (
                      <button
                        onClick={() => removeBulkItem(item.id)}
                        className="text-xs text-red-400 hover:text-red-300 shrink-0 ml-1"
                      >
                        {t.removeUrl}
                      </button>
                    )}
                  </div>

                  {/* Loading state */}
                  {item.loadingInfo && (
                    <div className="flex items-center gap-2 animate-pulse">
                      <svg className="w-4 h-4 text-blue-400 animate-spin shrink-0" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                      </svg>
                      <p className="text-xs text-blue-300">{t.loadingInfo}</p>
                    </div>
                  )}

                  {/* Info error */}
                  {item.infoError && !item.loadingInfo && (
                    <p className="text-xs text-red-400">⚠️ {t.infoError}</p>
                  )}

                  {/* Video info card */}
                  {item.info && !item.loadingInfo && (
                    <div className="flex items-center gap-3 bg-zinc-700/50 rounded-lg p-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.info.title}</p>
                        <div className="text-xs text-gray-400 mt-0.5 flex gap-3">
                          <span>👤 {item.info.uploader}</span>
                          <span>⏱ {fmtDuration(item.info.duration)}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Filename input (only when info loaded and not yet downloading/done) */}
                  {item.info && item.status === "idle" && (
                    <input
                      className="w-full text-sm p-2 rounded-lg bg-zinc-900 border border-zinc-600 text-gray-200 placeholder-gray-500"
                      placeholder={t.filenamePlaceholder}
                      value={item.fileName}
                      onChange={(e) => updateBulkItem(item.id, { fileName: e.target.value })}
                    />
                  )}

                  {/* Per-item progress bar */}
                  {item.status === "downloading" && (
                    <div className="w-full bg-zinc-700 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-blue-500 h-full transition-all duration-200"
                        style={{ width: `${item.progress}%` }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Bulk progress summary */}
            {downloading && bulkItems.length > 0 && (
              <p className="text-xs text-gray-400 mb-2">
                {t.bulkStatus(bulkDone, bulkItems.filter(i => i.url.trim()).length)}
              </p>
            )}
          </>
        )}

        {/* ══════════ SHARED: FORMAT + QUALITY ══════════ */}
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

        {/* ══════════ SHARED: FOLDER + DOWNLOAD BUTTON ══════════ */}
        <div className="flex gap-3 items-center mb-4">
          <button
            onClick={chooseFolder}
            className="bg-zinc-700 hover:bg-zinc-600 px-4 py-2 rounded-xl transition-colors"
          >
            {t.folder}
          </button>
          <span className="text-xs text-gray-400 truncate">{folder}</span>
        </div>

        <button
          onClick={mode === "single" ? download : downloadAll}
          disabled={downloading}
          className="w-full bg-blue-600 hover:bg-blue-500 py-3 rounded-xl font-semibold disabled:opacity-50 transition-colors"
        >
          {downloading ? t.downloading : (mode === "single" ? t.download : t.downloadAll)}
        </button>

        {mode === "single" && downloading && (
          <div className="mt-4">
            <div className="w-full bg-zinc-700 rounded-full h-4 overflow-hidden">
              <div className="bg-blue-500 h-full transition-all duration-200" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-xs text-gray-400 mt-1">{progress.toFixed(1)}%</p>
          </div>
        )}
      </div>

      {/* FOOTER */}
      <div className="text-center text-xs text-gray-500 mt-6">
        Made by Yusuf Emre Muştu 🚀
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
