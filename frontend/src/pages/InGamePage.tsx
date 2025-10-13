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

  const isSinglePlayer = state?.amountOfPlayers === 1;

  const {
    playerName,
    isHost,
    rounds: totalRounds,
    guessTime: roundTime,
  } = state;

  // --- effectiveGenre Type ---
  type Genre = "kpop" | "pop" | "hiphop" | "edm";
  // const effectiveGenre = location.state?.effectiveGenre as "kpop" | "pop" | "hiphop" | "edm";

  type GameMode =
    | "Single Song"
    | "Mixed Songs"
    | "Guess the Artist"
    | "Quick Guess";

  type RoomConfig = {
    genre: Genre;
    gameMode: GameMode;
    rounds: number;
    guessTimeSec: number;
    snippetDurationSec?: 1 | 3 | 5;
  };

  type RoomInfoEvent = {
    code: string;
    config: RoomConfig;
    playlist: Song[];
  };

  type RoundStartEvent =
    | {
        code: string;
        round: number;
        startTime: number;
        mode: "Single Song" | "Guess the Artist";
        pick: { playlistIndex: number };
      }
    | {
        code: string;
        round: number;
        startTime: number;
        mode: "Quick Guess";
        pick: { playlistIndex: number; choiceIndices: number[] };
      }
    | {
        code: string;
        round: number;
        startTime: number;
        mode: "Mixed Songs";
        pick: { playlistIndices: number[]; choiceIndices: number[] };
      };

  // --- Player State ---
  const [players, setPlayers] = useState<Player[]>([]);
  const [player, setPlayer] = useState<Player>({
    name: playerName,
    points: 0,
    previousPoints: 0,
    correctAnswers: 0,
  });

  const [roomConfig, setRoomConfig] = useState<RoomConfig | null>(null);
  const fallbackGenre = location.state?.genre as Genre;
  const effectiveGenre = roomConfig?.genre ?? fallbackGenre;

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
    if (!isSinglePlayer) return roomConfig?.snippetDurationSec ?? 3;
    if (isQuickGuess1Sec) return 1;
    if (isQuickGuess3Sec) return 3;
    if (isQuickGuess5Sec) return 5;
    return 3;
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

  const roomConfigRef = useRef<RoomConfig | null>(null);
  useEffect(() => {
    roomConfigRef.current = roomConfig;
  }, [roomConfig]);

  /* ----------------- SOCKET CONNECTION ----------------- */
  useEffect(() => {
    songService.stopSong();
    songService.clearRoomPlaylist();
    songService.resetCache();

    // ask server for room info on mount
    socket.emit("get-room-info", code);

    // ---- define handlers (named so we can off() them) ----
    const onRoomInfo = (info: RoomInfoEvent) => {
      setRoomConfig(info.config);
      songService.setRoomPlaylist(info.code, info.playlist);
      console.log("room-info", {
        code: info.code,
        genre: info.config.genre,
        playlistLen: info.playlist?.length,
      });

      if (!info.playlist?.length) {
        console.warn("Room playlist is empty — server did not supply tracks");
      }

      if (!info.playlist?.some((s) => s.previewUrl)) {
        console.warn("Room playlist has no playable previewUrl values");
      }

      if (!isSinglePlayer) setTimeLeft(info.config.guessTimeSec);
    };

    const onRoundStart = async (evt: RoundStartEvent) => {
      const cfg = roomConfigRef.current;
      if (!cfg) return;

      const songs = songService.getRoomPlaylist();
      setRoundStartTime(evt.startTime);
      setIsRoundActive(true);

      const elapsedSec = Math.floor((Date.now() - evt.startTime) / 1000);
      setTimeLeft(Math.max(0, cfg.guessTimeSec - elapsedSec));

      setHasGuessedCorrectly(false);
      setHasSelectedCorrectly(false);
      setShowCorrectAnswer(false);
      setIsTimeUp(false);
      setHasGuessedArtistCorrectly(false);
      setSelectedIndex(null);
      setHasPlayedSnippet(false);

      if (evt.mode === "Single Song" || evt.mode === "Guess the Artist") {
        const i = evt.pick.playlistIndex;
        const s = songs[i];
        if (s) {
          await songService.playRoomSong(i);
          setCurrentSong(s);
          setOptions([]);
          setCorrectAnswer(
            evt.mode === "Guess the Artist" ? s.artist : s.title
          );
        }
      } else if (evt.mode === "Quick Guess") {
        const i = evt.pick.playlistIndex;
        const s = songs[i];
        if (s) {
          setCurrentSong(s);
          setOptions(
            evt.pick.choiceIndices.map((ci) => songs[ci]?.title ?? "")
          );
          setCorrectAnswer(s.title);
          const delayMs = Math.max(0, 1000 - (Date.now() - evt.startTime));
          safeSetTimeoutAsync(async () => {
            await songService.playRoomQuickSnippet(
              i,
              cfg.snippetDurationSec ?? 3
            );
            setHasPlayedSnippet(true);
          }, delayMs);
        }
      } else if (evt.mode === "Mixed Songs") {
        const picks = evt.pick.playlistIndices;
        await songService.playRoomMulti(picks);
        setOptions(evt.pick.choiceIndices.map((ci) => songs[ci]?.title ?? ""));
        setCorrectAnswer(picks.map((pi) => songs[pi]?.title ?? "").join(", "));
      }
    };

    const onScoreUpdate = (updatedPlayers: Player[]) => {
      if (!updatedPlayers?.length) return;
      const sorted = [...updatedPlayers].sort((a, b) => b.points - a.points);
      setPlayers(sorted);
      const me = updatedPlayers.find((p) => p.name === playerName);
      if (me) setPlayer(me);
    };

    const onContinue = ({ nextRound }: { nextRound: number }) => {
      setCurrentRound(nextRound);
      setTimeLeft(
        isSinglePlayer
          ? getTimeAsNumber(roundTime)
          : roomConfigRef.current?.guessTimeSec ?? 0
      );
      setIsRoundActive(true);
      setIsIntermission(false);
      setSelectedIndex(null);
      setHasGuessedCorrectly(false);
      setHasSelectedCorrectly(false);
      setShowCorrectAnswer(false);
      setIsTimeUp(false);
    };

    const onEnd = () => {
      navigate("/end_game", { state: { code } });
    };

    // ---- register once ----
    socket.on("room-info", onRoomInfo);
    socket.on("round-start", onRoundStart);
    socket.on("score-update", onScoreUpdate);
    socket.on("continue-to-next-round", onContinue);
    socket.on("navigate-to-end-game", onEnd);

    // ---- cleanup (NOTE: same handler refs) ----
    return () => {
      socket.off("room-info", onRoomInfo);
      socket.off("round-start", onRoundStart);
      socket.off("score-update", onScoreUpdate);
      socket.off("continue-to-next-round", onContinue);
      socket.off("navigate-to-end-game", onEnd);
    };
    // keep deps minimal to avoid re-binding
  }, [code, navigate, isSinglePlayer, playerName]);

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

  // Single player round logic (local generation)
  const startSinglePlayerRound = async () => {
    await ensureSongsLoaded();
    if (isSingleSong || isGuessArtist) {
      if (currentRound === 1) songService.playSong(0, effectiveGenre);
      else songService.playNextSong(effectiveGenre);
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
      const chosen = await songService.getRandomSongsForGenre(
        3,
        effectiveGenre
      );
      await songService.playMultiSong(chosen, effectiveGenre);

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

      if (currentRound === 1) songService.playSong(0, effectiveGenre);
      else songService.playNextSong(effectiveGenre);

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
    await songService.ensureGenre(effectiveGenre); // make sure cache is for the current effectiveGenre
    const chosen = await songService.getRandomSongsForGenre(3, effectiveGenre);
    await songService.playMultiSong(chosen, effectiveGenre);

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
    if (socket && code) {
      socket.emit("host-start-round", { code });
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
    if (!isSinglePlayer) return; // MP uses room playlist; nothing to fetch here
    const g = effectiveGenre as Genre;
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
