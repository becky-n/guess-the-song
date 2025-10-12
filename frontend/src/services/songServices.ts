import { type Song } from "../types/song";
import axios from "axios";
import { secureRandomInt } from "../utils/secureRandom";
import { safeSetTimeoutAsync } from "../utils/safeTimers";

const API_BASE = import.meta.env.VITE_API_BASE_URL;

if (!API_BASE) {
  throw new Error("VITE_API_BASE_URL is not defined");
}
console.log("Using API base URL:", API_BASE);

export type Genre = "kpop" | "pop" | "hiphop" | "edm";
type SongDTO = {
  id: string | number;
  name: string;
  artists?: string[];
  preview_url?: string;
  image?: string;
  external_url?: string;
};

export default class SongService {
  public baseUrl: string;
  public cachedSongs: Song[] = [];
  private loadedGenre: Genre | null = null;

  private currentIndex = 0;
  private currentAudio: HTMLAudioElement | null = null;
  private multiAudios: HTMLAudioElement[] = [];
  private onTrackChange?: (song: Song, index: number) => void;
  private onMuteStateChange?: (muted: boolean) => void;

  private currentVolume: number = 0.6;
  private isMuted: boolean = false;
  private playToken = 0;

  private isAbortError = (e: unknown) =>
    !!(
      e &&
      typeof e === "object" &&
      "name" in e &&
      (e as any).name === "AbortError"
    );

  constructor() {
    this.baseUrl = `${API_BASE}/api/tracks`;
    this.cachedSongs = [];
  }

  // --- API calls ---
  async fetchRandom(genre: Genre, count = 50): Promise<Song[]> {
    const res = await axios.get(this.baseUrl, { params: { genre, count } });
    const data = res.data;

    const next = ((data.tracks ?? []) as SongDTO[]).map((track) => ({
      id: String(track.id),
      title: track.name,
      artist: track.artists?.length ? track.artists.join(", ") : "Unknown",
      previewUrl: track.preview_url ?? "",
      imageUrl: track.image ?? "",
      externalUrl: track.external_url ?? "",
    }));

    this.cachedSongs = next;
    this.loadedGenre = genre;
    console.log(`Fetched ${this.cachedSongs.length} songs for genre: ${genre}`);
    return this.cachedSongs;
  }

  async ensureGenre(genre: Genre, count = 50): Promise<void> {
    if (this.loadedGenre !== genre || this.cachedSongs.length === 0) {
      await this.fetchRandom(genre, count);
    }
  }

  async refresh(genre: Genre) {
    await axios.post(`${this.baseUrl}/refresh`, null, { params: { genre } });
    return this.fetchRandom(genre);
  }
  getCachedSongs() {
    return this.cachedSongs;
  }

  getCurrentSong(): Song | null {
    if (!this.cachedSongs.length) return null;
    return this.cachedSongs[this.currentIndex];
  }

  getNextSong(): Song | null {
    if (!this.cachedSongs.length) return null;
    const nextIndex = (this.currentIndex + 1) % this.cachedSongs.length;
    return this.cachedSongs[nextIndex];
  }

  // --- Single-song controls ---
  async playSong(index: number = this.currentIndex, genre: Genre) {
    await this.ensureGenre(genre);

    if (!this.cachedSongs.length) {
      await this.fetchRandom(genre);
    }
    if (!this.cachedSongs.length) {
      console.error("No songs available to play after fetching.");
      return;
    }

    // Cancel any in-flight plays
    const myToken = ++this.playToken;

    this.stopSong();

    this.currentIndex = index;
    const song = this.cachedSongs[this.currentIndex];
    if (!song.previewUrl) {
      console.error("No preview URL available for the selected song.");
      return;
    }

    this.currentAudio = new Audio(song.previewUrl);
    this.currentAudio.volume = this.currentVolume;
    this.currentAudio.muted = this.isMuted;

    try {
      await this.currentAudio.play();
      if (myToken !== this.playToken) return;
      this.onTrackChange?.(song, this.currentIndex);
    } catch (err) {
      if (!this.isAbortError(err)) console.error("Playback failed:", err);
    }
  }

  async playNextSong(genre: Genre) {
    await this.ensureGenre(genre);
    if (!this.cachedSongs.length) {
      console.error("No cached songs available. Fetching new songs...");
      await this.fetchRandom(genre);
    }

    if (!this.cachedSongs.length) {
      console.error("No songs available to play after fetching.");
      return;
    }
    this.currentIndex = (this.currentIndex + 1) % this.cachedSongs.length;
    await this.playSong(this.currentIndex, genre);
  }

  pauseSong() {
    this.currentAudio?.pause();
    this.multiAudios.forEach((audio) => audio.pause());
  }

  stopSong() {
    if (this.currentAudio) {
      try {
        this.currentAudio.pause();
      } catch {}
      this.currentAudio.src = "";
      this.currentAudio.load();
      this.currentAudio = null;
    }
    this.stopMultiSong();
  }

