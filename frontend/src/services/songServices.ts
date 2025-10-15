import { type Song } from "../types/song";
import axios from "axios";
import { secureRandomInt } from "../utils/secureRandom";
import { safeSetTimeoutAsync } from '../utils/safeTimers';

const API_BASE = import.meta.env.VITE_API_BASE_URL;

if (!API_BASE) {
  throw new Error("VITE_API_BASE_URL is not defined");
}
console.log("Using API base URL:", API_BASE);

export type Genre = "kpop" | "pop" | "hiphop" | "karaoke hits" | "top hits" | "r&b";

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

  /**
   * Fetches a random list of songs from the backend for a specified genre and count.
   * 
   * This method clears the existing song cache to ensure that only fresh songs of the requested genre are returned.
   * It then sends a GET request to the backend API, retrieves the song data, and maps it into the frontend's `Song` format.
   * The fetched songs are cached and returned.
   *
   * @param genre - The genre of songs to fetch. Defaults to `"kpop"`.
   * @param count - The number of songs to fetch. Defaults to `50`.
   * @returns A promise that resolves to an array of `Song` objects.
   */
  async fetchRandom(genre: Genre = "kpop", count = 50): Promise<Song[]> {
    console.log(`Fetching ${count} songs for genre: ${genre}`);
   
    // Clear existing cache to ensure fresh songs of correct genre
    this.clearCache();
   
    const res = await axios.get(this.baseUrl, { params: { genre, count } });
    const data = res.data;

    // Map the fetched song data (SongDTO) from the backend into the Song format used by the frontend
    this.cachedSongs = ((data.tracks ?? []) as SongDTO[]).map((track) => ({
      id: String(track.id),
      title: track.name,
      artist: track.artists?.length ? track.artists.join(", ") : "Unknown",
      previewUrl: track.preview_url ?? "",
      imageUrl: track.image ?? "",
      externalUrl: track.external_url ?? "",
    }));
   
    console.log(`Successfully cached ${this.cachedSongs.length} songs for genre: ${genre}`);
    return this.cachedSongs;
  }

  // --- Song Getters and Setters ---
  async refresh(genre: Genre = "kpop") {
    await axios.post(`${this.baseUrl}/refresh`, null, { params: { genre } });
    return this.fetchRandom(genre);
  }

  getCachedSongs() {
    return this.cachedSongs;
  }

  clearCache() {
    this.cachedSongs = [];
    this.currentIndex = 0;
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

  getCurrentIndex(): number {
    return this.currentIndex;
  }

  getCurrentAudio(): HTMLAudioElement | null {
    return this.currentAudio;
  }


  // Play a song given the full Song object (useful for multiplayer where host sends song details)
  playSongByDetails(song: Song) {
    if (!song || !song.previewUrl) return;
    this.stopSong();


    // Try to find index in cache for tracking, otherwise push into cache temporarily
    const idx = this.cachedSongs.findIndex(s => s.title === song.title && s.artist === song.artist && s.previewUrl === song.previewUrl);
    if (idx >= 0) this.currentIndex = idx;
    else {
      // Append temporarily to cache to keep index consistent for next/prev operations
      this.cachedSongs.push(song);
      this.currentIndex = this.cachedSongs.length - 1;
    }

    this.currentAudio = new Audio(song.previewUrl);
    this.currentAudio.volume = this.currentVolume;
    this.currentAudio.muted = false;
    this.isMuted = false;

    
    if (this.onMuteStateChange) this.onMuteStateChange(false);


    this.currentAudio.play().then(() => {
      if (this.onTrackChange) this.onTrackChange(song, this.currentIndex);
    }).catch(err => console.error('Playback failed (by details):', err));
  }


  // Play reverse using the Song object directly
  playReverseSongByDetails(song: Song) {
    if (!song || !song.previewUrl) return;
    this.stopSong();


    // Keep currentIndex consistent if possible
    const idx = this.cachedSongs.findIndex(s => s.title === song.title && s.artist === song.artist && s.previewUrl === song.previewUrl);
    if (idx >= 0) this.currentIndex = idx;
    else {
      this.cachedSongs.push(song);
      this.currentIndex = this.cachedSongs.length - 1;
    }


    // Reuse existing reverse playback logic
    if (window.AudioContext || (window as any).webkitAudioContext) {
      this.playReverseSongWithWebAudio(song);
    } else {
      this.playReverseSongSimple(song);
    }
  }


  // Shuffle the cached songs deterministically using a seed
  shuffleCachedSongs(seed?: number) {
    if (!this.cachedSongs || this.cachedSongs.length <= 1) return;
    // Use cryptographically secure random integer for unseeded shuffles
    let rand = (max: number) => secureRandomInt(max);
    if (typeof seed === 'number') {
      // xorshift32 deterministic generator
      let x = seed >>> 0;
      rand = (max: number) => {
        x ^= x << 13; x >>>= 0;
        x ^= x >>> 17; x >>>= 0;
        x ^= x << 5; x >>>= 0;
        return x % max;
      };
    }

    for (let i = this.cachedSongs.length - 1; i > 0; i--) {
      const j = rand(i + 1);
      const tmp = this.cachedSongs[i];
      this.cachedSongs[i] = this.cachedSongs[j];
      this.cachedSongs[j] = tmp;
    }
    this.currentIndex = 0;
  }

  // Play multiple songs by details (used for mixed songs mode)
  playMultiSongByDetails(songs: Song[]) {
    if (!songs || songs.length === 0) return;
    // Reuse playMultiSong which accepts Song[]; ensures we don't rely on cache
    this.playMultiSong(songs);
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

  // --- Reverse song playback ---
  playReverseSong(index: number = this.currentIndex) {
    if (!this.cachedSongs.length) return;
    this.stopSong();

    this.currentIndex = index;
    const song = this.cachedSongs[this.currentIndex];

    if (!song.previewUrl) return;

    // Try Web Audio API approach first, fallback to simple approach
    if (window.AudioContext || (window as any).webkitAudioContext) {
      this.playReverseSongWithWebAudio(song);
    } else {
      // Fallback to simple reverse playback
      this.playReverseSongSimple(song);
    }
  }

  /**
   * Plays the given song in reverse using the Web Audio API.
   *
   * This method fetches the song's preview URL, decodes the audio data,
   * reverses the audio buffer, and plays it through the browser's audio context.
   * It manages volume and mute state, stores references for stopping and volume control,
   * and triggers callbacks for mute state and track changes.
   * If playback fails, it falls back to a simpler reverse playback approach.
   *
   * @param song - The song object containing the preview URL to play in reverse.
   * @throws Will log an error and fallback to a simple reverse playback if the Web Audio API fails.
   */
  private async playReverseSongWithWebAudio(song: Song) {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      const audioContext = new AudioContext();
     
      // Fetch and decode the audio
      const response = await fetch(song.previewUrl);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
     
      // Reverse the audio buffer
      const reversedBuffer = this.reverseAudioBuffer(audioContext, audioBuffer);
     
      // Create and play the reversed audio
      const source = audioContext.createBufferSource();
      const gainNode = audioContext.createGain();
     
      source.buffer = reversedBuffer;
      gainNode.gain.value = this.isMuted ? 0 : this.currentVolume;
     
      source.connect(gainNode);
      gainNode.connect(audioContext.destination);
     
      // Store references for stopping and volume control
      (this as any).webAudioSource = source;
      (this as any).webAudioContext = audioContext;
      (this as any).webAudioGain = gainNode;
     
      if (this.onMuteStateChange) {
        this.onMuteStateChange(false);
      }
     
      source.start(0);
     
      if (this.onTrackChange) {
        this.onTrackChange(song, this.currentIndex);
      }
     
      // Handle when the audio ends
      source.onended = () => {
        this.stopSong();
      };
     
    } catch (error) {
      console.error("Web Audio API reverse playback failed:", error);
      // Fallback to simple approach
      this.playReverseSongSimple(song);
    }
  }

  private reverseAudioBuffer(audioContext: AudioContext, buffer: AudioBuffer): AudioBuffer {
    const reversedBuffer = audioContext.createBuffer(
      buffer.numberOfChannels,
      buffer.length,
      buffer.sampleRate
    );
   
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const channelData = buffer.getChannelData(channel);
      const reversedChannelData = reversedBuffer.getChannelData(channel);
     
      for (let i = 0; i < channelData.length; i++) {
        reversedChannelData[i] = channelData[channelData.length - 1 - i];
      }
    }
   
    return reversedBuffer;
  }

  private playReverseSongSimple(song: Song) {
    // Fallback: play small segments in reverse order
    this.currentAudio = new Audio(song.previewUrl);
    this.currentAudio.volume = this.currentVolume;
    this.currentAudio.muted = false;
    this.isMuted = false;
   
    if (this.onMuteStateChange) {
      this.onMuteStateChange(false);
    }

    this.currentAudio.addEventListener('canplay', () => {
      if (!this.currentAudio) return;
     
      // Start from the end and play small segments backwards
      let currentPosition = this.currentAudio.duration - 1;
      const segmentLength = 0.5; // Play 0.5 second segments
     
      if (this.onTrackChange) {
        this.onTrackChange(song, this.currentIndex);
      }
     
      this.playReverseSegments(currentPosition, segmentLength);
    });

    this.currentAudio.addEventListener('error', (err) => {
      console.error("Simple reverse playback failed:", err);
    });
  }

  private playReverseSegments(position: number, segmentLength: number) {
    if (!this.currentAudio || position <= 0) {
      this.stopSong();
      return;
    }
   
    const startTime = Math.max(0, position - segmentLength);
    this.currentAudio.currentTime = startTime;
   
    this.currentAudio.play().then(() => {
      // Stop after playing the segment
      setTimeout(() => {
        if (this.currentAudio) {
          this.currentAudio.pause();
          // Move to the previous segment
          this.playReverseSegments(startTime, segmentLength);
        }
      }, segmentLength * 1000);
    }).catch((err) => {
      console.error("Segment playback failed:", err);
      this.stopSong();
    });
  }

  playNextReverseSong() {
    if (!this.cachedSongs.length) return;
    this.currentIndex = (this.currentIndex + 1) % this.cachedSongs.length;
    this.playReverseSong(this.currentIndex);
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
   
    // Stop Web Audio API sources if they exist
    if ((this as any).webAudioSource) {
      try {
        (this as any).webAudioSource.stop();
      } catch (e) {
        console.warn("Could not stop web audio source:", e);
      }
      (this as any).webAudioSource = null;
    }
   
    if ((this as any).webAudioContext) {
      try {
        (this as any).webAudioContext.close();
      } catch (e) {
        console.warn("Could not close web audio context:", e);
      }
      (this as any).webAudioContext = null;
    }
   
    // Clear gain node reference
    if ((this as any).webAudioGain) {
      (this as any).webAudioGain = null;
    }
   
    this.stopMultiSong();
  }

  // --- Quick snippet playback with flexible duration ---
  async playQuickSnippet(index: number = this.currentIndex, duration: number = 3): Promise<void> {
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
        this.currentAudio!.removeEventListener('canplay', handleCanPlay);
       
        // Start from a random position (ensure we have enough time for the snippet)
        const randomStart = secureRandomInt(Math.max(0, this.currentAudio!.duration - duration));
        this.currentAudio!.currentTime = randomStart;
       
        this.currentAudio!.play().then(() => {
          if (this.onTrackChange) this.onTrackChange(song, this.currentIndex);

          // Stop after specified duration and properly clear the audio
          safeSetTimeoutAsync(async () => {
            this.stopSong(); // Use the existing stopSong method for complete cleanup
            resolve();
          }, duration * 1000);
        }).catch((err) => {
          console.error("Quick snippet playback failed:", err);
          resolve();
        });
      };

      this.currentAudio.addEventListener('canplay', handleCanPlay);
      this.currentAudio.addEventListener('error', () => {
        console.error("Audio loading failed");
        resolve();
      });
    });
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
   
    // Update Web Audio API gain node if it exists
    if ((this as any).webAudioGain) {
      (this as any).webAudioGain.gain.value = volume;
    }
  }

  setMuted(muted: boolean) {
    this.isMuted = muted;
    if (this.currentAudio) {
      this.currentAudio.muted = muted;
    }
    this.multiAudios.forEach(audio => {
      audio.muted = muted;
    });
   
    // Update Web Audio API gain node if it exists
    if ((this as any).webAudioGain) {
      (this as any).webAudioGain.gain.value = muted ? 0 : this.currentVolume;
    }
   
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