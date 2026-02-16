import { useState } from "react";

function getVideoId(url) {
  const regExp = /(?:v=|youtu\.be\/)([^&]+)/;
  const match = url.match(regExp);
  return match ? match[1] : null;
}

export default function App() {
  const [url, setUrl] = useState("");
  const [folder, setFolder] = useState("");
  const [start, setStart] = useState("00:00");
  const [end, setEnd] = useState("00:30");
  const [format, setFormat] = useState("mp3");
  const [quality, setQuality] = useState("best");

  const videoId = getVideoId(url);

  const chooseFolder = async () => {
    const f = await window.electron.selectFolder();
    if (f) setFolder(f);
  };

  const download = async () => {
    if (!url || !folder) {
      alert("URL ve klasör gerekli");
      return;
    }

    await window.electron.downloadVideo({
      url,
      folder,
      start,
      end,
      format,
      quality,
    });

    alert("İndirme tamamlandı");
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Penguverter 🎵</h1>

      <input
        className="border p-2 w-full mb-3"
        placeholder="YouTube URL"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
      />

      {videoId && (
        <iframe
          className="w-full h-64 mb-4"
          src={`https://www.youtube.com/embed/${videoId}`}
          allowFullScreen
        />
      )}

      <div className="flex gap-2 mb-3">
        <input
          className="border p-2 w-1/2"
          value={start}
          onChange={(e) => setStart(e.target.value)}
          placeholder="00:00"
        />
        <input
          className="border p-2 w-1/2"
          value={end}
          onChange={(e) => setEnd(e.target.value)}
          placeholder="01:00"
        />
      </div>

      <div className="flex gap-2 mb-3">
        <select
          className="border p-2"
          value={format}
          onChange={(e) => setFormat(e.target.value)}
        >
          <option value="mp3">MP3</option>
          <option value="mp4">MP4</option>
        </select>

        <select
          className="border p-2"
          value={quality}
          onChange={(e) => setQuality(e.target.value)}
        >
          <option value="best">Best</option>
          <option value="720">720p</option>
          <option value="480">480p</option>
        </select>
      </div>

      <button
        onClick={chooseFolder}
        className="bg-gray-500 text-white px-4 py-2 mr-2"
      >
        Klasör Seç
      </button>

      <span className="text-sm">{folder}</span>

      <br /><br />

      <button
        onClick={download}
        className="bg-blue-500 text-white px-4 py-2"
      >
        İndir
      </button>
    </div>
  );
}
