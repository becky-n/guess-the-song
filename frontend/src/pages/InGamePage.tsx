import React, { useState, useEffect, useRef } from "react";
import "../css/InGamePage.css";
import Scoreboard from "../components/Scoreboard";
import GameHeader from "../components/GameHeader";
import MultipleChoice from "../components/MultipleChoice";
import QuickGuessMultipleChoice from "../components/QuickGuessMultipleChoice";
import SingleChoice from "../components/SingleChoice";
import AudioControls from "../components/AudioControls";
import RoundScoreDisplay from "../components/RoundScoreDisplay";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { songService } from "../services/songServices";
import type { Song } from "../types/song";
import { socket } from "../socket";
import {
  generateMultipleChoiceOptions,
  selectRandomSong,
  getRandomSongs,
  generateMixedSongsOptions,
} from "../utils/gameLogic";
import { safeSetTimeoutAsync } from "../utils/safeTimers";

interface Player {
  name: string;
  points: number;
  previousPoints: number;
  correctAnswers: number;
}

const getTimeAsNumber = (timeStr: string): number => {
  return parseInt(timeStr.replace(" sec", ""));
};

const InGamePage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { code } = useParams(); // room code from URL

  // --- Extract settings safely ---
  const state = location.state;
  const {
    playerName,
    isHost,
    rounds: totalRounds,
    guessTime: roundTime,
  } = state;

  // --- Genre Type ---
  type Genre = "kpop" | "pop" | "hiphop" | "edm";
  const genre = (location.state?.genre ?? "kpop") as
    | "kpop"
    | "pop"
    | "hiphop"
    | "edm";

  // --- Player State ---
  const [players, setPlayers] = useState<Player[]>([]);
  const [player, setPlayer] = useState<Player>({
    name: playerName,
    points: 0,
    previousPoints: 0,
    correctAnswers: 0,
  });

  // --- Game Settings ---
  //const roundTime = parseInt(state?guessTime || "30");
  //const totalRounds = parseInt(state?.rounds || "10");
  const isSingleSong = state?.gameMode === "Single Song";
  const isMixedSongs = state?.gameMode === "Mixed Songs";
  const isGuessArtist = state?.gameMode === "Guess the Artist";
  const isQuickGuess1Sec = state?.gameMode === "Quick Guess - 1 Sec";
  const isQuickGuess3Sec = state?.gameMode === "Quick Guess - 3 Sec";
  const isQuickGuess5Sec = state?.gameMode === "Quick Guess - 5 Sec";
  const isQuickGuess = isQuickGuess1Sec || isQuickGuess3Sec || isQuickGuess5Sec;

  // Get the snipper duration for quick guess modes
  const getSnippetDuration = () => {
    if (isQuickGuess1Sec) return 1;
    if (isQuickGuess3Sec) return 3;
    if (isQuickGuess5Sec) return 5;
    return 3; // default
  };

  // --- Round State ---
  const [currentRound, setCurrentRound] = useState(1);
  const [timeLeft, setTimeLeft] = useState(getTimeAsNumber(roundTime));
  const [roundStartTime, setRoundStartTime] = useState<number | null>(null);
  const [isRoundActive, setIsRoundActive] = useState(false);
  const [isIntermission, setIsIntermission] = useState(false);
  const [inviteCode] = useState(code || "INVALID");
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  // --- Single Song Mode ---
  const [hasGuessedCorrectly, setHasGuessedCorrectly] = useState(false);
  const [currentSong, setCurrentSong] = useState<Song | null>(null);

  // --- Multiple Choice Mode ---
  const [hasSelectedCorrectly, setHasSelectedCorrectly] = useState(false);
  const [showCorrectAnswer, setShowCorrectAnswer] = useState(false);
  const [options, setOptions] = useState<string[]>([]);
  const [correctAnswer, setCorrectAnswer] = useState<string>("");
  const [isTimeUp, setIsTimeUp] = useState(false);

  // --- Guess Artist Mode ---
  const [hasGuessedArtistCorrectly, setHasGuessedArtistCorrectly] =
    useState(false);

  // --- Quick Guess Mode ---
  const [hasPlayedSnippet, setHasPlayedSnippet] = useState(false);

  // --- Round Control Helpers ---
  const isRoundStarting = useRef(false);
  const [songsReady, setSongsReady] = useState(false);

  /* ----------------- SOCKET CONNECTION ----------------- */
  useEffect(() => {
    socket.emit("get-room-players-scores", code);

    // Listen for players joined the room
    socket.on("room-players-scores", (playerScores) => {
      setPlayers(playerScores);
    });

    // Host starts round → everyone gets the same song
    socket.on(
      "round-start",
      async ({ song, choices, answer, startTime, genre: hostGenre }) => {
        console.log("Received round-start from host:", {
          song: song?.title,
          choices,
          answer,
        });

        setCurrentSong(song);
        setOptions(choices);
        setCorrectAnswer(answer);
        const roundStart = startTime || Date.now();
        setRoundStartTime(roundStart);
        setIsRoundActive(true);
        setTimeLeft(getTimeAsNumber(roundTime));

        // For non-host players, handle audio playback and state updates
        const isSinglePlayer = state?.amountOfPlayers === 1;
        if (!isSinglePlayer && !isHost) {
          await songService.ensureGenre(hostGenre ?? genre);
          if (song) {
            // Find the song in cached songs and play it for non-host players
            const allSongs = songService.getCachedSongs();
            const songIndex = allSongs.findIndex(
              (s) => s.title === song.title && s.artist === song.artist
            );
            if (songIndex >= 0) {
              if (isSingleSong || isGuessArtist) {
                await songService.playSong(songIndex, genre);
              } else if (isQuickGuess) {
                // For quick guess, play the snippet with same delay as host
                const duration = getSnippetDuration();
                safeSetTimeoutAsync(async () => {
                  await songService.playQuickSnippet(songIndex, duration);
                  setHasPlayedSnippet(true);
                }, 1000);
              }
            }
          } else if (choices && choices.length > 0) {
            // Mixed songs mode - no specific song to play
            // The host handles the audio for mixed mode
          }

          // Reset round state for non-host players
          setHasGuessedCorrectly(false);
          setHasSelectedCorrectly(false);
          setShowCorrectAnswer(false);
          setIsTimeUp(false);
          setHasGuessedArtistCorrectly(false);
        }
      }
    );

    // Score update - this will override the initial scores when available
    socket.on("score-update", (updatedPlayers: Player[]) => {
      // Only update if we have valid data
      if (
        updatedPlayers &&
        Array.isArray(updatedPlayers) &&
        updatedPlayers.length > 0
      ) {
        // Sort players by points (highest first)
        const sortedPlayers = [...updatedPlayers].sort(
          (a, b) => b.points - a.points
        );
        setPlayers(sortedPlayers);

        // Update current player state from the players list
        const currentPlayer = updatedPlayers.find((p) => p.name === playerName);
        if (currentPlayer) {
          setPlayer(currentPlayer);
        }
      } else {
        console.log(
          "⚠️ WARNING: Received invalid score update data, keeping current players"
        );
      }
    });

    // Host continues to next round - all players advance
    socket.on("continue-to-next-round", ({ nextRound }) => {
      console.log(`Host advanced all players to round ${nextRound}`);
      setCurrentRound(nextRound);
      setTimeLeft(getTimeAsNumber(roundTime));
      setIsRoundActive(true);
      setIsIntermission(false);
      setSelectedIndex(null);
      setHasGuessedCorrectly(false);
      setHasSelectedCorrectly(false);
      setShowCorrectAnswer(false);
      setIsTimeUp(false);
    });

    // Host ends game - all players navigate to end game page
    socket.on("navigate-to-end-game", () => {
      console.log(
        "Host ended the game, navigating all players to end game page"
      );
      navigate("/end_game", {
        state: { code },
      });
    });

    return () => {
      socket.off("room-players-scores");
      socket.off("round-start");
      socket.off("score-update");
      socket.off("continue-to-next-round");
      socket.off("navigate-to-end-game");
    };
  }, [code, playerName, navigate, roundTime]);

  /* ----------------- ROUND LOGIC ----------------- */
  useEffect(() => {
    if (timeLeft === 0) {
      setIsRoundActive(false);
      socket?.emit("round-end", { code });
    }
  }, [isRoundActive, timeLeft, socket, code]);

  /* ----------------- HELPER FUNCTIONS ----------------- */

  // Ensure songs are loaded on initial mount
  useEffect(() => {
    (async () => {
      await ensureSongsLoaded();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // useEffect(() => {
  //   const genre = (location.state?.genre ?? "kpop") as Genre;
  //   songService.fetchRandom(genre, 50).catch(console.error);
  // }, [location.state?.genre]);

  // Single player round logic (local generation)
  const startSinglePlayerRound = async () => {
    await ensureSongsLoaded();
    if (isSingleSong || isGuessArtist) {
      if (currentRound === 1) songService.playSong(0, genre);
      else songService.playNextSong(genre);
    } else if (isQuickGuess) {
      // Use secure random utilities for consistency
      const allSongs = songService.getCachedSongs();
      const { song: selectedSong, index: randomIndex } =
        selectRandomSong(allSongs);
      if (selectedSong) {
        // Generate consistent multiple choice options using secure utility
        const choices = generateMultipleChoiceOptions(selectedSong, allSongs);

        setCurrentSong(selectedSong);
        setOptions(choices);
        setCorrectAnswer(selectedSong.title);

        // Play the snippet with a delay
        const snippetDuration = getSnippetDuration();
        safeSetTimeoutAsync(async () => {
          await songService.playQuickSnippet(randomIndex, snippetDuration);
          setHasPlayedSnippet(true);
        }, 1000);
      }
    } else {
      // Mixed songs mode
      const chosen = await songService.getRandomSongsForGenre(3, genre);
      await songService.playMultiSong(chosen, genre);

      const opts = generateMixedSongsOptions(
        chosen,
        songService.getCachedSongs()
      );
      setOptions(opts);
      setCorrectAnswer(chosen.map((s: Song) => s.title).join(", "));
    }
  };

  // Helper function for single song/artist modes
  const setupSingleSongMode = () => {
    const currentSongData =
      currentRound === 1
        ? songService.getCurrentSong()
        : songService.getNextSong();

    if (currentSongData) {
      const roundData = {
        song: currentSongData,
        choices: [],
        answer: isGuessArtist ? currentSongData.artist : currentSongData.title,
      };

      if (currentRound === 1) songService.playSong(0, genre);
      else songService.playNextSong(genre);

      return roundData;
    }
    return null;
  };

  // Helper function for quick guess mode
  const setupQuickGuessMode = () => {
    const allSongs = songService.getCachedSongs();
    const { song: selectedSong, index: randomIndex } =
      selectRandomSong(allSongs);

    if (selectedSong) {
      // Generate consistent multiple choice options using secure utility
      const choices = generateMultipleChoiceOptions(selectedSong, allSongs);

      // Setup local state
      setCurrentSong(selectedSong);
      setOptions(choices);
      setCorrectAnswer(selectedSong.title);

      // Play the snippet with a delay
      const snippetDuration = getSnippetDuration();
      safeSetTimeoutAsync(async () => {
        await songService.playQuickSnippet(randomIndex, snippetDuration);
        setHasPlayedSnippet(true);
      }, 1000);

      return {
        song: selectedSong,
        choices,
        answer: selectedSong.title,
      };
    }
    return null;
  };

  // Helper function for mixed songs mode
  const setupMixedSongsMode = async () => {
    await songService.ensureGenre(genre); // make sure cache is for the current genre
    const chosen = await songService.getRandomSongsForGenre(3, genre);
    await songService.playMultiSong(chosen, genre);

    const opts = generateMixedSongsOptions(
      chosen,
      songService.getCachedSongs()
    );
    setOptions(opts);
    setCorrectAnswer(chosen.map((s: Song) => s.title).join(", "));

    return {
      song: null,
      choices: opts,
      answer: chosen.map((s: Song) => s.title).join(", "),
    };
  };

  // Multiplayer host round logic (generate and distribute)
  const startMultiplayerHostRound = async () => {
    await ensureSongsLoaded();

    let roundData: any = {};

    if (isSingleSong || isGuessArtist) {
      roundData = setupSingleSongMode();
    } else if (isQuickGuess) {
      roundData = setupQuickGuessMode();
    } else {
      roundData = await setupMixedSongsMode();
    }

    // Send round data to all players via socket
    if (socket && code && roundData) {
      socket.emit("host-start-round", {
        code,
        ...roundData,
        genre,
        startTime: Date.now(),
      });
    }
  };

  // Calculate points based on how quickly the answer was given (min 100, max 1000)
  const calculatePoints = (): number => {
    if (!roundStartTime) return 500; // fallback if no start time
    const roundTimeAsNumber = getTimeAsNumber(roundTime);

    const maxPoints = 1000;
    const minPoints = 100;
    const elapsedTime = (Date.now() - roundStartTime) / 1000; // seconds
    const timeRatio = Math.max(
      0,
      (roundTimeAsNumber - elapsedTime) / roundTimeAsNumber
    );
    const points = Math.floor(minPoints + (maxPoints - minPoints) * timeRatio);
    return Math.max(points, minPoints);
  };

  // Add points and optionally increment correctAnswers
  const addPointsToPlayer = (points: number, correct: boolean = false) => {
    // Calculate new totals
    const newPoints = player.points + points;
    const newCorrectAnswers = correct
      ? player.correctAnswers + 1
      : player.correctAnswers;

    // Update the current player's state
    setPlayer((prev) => ({
      ...prev,
      points: newPoints,
      correctAnswers: newCorrectAnswers,
    }));

    // Update the players list
    setPlayers((prev) =>
      prev.map((p) =>
        p.name === playerName
          ? {
              ...p,
              points: newPoints,
              correctAnswers: newCorrectAnswers,
            }
          : p
      )
    );

    // Emit score update to server with total points
    if (socket) {
      const scoreData = {
        code,
        playerName,
        points: newPoints,
        correctAnswers: newCorrectAnswers,
      };
      socket.emit("update-score", scoreData);
    }
  };

  /* ----------------- HANDLERS ----------------- */

  // Handle multiple choice selection
  const handleSelect = (index: number) => {
    if (selectedIndex !== null) return;

    setSelectedIndex(index);
    const chosen = options[index];

    if (chosen === correctAnswer) {
      const points = calculatePoints();
      addPointsToPlayer(points, true); // Correct answer count
      setHasSelectedCorrectly(true);
      setShowCorrectAnswer(true);
      // Stop the song and go immediately to round score display
      songService.stopSong();
      setIsRoundActive(false);
      setIsIntermission(true);
    } else {
      setHasSelectedCorrectly(false);
      setShowCorrectAnswer(true);
      // For MCQ, wrong answer ends the round immediately (not time up)
      setIsTimeUp(false);
      songService.stopSong();
      setIsRoundActive(false);
      setIsIntermission(true);
    }
  };

  // Handle skip in single song mode
  const handleSkip = () => {
    if (!hasGuessedCorrectly) {
      // Stop the song and go to round score display without points
      songService.stopSong();
      setIsRoundActive(false);
      setIsIntermission(true);
    }
  };

  // Handle correct guess in single song mode
  const handleCorrectGuess = () => {
    let alreadyGuessed = false;

    if (isSingleSong) {
      alreadyGuessed = hasGuessedCorrectly;
    } else if (isGuessArtist) {
      alreadyGuessed = hasGuessedArtistCorrectly;
    }

    if (!alreadyGuessed) {
      const points = calculatePoints();
      addPointsToPlayer(points, true); // correct answer count

      if (isSingleSong) {
        setHasGuessedCorrectly(true);
      } else if (isGuessArtist) {
        setHasGuessedArtistCorrectly(true);
      }
      // Stop the song and go immediately to round score display
      songService.stopSong();
      setIsRoundActive(false);
      setIsIntermission(true);
    }
  };

  // End round when time runs out
  function handleRoundEnd() {
    songService.stopSong();

    // Time ran out - will show correct answer in round score display
    setIsTimeUp(true);
    setIsRoundActive(false);
    setIsIntermission(true);
  }

  // Continue to next round or navigate to end game screen
  const handleContinueToNextRound = () => {
    // Only the host should emit the continue event
    if (isHost && socket) {
      if (currentRound < totalRounds) {
        // Emit event to advance all players to next round
        socket.emit("host-continue-round", {
          code,
          nextRound: currentRound + 1,
          totalRounds,
        });
      } else {
        // Emit event to navigate all players to end game
        socket.emit("host-end-game", { code });
      }
    }

    // Local state update (will be overridden by socket event for consistency)
    if (currentRound < totalRounds) {
      setCurrentRound((r) => r + 1);
      setTimeLeft(getTimeAsNumber(roundTime));
      setIsRoundActive(true);
      setIsIntermission(false);
      setSelectedIndex(null);
    } else {
      // Navigate to end game page
      navigate("/end_game", {
        state: { code },
      });
    }
  };

  /* ----------------- EFFECTS ----------------- */

  // Subscribe to song changes
  useEffect(() => {
    songService.setOnTrackChange((song) => {
      setCurrentSong(song);
    });

    return () => {
      songService.stopSong();
      isRoundStarting.current = false;
    };
  }, []);

  // Start a new round whenever `currentRound` changes
  useEffect(() => {
    if (isRoundStarting.current) return;

    (async () => {
      isRoundStarting.current = true;
      songService.stopSong();

      // Update previous points before starting new round (except for first round)
      if (currentRound > 1) {
        setPlayer((prev) => ({
          ...prev,
          previousPoints: prev.points,
        }));

        setPlayers((prev) =>
          prev.map((p) => ({
            ...p,
            previousPoints: p.points,
          }))
        );
      }

      // Reset round state
      setIsRoundActive(true);
      setTimeLeft(getTimeAsNumber(roundTime));
      setRoundStartTime(Date.now());
      setHasGuessedCorrectly(false);
      setHasSelectedCorrectly(false);
      setShowCorrectAnswer(false);
      setIsTimeUp(false);
      setHasPlayedSnippet(false);
      setHasGuessedArtistCorrectly(false);

      // Check if this is single player or multiplayer
      const isSinglePlayer = state?.amountOfPlayers === 1;

      if (isSinglePlayer) {
        // Single player: generate songs locally as before
        await startSinglePlayerRound();
      } else if (isHost) {
        // Multiplayer host: generate and distribute round data
        await startMultiplayerHostRound();
      }
      // Multiplayer non-host players will receive round data via socket event

      // Release "starting lock" after 1s
      safeSetTimeoutAsync(async () => {
        isRoundStarting.current = false;
      }, 1000);
    })();
  }, [currentRound, isSingleSong, isGuessArtist, isQuickGuess, roundTime]);

  // Countdown timer logic
  useEffect(() => {
    // Don't run timer during intermission or when round is not active
    if (!isRoundActive || isIntermission) return;

    if (timeLeft <= 0) {
      // Time ran out - handle round end
      handleRoundEnd();
      setIsRoundActive(false);
      socket?.emit("round-end", { code });
      return;
    }

    // Single timer that decrements every second
    const timer = safeSetTimeoutAsync(
      async () => setTimeLeft((t: number) => t - 1),
      1000
    );

    return () => clearTimeout(timer);
  }, [timeLeft, isRoundActive, isIntermission, socket, code]);

  const ensureSongsLoaded = async () => {
    const g = (location.state?.genre ?? "kpop") as Genre;
    if (songService.getCachedSongs().length === 0) {
      await songService.fetchRandom(g, 50);
    }
    setSongsReady(true);
  };

  /* ----------------- RENDER ----------------- */

  // Helper function to render the appropriate game mode component
  const renderGameModeComponent = () => {
    if (isSingleSong) {
      return (
        <SingleChoice
          mode="title"
          onCorrectGuess={handleCorrectGuess}
          currentSong={currentSong}
          hasGuessedCorrectly={hasGuessedCorrectly}
          onSkip={handleSkip}
          onWrongGuess={() => {
            // Optional: Add any logic for wrong guesses
          }}
        />
      );
    }

    if (isMixedSongs) {
      return (
        <MultipleChoice
          options={options}
          onSelect={handleSelect}
          selectedIndex={selectedIndex}
          correctAnswer={correctAnswer}
          showCorrectAnswer={showCorrectAnswer}
          onSkip={handleSkip}
        />
      );
    }

    if (isGuessArtist) {
      return (
        <SingleChoice
          mode="artist"
          onCorrectGuess={handleCorrectGuess}
          currentSong={currentSong}
          hasGuessedCorrectly={hasGuessedArtistCorrectly}
          onSkip={handleSkip}
          onWrongGuess={() => {
            // Optional: Add any logic for wrong guesses
          }}
        />
      );
    }

    if (isQuickGuess) {
      return (
        <QuickGuessMultipleChoice
          options={options}
          onSelect={handleSelect}
          selectedIndex={selectedIndex}
          correctAnswer={correctAnswer}
          showCorrectAnswer={showCorrectAnswer}
          hasPlayedSnippet={hasPlayedSnippet}
          snippetDuration={getSnippetDuration()}
          onSkip={handleSkip}
        />
      );
    }
    return null;
  };

  // Helper function to get the correct answer for round score display
  const getCorrectAnswerForDisplay = () => {
    if (isSingleSong) return currentSong?.title;
    if (isGuessArtist) return currentSong?.artist;
    if (isQuickGuess) return currentSong?.title;
    return correctAnswer; // For Mixed Songs mode
  };

  // Helper function to get whether player got the correct answer
  const getPlayerCorrectStatus = () => {
    if (isSingleSong) return hasGuessedCorrectly;
    if (isGuessArtist) return hasGuessedArtistCorrectly;
    return hasSelectedCorrectly; // For Quick Guess and Mixed Songs modes
  };

  // Early return for debugging
  if (!code) {
    return <div>No room code found in URL</div>;
  }

  return (
    <div className="game-2-container">
      <AudioControls />
      {isIntermission ? (
        <RoundScoreDisplay
          players={players}
          roundNumber={currentRound}
          totalRounds={totalRounds}
          onContinue={handleContinueToNextRound}
          isFinalRound={currentRound === totalRounds}
          correctAnswer={getCorrectAnswerForDisplay()}
          playerGotCorrect={getPlayerCorrectStatus()}
          isTimeUp={isTimeUp}
          isHost={isHost}
        />
      ) : (
        <>
          <GameHeader
            roundNumber={`${currentRound}/${totalRounds}`}
            timer={`${timeLeft}`}
            inviteCode={inviteCode}
          />
          <div className="game-2-body">
            <Scoreboard players={players} />
            {renderGameModeComponent()}
          </div>
        </>
      )}
    </div>
  );
};

export default InGamePage;
