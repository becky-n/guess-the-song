import React, { useState, useEffect, useRef } from "react";
import "../css/InGamePage.css";
import Scoreboard from "../components/Scoreboard";
import GameHeader from "../components/GameHeader";
import MultipleChoice from "../components/MultipleChoice";
import SingleChoice from "../components/SingleChoice";
import AudioControls from "../components/AudioControls";
import RoundScoreDisplay from "../components/RoundScoreDisplay";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { songService } from "../services/songServices";
import type { Song } from "../types/song";
import {socket} from '../socket';

//interface GuessifyProps {}
interface Player {
  name: string;
  points: number;
  previousPoints: number;
  correctAnswers: number;
}

const getTimeAsNumber = (timeStr: string): number => {
  return parseInt(timeStr.replace(' sec', ''));
};

type Genre = "kpop" | "pop" | "hiphop" | "edm";

interface GuessifyProps {}

const InGamePage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { code } = useParams(); // room code from URL

  // --- Extract settings safely ---
  const state = location.state 
  const { playerName, isHost, rounds: totalRounds, guessTime: roundTime, gameMode, genre: Genre} = state;


  // --- Player State ---
  const [players, setPlayers] = useState<Player[]>([]);
  const [player, setPlayer] = useState<Player>({
    name: playerName,
    points: 0,
    previousPoints: 0,
    correctAnswers: 0,
  });

  // --- Game Settings ---
  const isSingleSong = gameMode === "Single Song";

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

  // --- Round Control Helpers ---
  const isRoundStarting = useRef(false);
  //const roundTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ----------------- SOCKET CONNECTION ----------------- */
  useEffect(() => {

    socket.emit("get-room-players-scores", code );

    // Listen for players joined the room
    socket.on("room-players-scores", ( playerScores ) => {
      setPlayers(playerScores);
    });

    // Host starts round → everyone gets the same song
    socket.on("round-start", ({ song, choices, answer, startTime }) => {
      setCurrentSong(song);
      setOptions(choices);
      setCorrectAnswer(answer);
      const roundStart = startTime || Date.now();
      setRoundStartTime(roundStart);
      setIsRoundActive(true);
      setTimeLeft(getTimeAsNumber(roundTime));
    });

    // Score update - this will override the initial scores when available
    socket.on("score-update", (updatedPlayers: Player[]) => {
  
      // Only update if we have valid data
      if (updatedPlayers && Array.isArray(updatedPlayers) && updatedPlayers.length > 0) {
        // Sort players by points (highest first)
        const sortedPlayers = [...updatedPlayers].sort((a, b) => b.points - a.points);
        setPlayers(sortedPlayers);
        
        // Update current player state from the players list
        const currentPlayer = updatedPlayers.find(p => p.name === playerName);
        if (currentPlayer) {
          setPlayer(currentPlayer);
        }
      } else {
        console.log("⚠️ WARNING: Received invalid score update data, keeping current players");
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
    console.log("Host ended the game, navigating all players to end game page");
    navigate("/end_game", {
      state: { code }
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

  const genre = (location.state?.genre ?? "kpop") as "kpop"|"pop"|"hiphop"|"edm";

  useEffect(() => {
    songService.fetchRandom(genre, 50).catch(console.error);
  }, [genre]);

  // Get a random set of songs for multiple choice rounds
  const getRandomSongs = (num: number): Song[] => {
    const all = songService.getCachedSongs();
    const shuffled = [...all].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, num);
  };

  // Generate multiple choice options including correct answer + distractors
  const generateOptions = (correctSongs: Song[]): string[] => {
    const all = songService.getCachedSongs();
    const correctTitles = correctSongs.map((s) => s.title);

    // Generate a random incorrect option as a "mix"
    function randomMix(): string {
      const shuffled = [...all].sort(() => 0.5 - Math.random());
      return shuffled
        .slice(0, 3)
        .map((s) => s.title)
        .join(", ");
    }

    const opts: string[] = [];
    opts.push(correctTitles.join(", "));

    while (opts.length < 4) {
      const mix = randomMix();
      if (!opts.includes(mix)) opts.push(mix);
    }

    return opts.sort(() => 0.5 - Math.random());
  };
  

  // Calculate points based on how quickly the answer was given (min 100, max 1000)
  const calculatePoints = (): number => {
    if (!roundStartTime) return 500; // fallback if no start time
    const roundTimeAsNumber = getTimeAsNumber(roundTime);
    
    const maxPoints = 1000;
    const minPoints = 100;
    const elapsedTime = (Date.now() - roundStartTime) / 1000; // seconds
    const timeRatio = Math.max(0, (roundTimeAsNumber - elapsedTime) / roundTimeAsNumber);
    const points = Math.floor(minPoints + (maxPoints - minPoints) * timeRatio);
    return Math.max(points, minPoints);
  };

  // Add points and optionally increment correctAnswers
  const addPointsToPlayer = (points: number, correct: boolean = false) => {
    // Calculate new totals
    const newPoints = player.points + points;
    const newCorrectAnswers = correct ? player.correctAnswers + 1 : player.correctAnswers;

    // Update the current player's state
    setPlayer(prev => ({
      ...prev,
      points: newPoints,
      correctAnswers: newCorrectAnswers,
    }));

    // Update the players list
    setPlayers(prev => prev.map(p => 
      p.name === playerName 
        ? {
            ...p,
            points: newPoints,
            correctAnswers: newCorrectAnswers,
          }
        : p
    ));

    // Emit score update to server with total points
    if (socket) {
      const scoreData = {
        code,
        playerName,
        points: newPoints,
        correctAnswers: newCorrectAnswers
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

  // Handle correct guess in single song mode
  const handleCorrectGuess = () => {
    if (!hasGuessedCorrectly) {
      const points = calculatePoints();
      addPointsToPlayer(points, true); // correct answer count
      setHasGuessedCorrectly(true);
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
        totalRounds 
      });
    } else {
      // Emit event to navigate all players to end game
      socket.emit("host-end-game", { code });
    }
  }
  
  // Local state update (will be overridden by socket event for consistency)
  if (currentRound < totalRounds) {
    setCurrentRound(r => r + 1);
    setTimeLeft(getTimeAsNumber(roundTime));
    setIsRoundActive(true);
    setIsIntermission(false);
    setSelectedIndex(null);
  } else {
    // Navigate to end game page
    navigate("/end_game", {
      state: { code }
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

    isRoundStarting.current = true;
    songService.stopSong();

    // Update previous points before starting new round (except for first round)
    if (currentRound > 1) {
      setPlayer(prev => ({
        ...prev,
        previousPoints: prev.points,
      }));
      
      setPlayers(prev => prev.map(p => ({
        ...p,
        previousPoints: p.points,
      })));
    }

    // Reset round state
    setIsRoundActive(true);
    setTimeLeft(getTimeAsNumber(roundTime));
    setRoundStartTime(Date.now());
    setHasGuessedCorrectly(false);
    setHasSelectedCorrectly(false);
    setShowCorrectAnswer(false);
    setIsTimeUp(false);

    // Start playback depending on game mode
    if (isSingleSong) {
      if (currentRound === 1) songService.playSong();
      else songService.playNextSong();
    } else {
      const chosen = getRandomSongs(3);
      songService.playMultiSong(chosen);

      const opts = generateOptions(chosen);
      setOptions(opts);
      setCorrectAnswer(chosen.map(s => s.title).join(", "));
    }
    // Release "starting lock" after 1s
    setTimeout(() => { isRoundStarting.current = false; }, 1000);
  }, [currentRound, isSingleSong, roundTime]);

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
  const timer = setTimeout(() => setTimeLeft((t: number) => t - 1), 1000);
  
  return () => clearTimeout(timer);
}, [timeLeft, isRoundActive, isIntermission, socket, code]);

  /* ----------------- RENDER ----------------- */

  // Early return for debugging
  if (!code) {
    return <div>No room code found in URL</div>;
  }

  return (
    <div className="game-2-container" style={{ color: "white" }}>
      {isIntermission ? (
        <RoundScoreDisplay
          players={players}
          roundNumber={currentRound}
          totalRounds={totalRounds}
          onContinue={handleContinueToNextRound}
          isFinalRound={currentRound === totalRounds}
          correctAnswer={isSingleSong ? currentSong?.title : correctAnswer}
          playerGotCorrect={isSingleSong ? hasGuessedCorrectly : hasSelectedCorrectly}
          isTimeUp={isTimeUp}
          isHost={isHost}
        />
      ) : (
        <>
          <GameHeader
            roundNumber={`${currentRound}/${totalRounds}`}
            timer={`${timeLeft} sec`}
            inviteCode={inviteCode}
          />
          <div className="game-2-body">
            {isSingleSong ? (
              <SingleChoice
                onCorrectGuess={handleCorrectGuess}
                currentSong={currentSong}
                hasGuessedCorrectly={hasGuessedCorrectly}
                onWrongGuess={() => {
                  // Optional: Add any logic for wrong guesses
                }}
              />
            ) : (
              <MultipleChoice
                options={options}
                onSelect={handleSelect}
                selectedIndex={selectedIndex}
                correctAnswer={correctAnswer}
                showCorrectAnswer={showCorrectAnswer}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default InGamePage;