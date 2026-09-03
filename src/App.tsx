import React, { useState, useCallback, useRef, useEffect } from "react";
import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { createClient } from '@supabase/supabase-js';
import { MediaSession } from '@jofr/capacitor-media-session';

const supabaseUrl = 'https://qnognnjfxltpqqzpjtft.supabase.co';
const supabaseKey = 'sb_publishable_Y9IviI2xrMpvq6kNav3jLA_E1zYZVJv';
export const supabase = createClient(supabaseUrl, supabaseKey);

declare global {
  interface Window { 
    cordova: any; 
  }
}

type Song = { id: string; title: string; artist: string; duration: string; grad: string; artworkUrl?: string; audioUrl?: string; streamUrl?: string; ytId?: string };
type Playlist = { id: string; name: string; count: number; grad: string; desc: string; songs: Song[]; image?: string };
type Tab = "inicio" | "playlists" | "favoritos" | "artistas";
type Overlay = "genres" | "notificaciones" | "perfil" | "create_playlist" | "playlist_detail";

const SOUNDCLOUD_CLIENT_ID = "Pb72ranhoyt6gw7hM7TkzUItXlMWSNSo";

function fetchWithTimeout(url: string, timeoutMs = 10000): Promise<Response> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error("La petición tardó demasiado")), timeoutMs);
    fetch(url).then((response) => {
      window.clearTimeout(timeout);
      resolve(response);
    }).catch((error) => {
      window.clearTimeout(timeout);
      reject(error);
    });
  });
}

async function getSoundCloudJson(url: string): Promise<any> {
  if (Capacitor.isNativePlatform()) {
    const response = await CapacitorHttp.get({ url, connectTimeout: 10000, readTimeout: 10000 });
    if (response.status < 200 || response.status >= 300) throw new Error(`SoundCloud request failed: ${response.status}`);
    return response.data;
  }

  const response = await fetchWithTimeout(url);
  if (!response.ok) throw new Error(`SoundCloud request failed: ${response.status}`);
  return response.json();
}

async function searchSoundCloudAPI(query: string): Promise<Song[]> {
  const url = `https://api-v2.soundcloud.com/search/tracks?q=${encodeURIComponent(query)}&client_id=${SOUNDCLOUD_CLIENT_ID}&limit=25`;
  const data = await getSoundCloudJson(url);

  return (data.collection || []).map((track: any) => {
    const transcoding = track.media?.transcodings?.find((item: any) => item.format?.protocol === "progressive")
      || track.media?.transcodings?.[0];
    return {
      id: String(track.id),
      title: track.title,
      artist: track.user?.username || "SoundCloud",
      duration: formatTime(track.duration / 1000),
      grad: "from-zinc-800 to-black",
      artworkUrl: track.artwork_url || track.user?.avatar_url,
      streamUrl: transcoding?.url,
    };
  });
}

async function resolveSoundCloudStream(streamUrl: string): Promise<string> {
  const separator = streamUrl.includes("?") ? "&" : "?";
  const data = await getSoundCloudJson(`${streamUrl}${separator}client_id=${SOUNDCLOUD_CLIENT_ID}`);
  if (!data.url) throw new Error("SoundCloud stream URL missing");
  return data.url;
}

const formatTime = (secs: number) => {
  if (!secs || isNaN(secs)) return "0:00";
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
};

function SongImage({ song, className }: { song: Song, className?: string }) {
  if (song.artworkUrl) return <img src={song.artworkUrl} alt={song.title} loading="lazy" decoding="async" className={`object-cover ${className}`} />;
  return <div className={`${className} bg-gradient-to-br ${song.grad}`} />;
}

const EQ_BANDS = ["60Hz", "250Hz", "1kHz", "4kHz", "16kHz"];
const EQ_PRESETS: Record<string, number[]> = { "Normal": [0,0,0,0,0], "Rock": [5,3,0,3,5], "Pop": [-1,2,5,2,-1], "Bass Boost": [7,5,1,-1,-2] };
const gradients = ["from-pink-500 to-rose-500", "from-blue-500 to-cyan-500", "from-purple-500 to-indigo-500", "from-amber-500 to-orange-500"];
const placeholders = ["se que piensas...", "dale play!", "destronado", "mikumikumiku", "buscar temazo..."];

const UPDATE_MANIFEST_URL = "https://raw.githubusercontent.com/snackylovesyou/mamushmusic/main/update.json";
const RELEASES_URL = "https://github.com/snackylovesyou/mamushmusic/releases/latest";

function UpdateRequired({ versionName, downloadUrl }: { versionName: string; downloadUrl: string }) {
  return (
    <div className="flex min-h-full items-center justify-center bg-[#070707] px-6 text-center">
      <div className="w-full max-w-[390px] rounded-3xl bg-[#101010] p-8 shadow-2xl">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#1ed760] text-3xl text-black">!</div>
        <h1 className="text-2xl font-bold text-white">Actualización necesaria</h1>
        <p className="mt-3 text-sm text-[#aaa]">Hay una versión nueva de Snacky Music. Actualiza para continuar.</p>
        <button onClick={() => window.open(downloadUrl || RELEASES_URL, "_blank")} className="mt-6 w-full rounded-full bg-[#1ed760] py-4 font-bold text-black btn-interactive">
          Descargar versión {versionName}
        </button>
      </div>
    </div>
  );
}

