import type { Song } from "../types/song";
import { secureRandomInt, secureArrayShuffle } from "./secureRandom";

/**
 * Reusable game logic utilities to reduce code duplication
 */

/**
 * Generate multiple choice options for a song
 * @param correctSong - The correct song
 * @param allSongs - All available songs
 * @param numberOfOptions - Total number of options to generate (default: 4)
 * @returns Array of shuffled options including the correct answer
 */
export const generateMultipleChoiceOptions = (
  correctSong: Song,
  allSongs: Song[],
  numberOfOptions: number = 4
): string[] => {
  // Build a pool of unique titles excluding the correct one
  const pool = Array.from(
    new Set(
      allSongs
        .filter(s => s.title !== correctSong.title)
        .map(s => s.title)
    )
  );

  const need = Math.max(0, numberOfOptions - 1);
  const wrongOptions = secureArrayShuffle(pool).slice(0, Math.min(need, pool.length));

  // Shuffle again so the correct answer isn't always at index 0
  return secureArrayShuffle([correctSong.title, ...wrongOptions]);
};

/**
 * Select a random song from the array
 * @param songs - Array of songs
 * @returns Random song and its index
 */
export const selectRandomSong = (songs: Song[]): { song: Song; index: number } => {
  const randomIndex = secureRandomInt(songs.length);
  return {
    song: songs[randomIndex],
    index: randomIndex
  };
};

/**
 * Get random songs for mixed mode
 * @param allSongs - All available songs
 * @param count - Number of songs to select
 * @returns Array of random songs
 */
export const getRandomSongs = (allSongs: Song[], count: number): Song[] => {
  const shuffled = secureArrayShuffle(allSongs);
  return shuffled.slice(0, count);
};

/**
 * Generate options for mixed songs mode
 * @param correctSongs - Array of correct songs
 * @param allSongs - All available songs
 * @returns Array of shuffled options
 */
export const generateMixedSongsOptions = (correctSongs: Song[], allSongs: Song[]): string[] => {
  const correctTitles = correctSongs.map(s => s.title);

  // Generate a random incorrect option as a "mix"
  const randomMix = (): string => {
    const shuffled = secureArrayShuffle(allSongs);
    return shuffled
      .slice(0, 3)
      .map(s => s.title)
      .join(", ");
  };

  const options: string[] = [];
  options.push(correctTitles.join(", "));

  while (options.length < 4) {
    const mix = randomMix();
    if (!options.includes(mix)) options.push(mix);
  }

  return secureArrayShuffle(options);
};