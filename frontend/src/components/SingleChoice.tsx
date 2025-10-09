import React, { useState, useEffect } from "react";
import "../css/GuessSong.css";
import PlayIcon from "../assets/Play.png";
import { songService } from "../services/songServices";
import type { Song } from "../types/song";

interface SingleChoiceProps {
  onCorrectGuess: () => void;          // Called when user guesses correctly
  currentSong: Song | null;            // Current song data
  hasGuessedCorrectly: boolean;        // Whether the user already guessed right
  onWrongGuess?: () => void;           // Optional callback for wrong guess
}

const SingleChoice: React.FC<SingleChoiceProps> = ({
  onCorrectGuess,
  currentSong,
  hasGuessedCorrectly,
  onWrongGuess,
}) => {
  const [guess, setGuess] = useState("");              // User input guess
  const [showWrongMessage, setShowWrongMessage] = useState(false); // Flag to show "wrong" feedback

  /** Create a masked version of the title (blanks only, no punctuation/featuring info) */
  const createBlanks = (text: string): string => {
    let mainTitle = text
      .replace(/\s*\([^)]*\)/g, "")   // Remove parentheses content
      .replace(/\s*feat\.?\s+.*/gi, "") // Remove "feat."
      .replace(/\s*ft\.?\s+.*/gi, "")   // Remove "ft."
      .replace(/\s*featuring\s+.*/gi, "") // Remove "featuring"
      .trim();

    const cleanTitle = mainTitle
      .replace(/[^\w\s]/g, "")        // Remove punctuation
      .replace(/\s+/g, " ")           // Normalize spaces
      .trim();

    return cleanTitle
      .split(" ")
      .filter(Boolean)
      .map(word => "_".repeat(word.length)) // Replace words with underscores
      .join("   ");
  };

  /** Normalize a title or guess for comparison */
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

  /** Check guess against the song title */
  const handleSubmitGuess = () => {
    if (!currentSong || hasGuessedCorrectly) return;

    const normalizedGuess = normalizeForComparison(guess);
    const normalizedTitle = normalizeForComparison(currentSong.title);

    if (normalizedGuess === normalizedTitle) {
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

  return (
    <div className="music-guess-game">
      {/* Song Title blanks */}
      <div className="artist-label">
        <h1>
          {currentSong ? `TITLE: ${createBlanks(currentSong.title)}` : "Loading..."}
        </h1>
      </div>

      {/* Artist name */}
      <div className="artist-label artist-label--spacing">
        <h2 className="artist-text">
          {currentSong ? `ARTIST: ${currentSong.artist}` : ""}
        </h2>
      </div>

      {/* Play song button */}
      <div className="central-circle-container">
        <button
          className="central-circle"
          onClick={() => songService.playSong()}
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

      {/* Submit + feedback */}
      <div className="controls">
        <button
          onClick={() => handleSubmitGuess()}
          disabled={hasGuessedCorrectly}
          className={`submit-btn ${hasGuessedCorrectly ? "submit-btn--disabled" : ""}`}
        >
          {hasGuessedCorrectly ? "Correct! ✅" : "Submit Guess"}
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