function ShuffleIcon({ className = "w-5 h-5" }: { className?: string }) { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={className}><polyline points="16 3 21 3 21 8" /><line x1="4" y1="20" x2="21" y2="3" /><polyline points="21 16 21 21 16 21" /><line x1="4" y1="4" x2="9" y2="9" /></svg>; }
function RepeatIcon({ className = "w-5 h-5" }: { className?: string }) { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={className}><polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 0 1 4-4h14" /><polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 0 1-4 4H3" /></svg>; }
function HeartIcon({ filled, className = "w-[18px] h-[18px]" }: { filled?: boolean; className?: string }) { return <svg viewBox="0 0 24 24" fill={filled ? "#1ed760" : "none"} stroke={filled ? "#1ed760" : "white"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>; }
function AddCircleIcon({ added, onClick, className="w-6 h-6" }: { added: boolean, onClick: () => void, className?: string }) {
  return (
    <button onClick={onClick} className={`transition-all duration-300 transform active:scale-90 ${added ? 'text-[#1ed760]' : 'text-white'}`}>
      {added ? <svg viewBox="0 0 24 24" fill="currentColor" className={className}><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
             : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>}
    </button>
  );
}
function PlaylistIcon({ className = "w-[18px] h-[18px]" }: { className?: string }) { return <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><polyline points="3 6 4 7 6 5" /><polyline points="3 12 4 13 6 11" /><polyline points="3 18 4 19 6 17" /></svg>; }
function MicIcon({ className = "w-[18px] h-[18px]" }: { className?: string }) { return <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" /></svg>; }
function PlayIcon({ className = "w-5 h-5" }: { className?: string }) { return <svg viewBox="0 0 24 24" fill="currentColor" className={className}><polygon points="5 3 19 12 5 21 5 3" /></svg>; }
function PauseIcon({ className = "w-5 h-5" }: { className?: string }) { return <svg viewBox="0 0 24 24" fill="currentColor" className={className}><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>; }
function SkipBackIcon({ className = "w-[18px] h-[18px]" }: { className?: string }) { return <svg viewBox="0 0 24 24" fill="currentColor" className={className}><polygon points="19 20 9 12 19 4 19 20" /><rect x="5" y="4" width="2" height="16" rx="1" /></svg>; }
function SkipFwdIcon({ className = "w-[18px] h-[18px]" }: { className?: string }) { return <svg viewBox="0 0 24 24" fill="currentColor" className={className}><polygon points="5 4 15 12 5 20 5 4" /><rect x="17" y="4" width="2" height="16" rx="1" /></svg>; }
function SearchIcon({ className = "w-4 h-4 flex-shrink-0" }: { className?: string }) { return <svg viewBox="0 0 24 24" fill="none" stroke="#777" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>; }
function ArrowLeftIcon({ className = "w-5 h-5" }: { className?: string }) { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={className}><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>; }
function ChevronDownIcon({ className = "w-6 h-6" }: { className?: string }) { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><polyline points="6 9 12 15 18 9" /></svg>; }
function XIcon({ className = "w-5 h-5" }: { className?: string }) { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={className}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>; }
function TrashIcon({ className = "w-4 h-4" }: { className?: string }) { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v5M14 11v5" /></svg>; }
function HomeIcon({ active, className = "w-[18px] h-[18px]" }: { active?: boolean; className?: string }) { return <svg viewBox="0 0 24 24" fill={active ? "white" : "none"} stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>; }
function PlusIcon({ className = "w-5 h-5" }: { className?: string }) { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>; }
function PencilIcon({ className = "w-5 h-5" }: { className?: string }) { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" /></svg>; }
function CameraIcon({ className = "w-5 h-5" }: { className?: string }) { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>; }
function NoteIcon({ className = "w-6 h-6" }: { className?: string }) { return <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>; }
function ZapIcon({ className = "w-6 h-6" }: { className?: string }) { return <svg viewBox="0 0 24 24" fill="white" className={className}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>; }
function WaveformIcon({ className = "w-6 h-6" }: { className?: string }) { return <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={className}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>; }
function DiscIcon({ className = "w-6 h-6" }: { className?: string }) { return <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="3" /></svg>; }

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] font-semibold text-[#555] uppercase tracking-widest mb-3">{children}</p>;
}

const compressAndConvertImage = (file: File, callback: (base64Str: string) => void) => {
  const reader = new FileReader();
  reader.onload = (event) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const MAX_WIDTH = 200;
      const MAX_HEIGHT = 200;
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
      } else {
        if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx?.drawImage(img, 0, 0, width, height);
      callback(canvas.toDataURL("image/jpeg", 0.6));
    };
    if (event.target?.result) img.src = event.target.result as string;
  };
  reader.readAsDataURL(file);
};

function LoginScreen({ onLogin }: { onLogin: (username: string) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUser = username.trim().toLowerCase();
    const cleanPass = password.trim();
    if (!cleanUser || !cleanPass) return;

    setLoading(true);
    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('username', cleanUser)
        .single();

      if (data) {
        if (data.password === cleanPass) {
          onLogin(cleanUser);
        } else {
          setErrorMsg("Contraseña incorrecta");
        }
      } else {
        const { error: insertError } = await supabase
          .from('profiles')
          .insert([{ username: cleanUser, password: cleanPass, favorites: [], playlists: [], profile_img: null }]);
        
        if (!insertError) {
          onLogin(cleanUser);
        } else {
          setErrorMsg("Error al registrar cuenta");
        }
      }
    } catch {
      setErrorMsg("Error de conexión con la nube");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-full bg-[#070707]">
      <div className="relative w-full max-w-[390px] flex flex-col justify-center px-6 h-[100dvh] max-h-[844px] bg-[#080808] shadow-2xl">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-[#1ed760] rounded-3xl mx-auto flex items-center justify-center shadow-[0_0_30px_rgba(30,215,96,0.3)] mb-4">
            <PlayIcon className="w-10 h-10 text-black ml-1" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Snacky Music</h1>
          <p className="text-xs text-[#777] mt-2">Sincronización automática en la nube</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="glass rounded-2xl flex items-center px-4 py-3 border border-white/10 focus-within:border-[#1ed760]">
            <input type="text" placeholder="Usuario (ej. snacky)" value={username} onChange={(e) => { setUsername(e.target.value); setErrorMsg(""); }} className="bg-transparent outline-none text-sm text-white w-full placeholder-[#777]" autoFocus />
          </div>
          <div className="glass rounded-2xl flex items-center px-4 py-3 border border-white/10 focus-within:border-[#1ed760]">
            <input type="password" placeholder="Contraseña" value={password} onChange={(e) => { setPassword(e.target.value); setErrorMsg(""); }} className="bg-transparent outline-none text-sm text-white w-full placeholder-[#777]" />
          </div>
          {errorMsg && <p className="text-xs text-red-400 text-center font-semibold">{errorMsg}</p>}
          <button type="submit" disabled={loading || !username.trim() || !password.trim()} className="w-full py-4 rounded-full bg-[#1ed760] text-black font-bold text-base disabled:opacity-50 shadow-lg btn-interactive transition-transform active:scale-95 mt-2">
            {loading ? "Conectando..." : "Entrar / Registrarse"}
          </button>
        </form>
      </div>
    </div>
  );
}

function InicioContent({ openOverlay, setCurrentSong, setPlaying, userFavorites, toggleFavorite, setQueue, recentSongs, profileImg, playlists, setActivePlaylistId, currentUser, onLogout }: any) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Song[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [placeholder, setPlaceholder] = useState(placeholders[0]);

  useEffect(() => { setPlaceholder(placeholders[Math.floor(Math.random() * placeholders.length)]); }, []);

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchQuery.trim() !== '') {
      setIsSearching(true); setHasSearched(true);
      setSearchError("");
      try {
        setSearchResults(await searchSoundCloudAPI(searchQuery));
      } catch {
        setSearchResults([]);
        setSearchError("No se pudo conectar con SoundCloud. Comprueba tu conexión.");
      } finally {
        setIsSearching(false);
      }
    }
  };

  return (
    <div className="flex flex-col overflow-y-auto flex-1 pb-4 tab-enter">
      <div className="flex items-center justify-between px-4 pt-12 pb-5">
        <div>
          <p className="text-xs text-[#1ed760] font-semibold uppercase tracking-wider">@{currentUser}</p>
          <p className="text-2xl font-bold text-white tracking-tight">Snacky</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onLogout} title="Cerrar sesión" className="text-xs text-[#aaa] hover:text-white px-3 py-1.5 glass rounded-full btn-interactive">Salir</button>
          <button onClick={() => openOverlay("perfil")} className="w-9 h-9 rounded-full overflow-hidden bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center text-white font-bold text-sm border border-white/10 shadow-lg btn-interactive">
            {profileImg ? <img src={profileImg} className="w-full h-full object-cover" /> : currentUser.slice(0,2).toUpperCase()}
          </button>
        </div>
      </div>

      <div className="px-4 mb-4">
        <div className="glass rounded-2xl flex items-center gap-3 px-4 py-3 border border-white/10 focus-within:border-[#1ed760]/50 transition-colors">
          <SearchIcon />
          <input type="text" placeholder={placeholder} className="bg-transparent outline-none text-sm text-white w-full placeholder-[#777]" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={handleKeyDown} />
          {hasSearched && <button onClick={() => { setSearchQuery(""); setSearchResults([]); setHasSearched(false); }} className="text-[#777] hover:text-white p-1"><XIcon /></button>}
        </div>
      </div>

      {isSearching ? (
        <p className="text-sm text-[#777] text-center mt-8 animate-pulse">Conectando con SoundCloud...</p>
      ) : hasSearched ? (
        <section className="mb-4 px-4 flex-1">
          <SectionLabel>Resultados de la red</SectionLabel>
          {searchResults.length > 0 ? (
            <div className="space-y-2">
              {searchResults.map((s, i) => (
                <div key={i} className="glass rounded-2xl flex items-center gap-3 p-3">
                  <button onClick={() => { setQueue(searchResults); setCurrentSong(s); setPlaying(true); }} className="relative flex-shrink-0 group btn-interactive">
                    <SongImage song={s} className="w-12 h-12 rounded-xl" />
                    <div className="absolute inset-0 rounded-xl bg-black/0 group-hover:bg-black/40 flex items-center justify-center transition-colors"><PlayIcon className="w-4 h-4 opacity-0 group-hover:opacity-100" /></div>
                  </button>
                  <div className="flex-1 min-w-0"><p className="text-sm font-semibold text-white truncate">{s.title}</p><p className="text-xs text-[#777] truncate">{s.artist}</p></div>
                  <button className="p-2 btn-interactive" onClick={() => toggleFavorite(s)}><HeartIcon filled={userFavorites.some((fav:Song) => fav.id === s.id)} className="w-5 h-5" /></button>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-[#777] text-center mt-8">{searchError || "No se encontraron resultados."}</p>}
        </section>
      ) : (
        <>
          <div className="mx-4 mb-6">
            <button onClick={() => openOverlay("genres")} className="w-full glass rounded-3xl p-4 flex items-center gap-4 text-left active:scale-95 transition-transform border border-[#1ed760]/30 shadow-[0_0_15px_rgba(30,215,96,0.15)] btn-interactive">
              <div className="w-14 h-14 rounded-2xl bg-[#1ed760] flex items-center justify-center text-black flex-shrink-0"><ShuffleIcon /></div>
              <div><p className="text-sm font-bold text-white">Magia Aleatoria</p><p className="text-xs text-[#bbb] mt-0.5">Vocaloid, Regional, Trap, Rap...</p></div>
            </button>
          </div>

          {playlists.length > 0 && (
            <section className="mb-6 px-4">
              <SectionLabel>Tus Playlists</SectionLabel>
              <div className="flex gap-4 overflow-x-auto pb-4 pt-2 hide-scrollbar">
                {playlists.map((pl: Playlist) => (
                  <button key={pl.id} onClick={() => { setActivePlaylistId(pl.id); openOverlay("playlist_detail"); }} className="flex flex-col items-center gap-2 flex-shrink-0 w-24 btn-interactive">
                    <div className={`w-24 h-24 rounded-2xl ${!pl.image ? `bg-gradient-to-br ${pl.grad}` : 'bg-black'} overflow-hidden relative shadow-lg`}>
                      {pl.image ? <img src={pl.image} className="w-full h-full object-cover" /> : (pl.songs.length > 0 && <SongImage song={pl.songs[0]} className="w-full h-full opacity-60 mix-blend-overlay" />)}
                    </div>
                    <p className="text-xs text-white font-medium text-center w-full truncate">{pl.name}</p>
                  </button>
                ))}
              </div>
            </section>
          )}
          
          {recentSongs.length > 0 && (
            <section className="mb-6 px-4">
              <SectionLabel>Escuchado recientemente</SectionLabel>
              <div className="space-y-2">
                {recentSongs.slice(0, 5).map((s: Song, i: number) => (
                  <div key={i} className="glass rounded-2xl flex items-center gap-3 p-3">
                    <button onClick={() => { setQueue(recentSongs); setCurrentSong(s); setPlaying(true); }} className="relative flex-shrink-0 group btn-interactive">
                      <SongImage song={s} className="w-10 h-10 rounded-xl" />
                      <div className="absolute inset-0 rounded-xl bg-black/0 group-hover:bg-black/40 flex items-center justify-center transition-colors"><PlayIcon className="w-4 h-4 opacity-0 group-hover:opacity-100" /></div>
                    </button>
                    <div className="flex-1 min-w-0"><p className="text-sm font-semibold text-white truncate">{s.title}</p><p className="text-xs text-[#777] truncate">{s.artist}</p></div>
                    <button className="p-2 btn-interactive" onClick={() => toggleFavorite(s)}><HeartIcon filled={userFavorites.some((fav:Song) => fav.id === s.id)} className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function GenresScreen({ onClose, setQueue, setCurrentSong, setPlaying }: any) {
  const [loadingGenre, setLoadingGenre] = useState<string | null>(null);

  const genres = [
    { id: "vocaloid", name: "Vocaloid", icon: <NoteIcon />, grad: "from-teal-400 to-cyan-500", query: "vocaloid official song" },
    { id: "regional", name: "Regional Mexicano", icon: <DiscIcon />, grad: "from-amber-500 to-orange-600", query: "regional mexicano exitos" },
    { id: "corridos", name: "Corridos", icon: <ZapIcon />, grad: "from-red-600 to-amber-500", query: "corridos tumbados exitos" },
    { id: "trap", name: "Trap", icon: <WaveformIcon />, grad: "from-purple-600 to-pink-600", query: "latin trap hits" },
    { id: "rap", name: "Rap", icon: <MicIcon />, grad: "from-blue-600 to-indigo-800", query: "spanish rap hits" },
  ];

  const handleGenreClick = async (genre: any) => {
    setLoadingGenre(genre.id);
    let results: Song[] = [];
    try {
      results = await searchSoundCloudAPI(genre.query);
    } finally {
      setLoadingGenre(null);
    }
    if (results.length > 0) {
      const randomSong = results[Math.floor(Math.random() * results.length)];
      setQueue(results); setCurrentSong(randomSong); setPlaying(true); onClose();
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#080808] screen-enter">
      <header className="flex items-center gap-3 px-4 pt-12 pb-4">
        <button onClick={onClose} className="glass w-10 h-10 rounded-xl flex items-center justify-center text-white btn-interactive"><ArrowLeftIcon /></button>
        <div className="flex-1"><p className="text-lg font-bold text-white">Magia Aleatoria</p><p className="text-xs text-[#1ed760]">Elige tu género favorito</p></div>
      </header>
      <div className="flex-1 overflow-y-auto px-4 pb-6">
        <div className="grid grid-cols-2 gap-3">
          {genres.map((genre, i) => (
            <button key={genre.id} onClick={() => handleGenreClick(genre)} className="glass rounded-3xl overflow-hidden text-left relative h-32 btn-interactive" style={{ animationDelay: `${i * 48}ms` }}>
              <div className={`absolute inset-0 bg-gradient-to-br ${genre.grad} opacity-30`} />
              <div className="relative p-4 flex flex-col h-full justify-between">
                <div className="opacity-90">{loadingGenre === genre.id ? <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"/> : genre.icon}</div>
                <p className="text-sm font-bold text-white">{genre.name}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function PlaylistsContent({ playlists, openOverlay, setActivePlaylistId, setEditPlaylistId }: any) {
  return (
    <div className="flex flex-col overflow-y-auto flex-1 pb-4 tab-enter">
      <div className="px-4 pt-12 pb-5 flex justify-between items-center">
        <div><p className="text-2xl font-bold text-white tracking-tight">Tu biblioteca</p><p className="text-xs text-[#555] mt-1">{playlists.length} playlists</p></div>
        <button onClick={() => { setEditPlaylistId(null); openOverlay("create_playlist"); }} className="w-10 h-10 glass rounded-full flex items-center justify-center text-white shadow-lg btn-interactive"><PlusIcon /></button>
      </div>
      <div className="px-4 grid grid-cols-2 gap-3 pb-4">
        {playlists.map((pl: Playlist, i: number) => (
          <button key={i} onClick={() => { setActivePlaylistId(pl.id); openOverlay("playlist_detail"); }} className="glass rounded-3xl overflow-hidden text-left relative group btn-interactive">
            <div className={`w-full aspect-square ${!pl.image ? `bg-gradient-to-br ${pl.grad}` : 'bg-black'} flex items-end relative overflow-hidden`}>
              {pl.image ? <img src={pl.image} className="absolute inset-0 w-full h-full object-cover" /> : (pl.songs.length > 0 && <SongImage song={pl.songs[0]} className="absolute inset-0 w-full h-full opacity-60 mix-blend-overlay" />)}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
            </div>
            <div className="absolute bottom-0 w-full p-3">
              <p className="text-sm font-bold text-white truncate">{pl.name}</p>
              <p className="text-xs text-[#ccc] mt-0.5">{pl.songs.length} canciones</p>
            </div>
          </button>
        ))}
        {playlists.length === 0 && (
          <div className="col-span-2 text-center py-10 opacity-50"><PlaylistIcon className="w-10 h-10 mx-auto mb-3" /><p className="text-sm text-white">No tienes playlists</p></div>
        )}
      </div>
    </div>
  );
}

function FavoritosContent({ setCurrentSong, setPlaying, userFavorites, toggleFavorite, setQueue }: any) {
  return (
    <div className="flex flex-col overflow-y-auto flex-1 pb-4 tab-enter">
      <div className="px-4 pt-12 pb-3"><p className="text-2xl font-bold text-white tracking-tight">Canciones que te gustan</p><p className="text-xs text-[#555] mt-1">{userFavorites.length} canciones</p></div>
      {userFavorites.length > 0 ? (
        <>
          <div className="px-4 mb-4">
            <button onClick={() => { setQueue(userFavorites); setCurrentSong(userFavorites[Math.floor(Math.random() * userFavorites.length)]); setPlaying(true); }} className="w-full glass rounded-2xl py-3 flex items-center justify-center gap-2 text-[#1ed760] font-semibold text-sm btn-interactive">
              <ShuffleIcon className="w-4 h-4" /> Reproducir aleatorio
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 space-y-2">
            {userFavorites.map((s: Song, i: number) => (
              <div key={i} className="glass rounded-2xl flex items-center gap-3 p-3">
                <button onClick={() => { setQueue(userFavorites); setCurrentSong(s); setPlaying(true); }} className="relative flex-shrink-0 group btn-interactive">
                  <SongImage song={s} className="w-12 h-12 rounded-xl" />
                  <div className="absolute inset-0 rounded-xl bg-black/0 group-hover:bg-black/40 flex items-center justify-center transition-colors"><PlayIcon className="w-4 h-4 opacity-0 group-hover:opacity-100" /></div>
                </button>
                <div className="flex-1 min-w-0"><p className="text-sm font-semibold text-white truncate">{s.title}</p><p className="text-xs text-[#777] truncate">{s.artist}</p></div>
                <button className="p-1 btn-interactive" onClick={() => toggleFavorite(s)}><HeartIcon filled={true} className="w-4 h-4" /></button>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center flex-1 opacity-50"><HeartIcon filled={false} className="w-12 h-12 mb-4" /><p className="text-sm text-white">Aún no tienes favoritos.</p></div>
      )}
    </div>
  );
}

function ArtistasContent({ userFavorites, recentSongs }: any) {
  const favArtists = Array.from(new Set(userFavorites.map((s: Song) => s.artist))).slice(0, 15);
  const recArtists = Array.from(new Set(recentSongs.map((s: Song) => s.artist))).slice(0, 10);
  
  return (
    <div className="flex flex-col overflow-y-auto flex-1 pb-4 tab-enter">
      <div className="px-4 pt-12 pb-5"><p className="text-2xl font-bold text-white tracking-tight">Tus artistas</p><p className="text-xs text-[#555] mt-1">Basado en tus gustos y actividad</p></div>
      
      {favArtists.length > 0 && (
        <div className="px-4 mb-6">
          <SectionLabel>Tus favoritos</SectionLabel>
          <div className="flex gap-4 overflow-x-auto pb-4 pt-2 hide-scrollbar">
            {favArtists.map((artist: any, i: number) => {
              const initials = artist.split(" ").map((w:string) => w[0]).join("").slice(0,2).toUpperCase();
              return (
                <div key={i} className="flex flex-col items-center gap-2 flex-shrink-0">
                  <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${gradients[i % gradients.length]} flex items-center justify-center shadow-lg`}><span className="text-white font-bold text-base">{initials}</span></div>
                  <p className="text-[10px] text-[#999] text-center w-16 truncate">{artist}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {recArtists.length > 0 && (
        <div className="px-4 mb-4">
          <SectionLabel>Escuchados recientemente</SectionLabel>
          <div className="grid grid-cols-3 gap-4 mt-3">
            {recArtists.map((artist: any, i: number) => {
              const initials = artist.split(" ").map((w:string) => w[0]).join("").slice(0,2).toUpperCase();
              return (
                <div key={i} className="flex flex-col items-center gap-2">
                  <div className={`w-20 h-20 rounded-full bg-gradient-to-br ${gradients[(i+2) % gradients.length]} flex items-center justify-center shadow-lg opacity-80`}><span className="text-white font-bold text-lg">{initials}</span></div>
                  <p className="text-[11px] text-[#999] text-center w-full truncate">{artist}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function CreatePlaylistScreen({ onClose, onSave, playlists, editPlaylistId }: any) {
  const isEditing = editPlaylistId !== null;
  const targetPl = isEditing ? playlists.find((p:Playlist) => p.id === editPlaylistId) : null;
  const [name, setName] = useState(targetPl?.name || "");
  const [desc, setDesc] = useState(targetPl?.desc || "");
  const [image, setImage] = useState<string | null>(targetPl?.image || null);
  const fileInputRefReal = useRef<HTMLInputElement>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      compressAndConvertImage(e.target.files[0], (base64Str) => { setImage(base64Str); });
    }
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto px-4 pt-12 pb-4 bg-[#080808] screen-enter">
      <div className="flex justify-between items-center mb-6">
        <p className="text-xl font-bold text-white">{isEditing ? "Editar Playlist" : "Crear Playlist"}</p>
        <button onClick={onClose} className="p-2 text-[#aaa] btn-interactive"><XIcon /></button>
      </div>
      <div className="flex justify-center mb-8">
        <div className="relative w-32 h-32 rounded-2xl glass-dark flex items-center justify-center cursor-pointer group shadow-xl overflow-hidden btn-interactive" onClick={() => fileInputRefReal.current?.click()}>
          {image ? <img src={image} className="w-full h-full object-cover" /> : <CameraIcon className="w-8 h-8 text-[#555]" />}
          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-all">
            <CameraIcon className="w-6 h-6 text-white mb-1" /><span className="text-[10px] font-bold text-white">Elegir foto</span>
          </div>
          <input type="file" ref={fileInputRefReal} hidden accept="image/*" onChange={handleImageChange} />
        </div>
      </div>
      <input type="text" placeholder="Nombre de la playlist" value={name} onChange={e => setName(e.target.value)} className="w-full bg-transparent border-b border-white/20 text-white text-lg py-2 outline-none mb-6 focus:border-[#1ed760] transition-colors" autoFocus />
      <input type="text" placeholder="Descripción (opcional)" value={desc} onChange={e => setDesc(e.target.value)} className="w-full bg-transparent border-b border-white/20 text-[#aaa] text-sm py-2 outline-none mb-10 focus:border-[#1ed760] transition-colors" />
      <button onClick={() => onSave(name, desc, image)} disabled={!name.trim()} className="w-full py-4 rounded-full bg-[#1ed760] text-black font-bold text-base disabled:opacity-50 mt-auto shadow-lg btn-interactive">Guardar Playlist</button>
    </div>
  );
}

function PlaylistDetailScreen({ playlist, onClose, openOverlay, setEditPlaylistId, setPlaylists, setQueue, setCurrentSong, setPlaying, userFavorites }: any) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Song[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  if (!playlist) return null;

  const handleSearch = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && search.trim() !== '') {
      setIsSearching(true);
      try {
        setResults(await searchSoundCloudAPI(search));
      } catch {
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }
  };

  const addSongToPlaylist = (song: Song) => {
    if (playlist.songs.some((s:Song) => s.id === song.id)) return;
    setPlaylists((prev: Playlist[]) => prev.map(p => p.id === playlist.id ? { ...p, songs: [...p.songs, song] } : p));
  };

  const isSongInPlaylist = (song: Song) => playlist.songs.some((s:Song) => s.id === song.id);

  const removeSongFromPlaylist = (songId: string) => {
    setPlaylists((prev: Playlist[]) => prev.map(p => p.id === playlist.id
      ? { ...p, songs: p.songs.filter(song => song.id !== songId) }
      : p));
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto pb-24 bg-[#080808] screen-enter">
      <div className={`pt-12 pb-6 px-4 relative ${!playlist.image ? `bg-gradient-to-br ${playlist.grad}` : ''}`}>
        {playlist.image && <img src={playlist.image} className="absolute inset-0 w-full h-full object-cover" />}
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/60 to-[#080808]" />
        <button onClick={onClose} className="relative z-10 w-10 h-10 glass rounded-full flex items-center justify-center text-white mb-6 btn-interactive"><ArrowLeftIcon /></button>
        <div className="relative z-10 flex items-center justify-between mb-1">
          <p className="text-3xl font-bold text-white truncate pr-2">{playlist.name}</p>
          <button onClick={() => { setEditPlaylistId(playlist.id); openOverlay("create_playlist"); }} className="p-2 text-white/70 hover:text-white btn-interactive"><PencilIcon /></button>
        </div>
        <p className="relative z-10 text-sm text-[#ccc] mb-4">{playlist.desc || "Sin descripción"}</p>
        <div className="relative z-10 flex gap-3">
          <button onClick={() => { if(playlist.songs.length > 0) { setQueue(playlist.songs); setCurrentSong(playlist.songs[0]); setPlaying(true); } }} className="bg-[#1ed760] text-black w-14 h-14 rounded-full flex items-center justify-center shadow-lg btn-interactive"><PlayIcon className="w-7 h-7 ml-1" /></button>
        </div>
      </div>
      
      <div className="flex-1 px-4 py-4 space-y-2">
        {playlist.songs.map((s: Song, i: number) => (
          <div key={i} className="glass rounded-2xl flex items-center gap-3 p-3">
            <button onClick={() => { setQueue(playlist.songs); setCurrentSong(s); setPlaying(true); }} className="relative flex-shrink-0 group btn-interactive">
              <SongImage song={s} className="w-12 h-12 rounded-xl" />
              <div className="absolute inset-0 rounded-xl bg-black/0 group-hover:bg-black/40 flex items-center justify-center"><PlayIcon className="w-4 h-4 opacity-0 group-hover:opacity-100" /></div>
            </button>
            <div className="flex-1 min-w-0"><p className="text-sm font-semibold text-white truncate">{s.title}</p><p className="text-xs text-[#777] truncate">{s.artist}</p></div>
            <button onClick={() => removeSongFromPlaylist(s.id)} title="Eliminar de la playlist" aria-label={`Eliminar ${s.title} de la playlist`} className="p-2 text-[#777] hover:text-red-400 btn-interactive">
              <TrashIcon />
            </button>
          </div>
        ))}

        <div className="mt-8 mb-4 border-t border-white/10 pt-6">
          <p className="text-sm font-bold text-white mb-3">Buscar en SoundCloud</p>
          <div className="glass rounded-2xl flex items-center gap-3 px-4 py-3 border border-white/10 mb-4 focus-within:border-[#1ed760]/50 transition-colors">
            <SearchIcon />
            <input type="text" placeholder="Escribe y presiona Enter..." className="bg-transparent outline-none text-sm text-white w-full placeholder-[#777]" value={search} onChange={e => setSearch(e.target.value)} onKeyDown={handleSearch} />
          </div>
          {isSearching && <p className="text-xs text-[#777] text-center animate-pulse">Buscando...</p>}
          <div className="space-y-2 mb-6">
            {results.map((s, i) => (
              <div key={i} className="glass rounded-2xl flex items-center gap-3 p-3">
                <SongImage song={s} className="w-10 h-10 rounded-lg flex-shrink-0" />
                <div className="flex-1 min-w-0"><p className="text-sm font-semibold text-white truncate">{s.title}</p><p className="text-xs text-[#777] truncate">{s.artist}</p></div>
                <AddCircleIcon added={isSongInPlaylist(s)} onClick={() => addSongToPlaylist(s)} />
              </div>
            ))}
          </div>

          {userFavorites.length > 0 && (
            <>
              <p className="text-sm font-bold text-white mb-3">Sugerencias de tus Favoritos</p>
              <div className="space-y-2">
                {userFavorites.map((s: Song, i: number) => (
                  <div key={i} className="glass rounded-2xl flex items-center gap-3 p-3">
                    <SongImage song={s} className="w-10 h-10 rounded-lg flex-shrink-0" />
                    <div className="flex-1 min-w-0"><p className="text-sm font-semibold text-white truncate">{s.title}</p><p className="text-xs text-[#777] truncate">{s.artist}</p></div>
                    <AddCircleIcon added={isSongInPlaylist(s)} onClick={() => addSongToPlaylist(s)} />
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function FullScreenPlayer({ currentSong, playing, setPlaying, isRepeat, setIsRepeat, isShuffle, setIsShuffle, handleNext, handlePrev, currentTime, duration, handleSeek, isFullScreen, setIsFullScreen, userFavorites, toggleFavorite }: any) {
  if (!currentSong) return null;
  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;
  const isFav = userFavorites.some((fav: Song) => fav.id === currentSong.id);

  return (
    <div className={`fixed inset-0 bg-[#080808] z-[80] flex flex-col transition-transform duration-500 ${isFullScreen ? 'translate-y-0' : 'translate-y-full'}`}>
      <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent pointer-events-none" />
      
      <div className="flex items-center justify-between px-6 pt-12 pb-6 relative z-10">
        <button onClick={() => setIsFullScreen(false)} className="p-2 text-white btn-interactive"><ChevronDownIcon /></button>
        <p className="text-xs font-semibold uppercase tracking-widest text-[#777]">SoundCloud</p>
        <div className="w-10" />
      </div>

      <div className="flex-1 flex flex-col justify-center px-8 pb-12 relative z-10">
        <div className="w-full aspect-square rounded-3xl shadow-2xl mb-10 overflow-hidden relative bg-black/40 flex flex-col items-center justify-center">
          <SongImage song={currentSong} className="w-full h-full" />
        </div>

        <div className="flex items-center justify-between mb-6">
          <div className="flex-1 min-w-0 pr-4">
            <p className="text-2xl font-bold text-white truncate mb-1">{currentSong.title}</p>
            <p className="text-base text-[#aaa] truncate">{currentSong.artist}</p>
          </div>
          <button className="p-2 btn-interactive" onClick={() => toggleFavorite(currentSong)}>
            <HeartIcon filled={isFav} className="w-6 h-6" />
          </button>
        </div>

        <div className="mb-6">
          <div className="h-1.5 rounded-full bg-white/20 cursor-pointer relative" onClick={handleSeek}>
            <div className="h-full bg-white rounded-full relative pointer-events-none" style={{ width: `${progressPct}%` }}>
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow" />
            </div>
          </div>
          <div className="flex justify-between text-[11px] text-[#aaa] mt-2">
            <span>{formatTime(currentTime)}</span><span>{formatTime(duration)}</span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <button className="p-2 relative btn-interactive" onClick={() => setIsRepeat(!isRepeat)}>
            <RepeatIcon className={`w-6 h-6 ${isRepeat ? 'text-[#1ed760]' : 'text-white'}`} />
            {isRepeat && <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-[#1ed760] rounded-full" />}
          </button>
          <button className="text-white btn-interactive" onClick={handlePrev}><SkipBackIcon className="w-8 h-8" /></button>
          <button onClick={() => setPlaying(!playing)} className="w-16 h-16 rounded-full bg-white flex items-center justify-center text-black btn-interactive">
            {playing ? <PauseIcon className="w-8 h-8" /> : <PlayIcon className="w-8 h-8 ml-1" />}
          </button>
          <button className="text-white btn-interactive" onClick={handleNext}><SkipFwdIcon className="w-8 h-8" /></button>
          <button className="p-2 relative btn-interactive" onClick={() => setIsShuffle(!isShuffle)}>
            <ShuffleIcon className={`w-6 h-6 ${isShuffle ? 'text-[#1ed760]' : 'text-white'}`} />
            {isShuffle && <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-[#1ed760] rounded-full" />}
          </button>
        </div>
      </div>
    </div>
  );
}

function PlayerBar({ currentSong, playing, setPlaying, currentTime, duration, setIsFullScreen, handleNext, handlePrev, userFavorites, toggleFavorite }: any) {
  if (!currentSong) return null;
  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;
  const isFav = userFavorites.some((fav: Song) => fav.id === currentSong.id);

  return (
    <div className="px-3 pb-2 relative z-[60]">
      <div className="glass-dark rounded-3xl px-4 py-3 relative overflow-hidden transition-all duration-300 cursor-pointer btn-interactive shadow-lg" onClick={() => setIsFullScreen(true)}>
        <div className="flex items-center gap-3 mb-2">
          <SongImage song={currentSong} className="w-10 h-10 rounded-xl" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">{currentSong.title}</p>
            <p className="text-xs text-[#777] truncate">{currentSong.artist}</p>
          </div>
          
          <button className="p-1.5 btn-interactive" onClick={(e) => { e.stopPropagation(); toggleFavorite(currentSong); }}>
            <HeartIcon filled={isFav} className="w-4 h-4" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); handlePrev(); }} className="text-white/70 hover:text-white p-1 btn-interactive">
            <SkipBackIcon />
          </button>
          <button onClick={(e) => { e.stopPropagation(); setPlaying(!playing); }} className="w-9 h-9 flex items-center justify-center text-white rounded-full bg-white/10 btn-interactive">
            {playing ? <PauseIcon className="w-4 h-4" /> : <PlayIcon className="w-4 h-4 ml-0.5" />}
          </button>
          <button onClick={(e) => { e.stopPropagation(); handleNext(); }} className="text-white/70 hover:text-white p-1 btn-interactive">
            <SkipFwdIcon />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] text-[#555] w-6 text-right">{formatTime(currentTime)}</span>
          <div className="flex-1 h-1 rounded-full bg-white/10 relative pointer-events-none">
            <div className="h-full rounded-full bg-white" style={{ width: `${progressPct}%` }} />
          </div>
          <span className="text-[10px] text-[#555] w-6">{formatTime(duration)}</span>
        </div>
      </div>
    </div>
  );
}

function PerfilScreen({ onClose, profileImg, setProfileImg, currentUser, onLogout }: any) {
  const [activePreset, setActivePreset] = useState("Normal");
  const [eqValues, setEqValues] = useState([0, 0, 0, 0, 0]);
  const fileInputRefReal = useRef<HTMLInputElement>(null);

  const selectPreset = (preset: string) => { setActivePreset(preset); setEqValues(EQ_PRESETS[preset]); };

  const handleProfileImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      compressAndConvertImage(e.target.files[0], (base64Str) => { setProfileImg(base64Str); });
    }
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto px-4 pt-12 pb-8 bg-[#080808] screen-enter">
      <div className="flex justify-between items-center mb-6"><p className="text-xl font-bold text-white">Perfil</p><button onClick={onClose} className="p-2 text-[#aaa] btn-interactive"><XIcon /></button></div>
      <div className="glass rounded-3xl p-5 flex items-center gap-4 mb-6">
        <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center shadow-lg cursor-pointer group overflow-hidden btn-interactive" onClick={() => fileInputRefReal.current?.click()}>
          {profileImg ? <img src={profileImg} className="w-full h-full object-cover" /> : <span className="text-white font-bold text-xl">{currentUser.slice(0,2).toUpperCase()}</span>}
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all"><CameraIcon className="w-5 h-5 text-white" /></div>
          <input type="file" ref={fileInputRefReal} hidden accept="image/*" onChange={handleProfileImageChange} />
        </div>
        <div>
          <p className="text-base font-bold text-white">@{currentUser}</p>
          <span className="text-[11px] font-semibold text-[#1ed760] bg-[#1ed760]/10 px-2 py-0.5 rounded-full mt-1 inline-block">Sincronizado en la Nube</span>
        </div>
      </div>

      <div className="mb-6"><SectionLabel>Configuración</SectionLabel><div className="glass rounded-3xl overflow-hidden divide-y divide-white/[0.06]"><button className="w-full flex items-center justify-between px-4 py-3.5 text-left btn-interactive"><span className="text-sm text-white">Calidad de audio</span><span className="text-xs text-[#555]">Muy alta</span></button><button onClick={onLogout} className="w-full flex items-center justify-between px-4 py-3.5 text-left btn-interactive"><span className="text-sm text-red-400">Cerrar sesión</span></button></div></div>
      <div className="mb-4"><SectionLabel>Ecualizador</SectionLabel><div className="glass rounded-3xl p-4"><div className="flex flex-wrap gap-2 mb-5">{Object.keys(EQ_PRESETS).map(preset => (<button key={preset} onClick={() => selectPreset(preset)} className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 btn-interactive ${ activePreset === preset ? "bg-[#1ed760] text-black" : "glass text-[#888]" }`}>{preset}</button>))}</div><div className="flex items-end justify-around gap-2 h-32">{eqValues.map((v, i) => { const pct = ((v + 8) / 16) * 100; return (<div key={i} className="flex flex-col items-center gap-1 flex-1"><span className="text-[9px] text-[#555] h-3">{v > 0 ? `+${v}` : v !== 0 ? v : ""}</span><div className="w-full flex-1 bg-white/[0.07] rounded-full relative overflow-hidden"><div className="absolute bottom-0 w-full rounded-full transition-all duration-300" style={{ height: `${pct}%`, background: activePreset === "Normal" ? "rgba(255,255,255,0.3)" : "#1ed760" }} /></div><span className="text-[9px] text-[#444] text-center">{EQ_BANDS[i]}</span></div>); })}</div></div></div>
    </div>
  );
}

function BottomNav({ activeTab, setActiveTab }: { activeTab: Tab; setActiveTab: (t: Tab) => void }) {
  const tabs = [
    { id: "inicio", label: "Inicio", icon: (a:boolean) => <HomeIcon active={a} /> },
    { id: "playlists", label: "Playlists", icon: (a:boolean) => <PlaylistIcon className={`w-[18px] h-[18px] ${a ? "" : "opacity-40"}`} /> },
    { id: "favoritos", label: "Favoritos", icon: (a:boolean) => <HeartIcon filled={a} className={`w-[18px] h-[18px] ${a ? "" : "opacity-40"}`} /> },
    { id: "artistas", label: "Artistas", icon: (a:boolean) => <MicIcon className={`w-[18px] h-[18px] ${a ? "" : "opacity-40"}`} /> },
  ];
  return (
    <nav className="px-3 pb-8 pt-1 relative z-[60] bg-[#070707]">
      <div className="glass rounded-3xl flex items-center justify-around py-3 px-1">
        {tabs.map(({ id, label, icon }) => (
          <button key={id} onClick={() => setActiveTab(id as Tab)} className="flex flex-col items-center gap-1 px-3 btn-interactive">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 ${activeTab === id ? "bg-white/15" : ""}`}>{icon(activeTab === id)}</div>
            <span className={`text-[10px] font-medium transition-colors duration-300 ${activeTab === id ? "text-white" : "text-[#555]"}`}>{label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}

export default function App() {
  const [currentUser, setCurrentUser] = useState<string | null>(() => {
    return localStorage.getItem("snacky_active_session") || null;
  });

  const [activeTab, setActiveTab] = useState<Tab>("inicio");
  const [overlay, setOverlay] = useState<Overlay | null>(null);
  
  const [userFavorites, setUserFavorites] = useState<Song[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [recentSongs, setRecentSongs] = useState<Song[]>([]);
  const [activePlaylistId, setActivePlaylistId] = useState<string | null>(null);
  const [editPlaylistId, setEditPlaylistId] = useState<string | null>(null);
  const [profileImg, setProfileImg] = useState<string | null>(null);
  
  const [queue, setQueue] = useState<Song[]>([]);
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [playing, setPlaying] = useState(false);
  
  const [isRepeat, setIsRepeat] = useState(false);
  const [isShuffle, setIsShuffle] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);

  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [updateRequired, setUpdateRequired] = useState<{ versionName: string; downloadUrl: string } | null>(null);

  const isInitialized = useRef(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const checkForRequiredUpdate = async () => {
      try {
        const [installed, response] = await Promise.all([
          CapacitorApp.getInfo(),
          fetchWithTimeout(`${UPDATE_MANIFEST_URL}?t=${Date.now()}`),
        ]);
        if (!response.ok) return;
        const manifest = await response.json();
        const installedVersionCode = Number(installed.build || 0);
        const latestVersionCode = Number(manifest.latestVersionCode || 0);
        if (latestVersionCode > installedVersionCode) {
          setUpdateRequired({
            versionName: manifest.latestVersionName || "nueva",
            downloadUrl: manifest.downloadUrl || RELEASES_URL,
          });
        }
      } catch {
        // An update check must never prevent offline use.
      }
    };

    void checkForRequiredUpdate();
  }, []);

  useEffect(() => {
    if (currentUser) {
      isInitialized.current = false;
      supabase
        .from('profiles')
        .select('*')
        .eq('username', currentUser)
        .single()
        .then(({ data }) => {
          if (data) {
            setUserFavorites(Array.isArray(data.favorites) ? data.favorites : []);
            setPlaylists(Array.isArray(data.playlists) ? data.playlists : []);
            setProfileImg(data.profile_img || null);
          }
          isInitialized.current = true;
        });
    }
  }, [currentUser]);

  const syncToCloud = async (updatedData: { favorites?: Song[], playlists?: Playlist[], profileImg?: string | null }) => {
    if (!currentUser || !isInitialized.current) return;
    try {
      await supabase
        .from('profiles')
        .update({
          ...(updatedData.favorites !== undefined && { favorites: updatedData.favorites }),
          ...(updatedData.playlists !== undefined && { playlists: updatedData.playlists }),
          ...(updatedData.profileImg !== undefined && { profile_img: updatedData.profileImg }),
        })
        .eq('username', currentUser);
    } catch (err) {
      console.error("Error al sincronizar con Supabase:", err);
    }
  };

  useEffect(() => { syncToCloud({ favorites: userFavorites }); }, [userFavorites]);
  useEffect(() => { syncToCloud({ playlists: playlists }); }, [playlists]);
  useEffect(() => { syncToCloud({ profileImg: profileImg }); }, [profileImg]);

  const handleLogin = (username: string) => {
    localStorage.setItem("snacky_active_session", username);
    setCurrentUser(username);
  };

  const handleLogout = () => {
    localStorage.removeItem("snacky_active_session");
    setCurrentUser(null);
    setCurrentSong(null);
    setPlaying(false);
  };

  const stateRef = useRef({ queue, currentSong, isRepeat, isShuffle });
  useEffect(() => { stateRef.current = { queue, currentSong, isRepeat, isShuffle }; }, [queue, currentSong, isRepeat, isShuffle]);

  useEffect(() => { if (currentSong) setRecentSongs(prev => [currentSong, ...prev.filter(s => s.id !== currentSong.id)].slice(0, 10)); }, [currentSong]);

  const toggleFavorite = (song: Song) => { setUserFavorites(prev => prev.some(s => s.id === song.id) ? prev.filter(s => s.id !== song.id) : [...prev, song]); };

  const handleNext = useCallback(() => {
    const { queue, currentSong, isShuffle, isRepeat } = stateRef.current;
    if (queue.length === 0 || !currentSong) return;
    if (isRepeat && audioRef.current) { audioRef.current.currentTime = 0; void audioRef.current.play(); return; }
    if (isShuffle) setCurrentSong(queue[Math.floor(Math.random() * queue.length)]);
    else setCurrentSong(queue[(queue.findIndex(s => s.id === currentSong.id) + 1) % queue.length]);
    setPlaying(true);
  }, []);

  const handlePrev = useCallback(() => {
    const { queue, currentSong } = stateRef.current;
    if (queue.length === 0 || !currentSong) return;
    setCurrentSong(queue[(queue.findIndex(s => s.id === currentSong.id) - 1 + queue.length) % queue.length]);
    setPlaying(true);
  }, []);

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const newTime = ((e.clientX - r.left) / r.width) * duration;
    if (audioRef.current) { audioRef.current.currentTime = newTime; setCurrentTime(newTime); }
  };

  useEffect(() => {
    let interval: any;
    if (playing && audioRef.current) {
      interval = setInterval(() => {
        if (audioRef.current) {
          setCurrentTime(audioRef.current.currentTime);
          setDuration(audioRef.current.duration || 0);
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [playing]);

  useEffect(() => {
    if (!currentSong) {
      void MediaSession.setPlaybackState({ playbackState: "none" });
      return;
    }

    void MediaSession.setMetadata({
      title: currentSong.title,
      artist: currentSong.artist,
      album: "Snacky Music",
      artwork: currentSong.artworkUrl ? [{
        src: currentSong.artworkUrl,
        sizes: "480x360",
        type: "image/jpeg",
      }] : [],
    });
    void MediaSession.setPlaybackState({ playbackState: playing ? "playing" : "paused" });
  }, [currentSong, playing]);

  useEffect(() => {
    const actions: Array<[MediaSessionAction, (details: { seekTime?: number | null }) => void]> = [
      ["play", () => setPlaying(true)],
      ["pause", () => setPlaying(false)],
      ["nexttrack", () => handleNext()],
      ["previoustrack", () => handlePrev()],
      ["seekto", ({ seekTime }) => {
        if (typeof seekTime === "number" && audioRef.current) {
          audioRef.current.currentTime = seekTime;
          setCurrentTime(seekTime);
        }
      }],
    ];

    actions.forEach(([action, handler]) => {
      void MediaSession.setActionHandler({ action }, handler);
    });

    return () => {
      actions.forEach(([action]) => {
        void MediaSession.setActionHandler({ action }, null);
      });
    };
  }, [handleNext, handlePrev]);

  useEffect(() => {
    if (duration > 0 && currentTime >= 0 && currentTime <= duration) {
      void MediaSession.setPositionState({
        duration,
        position: currentTime,
        playbackRate: 1,
      });
    }
  }, [currentTime, duration]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    let cancelled = false;

    const loadTrack = async () => {
      if (!currentSong) {
        audio.removeAttribute("src");
        audio.load();
        return;
      }

      try {
        const audioUrl = currentSong.audioUrl || (currentSong.streamUrl ? await resolveSoundCloudStream(currentSong.streamUrl) : undefined);
        if (cancelled || !audioUrl) throw new Error("Pista sin stream reproducible");
        audio.src = audioUrl;
        audio.load();
        if (playing) await audio.play();
      } catch {
        if (!cancelled) setPlaying(false);
      }
    };

    void loadTrack();
    return () => { cancelled = true; };
  }, [currentSong?.id, currentSong?.audioUrl, currentSong?.streamUrl]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) void audio.play().catch(() => setPlaying(false));
    else audio.pause();
  }, [playing]);

  const openOverlay = useCallback((o: Overlay) => { setOverlay(o); }, []);
  const closeOverlay = useCallback(() => { setOverlay(null); }, []);

  if (updateRequired) {
    return <UpdateRequired {...updateRequired} />;
  }

  if (!currentUser) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return (
    <div className="flex items-center justify-center min-h-full bg-[#070707]">
      <div className="relative w-full max-w-[390px] flex flex-col overflow-hidden shadow-2xl" style={{ height: "100dvh", maxHeight: "844px" }}>
        <audio ref={audioRef} onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || 0)} onEnded={handleNext} />
        
        <div className="flex-1 relative overflow-hidden flex flex-col">
          <div className="absolute inset-0 z-0 pointer-events-none">
            <div className="absolute inset-0 bg-[#080808]" />
            <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 70% 50% at 85% 0%, rgba(0,120,90,0.48) 0%, transparent 65%)" }} />
          </div>

          <div key={activeTab} className="relative z-10 flex-1 overflow-hidden flex flex-col">
            {activeTab === "inicio" && <InicioContent openOverlay={openOverlay} setCurrentSong={setCurrentSong} setPlaying={setPlaying} userFavorites={userFavorites} toggleFavorite={toggleFavorite} setQueue={setQueue} recentSongs={recentSongs} profileImg={profileImg} playlists={playlists} setActivePlaylistId={setActivePlaylistId} currentUser={currentUser} onLogout={handleLogout} />}
            {activeTab === "playlists" && <PlaylistsContent playlists={playlists} openOverlay={openOverlay} setActivePlaylistId={setActivePlaylistId} setEditPlaylistId={setEditPlaylistId} />}
            {activeTab === "favoritos" && <FavoritosContent setCurrentSong={setCurrentSong} setPlaying={setPlaying} userFavorites={userFavorites} toggleFavorite={toggleFavorite} setQueue={setQueue} />}
            {activeTab === "artistas"  && <ArtistasContent userFavorites={userFavorites} recentSongs={recentSongs} />}
          </div>

          {overlay && (
            <div className="absolute inset-0 z-40 flex flex-col bg-[#080808]">
              {overlay === "perfil" && <PerfilScreen onClose={closeOverlay} profileImg={profileImg} setProfileImg={setProfileImg} currentUser={currentUser} onLogout={handleLogout} />}
              {overlay === "genres" && <GenresScreen onClose={closeOverlay} setQueue={setQueue} setCurrentSong={setCurrentSong} setPlaying={setPlaying} />}
              {overlay === "create_playlist" && <CreatePlaylistScreen onClose={closeOverlay} onSave={(n:string, d:string, i:string|null) => { if(editPlaylistId) setPlaylists(p=>p.map(pl=>pl.id===editPlaylistId?{...pl,name:n,desc:d,image:i||undefined}:pl)); else setPlaylists([...playlists,{id:Date.now().toString(),name:n,count:0,grad:gradients[playlists.length%gradients.length],desc:d,songs:[],image:i||undefined}]); closeOverlay(); setActiveTab("playlists"); }} playlists={playlists} editPlaylistId={editPlaylistId} />}
              {overlay === "playlist_detail" && <PlaylistDetailScreen onClose={closeOverlay} openOverlay={openOverlay} playlist={playlists.find(p => p.id === activePlaylistId)} setEditPlaylistId={setEditPlaylistId} setPlaylists={setPlaylists} setQueue={setQueue} setCurrentSong={setCurrentSong} setPlaying={setPlaying} userFavorites={userFavorites} />}
            </div>
          )}
        </div>

        <FullScreenPlayer isFullScreen={isFullScreen} setIsFullScreen={setIsFullScreen} currentSong={currentSong} playing={playing} setPlaying={setPlaying} isRepeat={isRepeat} setIsRepeat={setIsRepeat} isShuffle={isShuffle} setIsShuffle={setIsShuffle} handleNext={handleNext} handlePrev={handlePrev} currentTime={currentTime} duration={duration} handleSeek={handleSeek} userFavorites={userFavorites} toggleFavorite={toggleFavorite} />
        {!isFullScreen && <PlayerBar currentSong={currentSong} playing={playing} setPlaying={setPlaying} currentTime={currentTime} duration={duration} setIsFullScreen={setIsFullScreen} handleNext={handleNext} handlePrev={handlePrev} userFavorites={userFavorites} toggleFavorite={toggleFavorite} />}
        {!isFullScreen && <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />}
        
      </div>
    </div>
  );
}