  // --- Quick snippet playback with flexible duration ---
  async playQuickSnippet(
    index: number = this.currentIndex,
    duration: number = 3
  ): Promise<void> {
    if (!this.cachedSongs.length) return;
    this.stopSong();

    this.currentIndex = index;
    const song = this.cachedSongs[this.currentIndex];
    if (!song.previewUrl) return;

    return new Promise((resolve) => {
      this.currentAudio = new Audio(song.previewUrl);
      this.currentAudio.volume = this.currentVolume;
      this.currentAudio.muted = false;
      this.isMuted = false;

      if (this.onMuteStateChange) {
        this.onMuteStateChange(false);
      }

      const handleCanPlay = () => {
        this.currentAudio!.removeEventListener("canplay", handleCanPlay);

        // Start from a random position (ensure we have enough time for the snippet)
        const randomStart = secureRandomInt(
          Math.max(0, this.currentAudio!.duration - duration)
        );
        this.currentAudio!.currentTime = randomStart;

        this.currentAudio!.play()
          .then(() => {
            if (this.onTrackChange) this.onTrackChange(song, this.currentIndex);

            // Stop after specified duration and properly clear the audio
            safeSetTimeoutAsync(async () => {
              this.stopSong(); // Use the existing stopSong method for complete cleanup
              resolve();
            }, duration * 1000);
          })
          .catch((err) => {
            console.error("Quick snippet playback failed:", err);
            resolve();
          });
      };

      this.currentAudio.addEventListener("canplay", handleCanPlay);
      this.currentAudio.addEventListener("error", () => {
        console.error("Audio loading failed");
        resolve();
      });
    });
  }

  async getRandomSongsForGenre(
    count: number,
    genre: Genre,
  ): Promise<Song[]> {
    await this.ensureGenre(genre);
    let pool = this.getCachedSongs();

    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, count);
  }

  // --- Multi-song controls (Play exactly 3 songs simultaneously) ---
  async playMultiSong(songs: Song[], genre: Genre) {
    await this.ensureGenre(genre);

    this.stopMultiSong();

    // Take only first 3 songs with valid preview URLs
    // const validSongs = songs
    //   // .filter((s) => s.previewUrl && s.previewUrl.trim() !== "")
    //   .slice(0, 3);

    const validSongs = songs.filter((s) => s.previewUrl && s.previewUrl.trim() !== "").slice(0, 3);

    if (validSongs.length === 0) return;

    this.multiAudios = validSongs.map((song) => {
      const audio = new Audio(song.previewUrl!);
      audio.volume = this.currentVolume;
      return audio;
    });

    this.isMuted = false;
    if (this.onMuteStateChange) {
      this.onMuteStateChange(false);
    }

    // Play all 3 songs simultaneously
    this.multiAudios.forEach(async (audio, i) => {
      try {
        await audio.play();
      } catch (error) {
        console.error(`Failed to play song ${i + 1}:`, error);
      }
    });
  }

  stopMultiSong() {
    this.multiAudios.forEach((audio) => {
      audio.pause();
      audio.currentTime = 0;
    });
    this.multiAudios = [];
  }

  // --- Track change subscription ---
  setOnTrackChange(cb: (song: Song, index: number) => void) {
    this.onTrackChange = cb;
  }

  // --- Mute state change subscription ---
  setOnMuteStateChange(cb?: (muted: boolean) => void) {
    this.onMuteStateChange = cb;
  }

  // --- Audio control methods ---
  setVolume(volume: number) {
    this.currentVolume = volume;
    if (this.currentAudio) {
      this.currentAudio.volume = volume;
    }
    this.multiAudios.forEach((audio) => {
      audio.volume = volume;
    });
  }

  setMuted(muted: boolean) {
    this.isMuted = muted;
    if (this.currentAudio) {
      this.currentAudio.muted = muted;
    }
    this.multiAudios.forEach((audio) => {
      audio.muted = muted;
    });
    if (this.onMuteStateChange) {
      this.onMuteStateChange(muted);
    }
  }

  getCurrentVolume(): number {
    return this.currentVolume;
  }

  getCurrentMutedState(): boolean {
    return this.isMuted;
  }

  // --- Audio unlock gate ---
  private audioUnlocked = false;
  private audioUnlockPromise: Promise<void> | null = null;
  private resolveAudioUnlock?: () => void;

  isAudioUnlocked() {
    return this.audioUnlocked;
  }

  ensureAudioUnlocked(): Promise<void> {
    if (this.audioUnlocked) return Promise.resolve();
    this.audioUnlockPromise ??= new Promise<void>((res) => {
      this.resolveAudioUnlock = res;
    });
    return this.audioUnlockPromise;
  }

  async unlockAudio(): Promise<void> {
    if (this.audioUnlocked) return;
    try {
      // Try WebAudio resume + 1 frame of silence
      const Ctx =
        (window as any).AudioContext || (window as any).webkitAudioContext;
      if (Ctx) {
        const ctx = new Ctx();
        await ctx.resume();
        const buffer = ctx.createBuffer(1, 1, 22050);
        const src = ctx.createBufferSource();
        src.buffer = buffer;
        src.connect(ctx.destination);
        src.start(0);
      }

      // Also kick a muted HTMLAudio element once
      const a = new Audio();
      a.muted = true;
      a.src =
        "data:audio/mp3;base64,//uQZAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==";
      try {
        await a.play();
      } catch {}
      a.pause();

      this.audioUnlocked = true;
      this.resolveAudioUnlock?.();
    } catch {
      // ignore: user may need another click
    }
  }
}

export const songService = new SongService();
