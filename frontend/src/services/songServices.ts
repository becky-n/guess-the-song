import { type Song } from "../types/song";
import axios from "axios";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

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

  private currentIndex = 0;
  private currentAudio: HTMLAudioElement | null = null;
  private multiAudios: HTMLAudioElement[] = [];
  private onTrackChange?: (song: Song, index: number) => void;
  private onMuteStateChange?: (muted: boolean) => void;

  private currentVolume: number = 0.6;
  private isMuted: boolean = false;

  constructor() {
    this.baseUrl = `${API_BASE}/api/tracks`;
    this.cachedSongs = [];
  }

  // --- API calls ---
  async fetchRandom(genre: Genre = "kpop", count = 50): Promise<Song[]> {
    const res = await axios.get(this.baseUrl, { params: { genre, count } });
    const data = res.data;

    this.cachedSongs = ((data.tracks ?? []) as SongDTO[]).map((track) => ({
      id: String(track.id),
      title: track.name,
      artist: track.artists?.length ? track.artists.join(", ") : "Unknown",
      previewUrl: track.preview_url ?? "",
      imageUrl: track.image ?? "",
      externalUrl: track.external_url ?? "",
    }));
    return this.cachedSongs;
  }

  async refresh(genre: Genre = "kpop") {
    const res = await axios.post(`${this.baseUrl}/refresh`, null, { params: { genre } });
    return this.fetchRandom(genre);
  }
  getCachedSongs() {
    return this.cachedSongs;
  }

  // --- Single-song controls ---
  playSong(index: number = this.currentIndex) {
    if (!this.cachedSongs.length) return;
    this.stopSong();

    this.currentIndex = index;
    const song = this.cachedSongs[this.currentIndex];
    if (!song.previewUrl) return;

    this.currentAudio = new Audio(song.previewUrl);
    this.currentAudio.volume = this.currentVolume;
    this.currentAudio.muted = false;
    this.isMuted = false;
    if (this.onMuteStateChange) {
      this.onMuteStateChange(false);
    }
    this.currentAudio
      .play()
      .then(() => {
        if (this.onTrackChange) this.onTrackChange(song, this.currentIndex);
      })
      .catch((err) => console.error("Playback failed:", err));
  }

  playNextSong() {
    if (!this.cachedSongs.length) return;
    this.currentIndex = (this.currentIndex + 1) % this.cachedSongs.length;
    this.playSong(this.currentIndex);
  }

  pauseSong() {
    this.currentAudio?.pause();
    this.multiAudios.forEach(audio => audio.pause());
  }

  stopSong() {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }
    this.stopMultiSong();
  }

  // --- Multi-song controls (Play exactly 3 songs simultaneously) ---
  async playMultiSong(songs: Song[]) {
    this.stopMultiSong();

    // Take only first 3 songs with valid preview URLs
    const validSongs = songs
      .filter((s) => s.previewUrl && s.previewUrl.trim() !== "")
      .slice(0, 3);

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
    this.multiAudios.forEach(audio => {
      audio.volume = volume;
    });
  }

  setMuted(muted: boolean) {
    this.isMuted = muted;
    if (this.currentAudio) {
      this.currentAudio.muted = muted;
    }
    this.multiAudios.forEach(audio => {
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
}

export const songService = new SongService();