import React, { useState, useEffect } from "react";
import "../css/GuessSong.css";
import PlayIcon from "../assets/Play.png";
import { songService, type Genre } from "../services/songServices";
import type { Song } from "../types/song";

interface SingleChoiceProps {
  onCorrectGuess: () => void;          // Called when user guesses correctly
  currentSong: Song | null;            // Current song data
  hasGuessedCorrectly: boolean;        // Whether the user already guessed right
  onWrongGuess?: () => void;           // Optional callback for wrong guess
  mode: 'title' | 'artist';             // Mode to guess either title or artist
  onSkip?: () => void;                 // Optional callback for skipping the round
}

const SingleChoice: React.FC<SingleChoiceProps> = ({
  onCorrectGuess,
  currentSong,
  hasGuessedCorrectly,
  onWrongGuess,
  mode,
  onSkip,
}) => {
  const [guess, setGuess] = useState("");              // User input guess
  const [showWrongMessage, setShowWrongMessage] = useState(false); // Flag to show "wrong" feedback

  /** Create a masked version of the text (blanks only, no punctuation/featuring info) */
  const createBlanks = (text: string): string => {
    let mainText = text
      .replace(/\s*\([^)]*\)/g, "")   // Remove parentheses content
      .replace(/\s*feat\.?\s+.*/gi, "") // Remove "feat."
      .replace(/\s*ft\.?\s+.*/gi, "")   // Remove "ft."
      .replace(/\s*featuring\s+.*/gi, "") // Remove "featuring"
      .trim();

    const cleanText = mainText
      .replace(/[^\w\s]/g, "")        // Remove punctuation
      .replace(/\s+/g, " ")           // Normalize spaces
      .trim();

    return cleanText
      .split(" ")
      .filter(Boolean)
      .map(word => "_".repeat(word.length)) // Replace words with underscores
      .join("   ");
  };

  /** Normalize a text or guess for comparison */
  const normalizeForComparison = (text: string): string => {
    return text
      .replace(/\s*\([^)]*\)/g, "")
      .replace(/\s*feat\.?\s+.*/gi, "")
      .replace(/\s*ft\.?\s+.*/gi, "")
      .replace(/\s*featuring\s+.*/gi, "")
      .replace(/[^\w\s]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  };

  /** Reset input state when song changes when current song changes */
  useEffect(() => {
    setGuess("");
    setShowWrongMessage(false);
  }, [currentSong]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setGuess(e.target.value);
  };

  /** Handle skip button click */
  const handleSkip = () => {
    if (!hasGuessedCorrectly && onSkip) {
      onSkip();
    }
  };

  /** Check guess against the song title */
  const handleSubmitGuess = () => {
    if (!currentSong || hasGuessedCorrectly) return;

    const normalizedGuess = normalizeForComparison(guess);
    const target = mode === 'title' ? currentSong.title : currentSong.artist;
    const normalizedTarget = normalizeForComparison(target);

    if (normalizedGuess === normalizedTarget) {
      onCorrectGuess(); // Correct guess → notify parent
    } else {
      setShowWrongMessage(true); // Wrong guess → show message
      onWrongGuess?.();
    }
  };

  /** Allow submitting with Enter key */
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !hasGuessedCorrectly) {
      handleSubmitGuess();
    }
  };

  const getDisplayContent = () => {
    if (!currentSong) return { blanked: "Loading...", shown: "" };

    if (mode === 'title') {
      return {
        blanked: `TITLE: ${createBlanks(currentSong.title)}`,
        shown: `ARTIST: ${currentSong.artist}`
      };
    } else {
      return {
        blanked: `ARTIST: ${createBlanks(currentSong.artist)}`,
        shown: `TITLE: ${currentSong.title}`
      };
    }
  };

  const { blanked, shown } = getDisplayContent();

  return (
    <div className="music-guess-game">
      {/* Blanked content (what user needs to guess) */}
      <div className="artist-label">
        <h1> {blanked} </h1>
      </div>

      {/* Shown content (hint) */}
      <div className="artist-label artist-label--spacing">
        <h2 className="artist-text">{shown}</h2>
      </div>

      {/* Play song button */}
      <div className="central-circle-container">
        <button
         onClick={() => {
      if (currentSong) {
        const songIndex = songService.getCachedSongs().findIndex(
          (s) => s.id === currentSong.id
        );
        if (songIndex >= 0) {
          songService.playSong(songIndex, currentSong.genre as Genre);
        } else {
          console.error("Song not found in cache:", currentSong);
        }
      }
    }}
        >
          <img src={PlayIcon} className="circle-image" alt="Play button" />
        </button>
      </div>

      {/* Guess input */}
      <div className="input-container">
        <input
          type="text"
          value={guess}
          onChange={handleInputChange}
          onKeyDown={handleKeyPress}
          placeholder={
            hasGuessedCorrectly
              ? "CORRECT! WAIT FOR NEXT ROUND..."
              : "TYPE YOUR GUESS HERE..."
          }
          className="guess-input"
          disabled={hasGuessedCorrectly}
        />
      </div>

      {/* Submit + Skip + feedback */}
      <div className="controls">
        <button
          onClick={() => handleSubmitGuess()}
          disabled={hasGuessedCorrectly}
          className={`submit-btn ${hasGuessedCorrectly ? "submit-btn--disabled" : ""}`}
        >
          {hasGuessedCorrectly ? "Correct! ✅" : "Submit Guess"}
        </button>

        <button
          onClick={handleSkip}
          disabled={hasGuessedCorrectly}
          className={`skip-btn ${hasGuessedCorrectly ? "skip-btn--disabled" : ""}`}
        >
          Skip
        </button>

        {/* Show wrong guess feedback */}
        {showWrongMessage && !hasGuessedCorrectly && (
          <div className="wrong-message">Try again! 🤔</div>
        )}
      </div>
    </div>
  );
};

export default SingleChoice;
