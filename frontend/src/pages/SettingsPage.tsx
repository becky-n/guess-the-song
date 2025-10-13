import Settings from "../components/Settings";
import "../css/SettingsPage.css";
import { useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { generateRoomCode } from "../utils/roomCode.tsx";
import {
  type GameSettings,
  PlayerCount,
  RoundsCount,
} from "../components/Settings";
import { socket } from "../socket";
import { songService } from "../services/songServices.ts";

const GENRES = ["kpop", "pop", "hiphop", "edm"] as const;
type Genre = (typeof GENRES)[number];

const SettingsPage = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Retrieve player name from previous page (fallback: "You")
  const playerName = location.state?.playerName || "You";

  const [roomCode, setRoomCode] = useState<string>("");

  useEffect(() => {
    const code = generateRoomCode();
    setRoomCode(code);
  }, []);

  // Game settings state (default values)
  const [settings, setSettings] = useState<GameSettings>({
    amountOfPlayers: PlayerCount["Single Player"],
    guessType: "Guess Song",
    gameMode: "Single Song",
    rounds: RoundsCount["10 Rounds"],
    guessTime: "15 sec",
    genre: "kpop" as Genre,
  });

  // Navigate back to lobby
  const handleBackClick = () => {
    navigate("/lobby");
  };

  // Placeholder for invite code logic (copy/share)
  const handleGameCodeClick = () => {};

  // Create room and move to game page, passing player info and settings
  const handleCreateRoom = () => {
    // Set up room creation listener
    const handleRoomCreated = ({
      code,
      rooms,
    }: {
      code: string;
      rooms: any;
    }) => {
      console.log(
        "Room created successfully with code:",
        code,
        "in ROOMS:",
        rooms
      );

      songService.resetCache(settings.genre);
      songService.refresh(settings.genre).catch(() => {});

      // For single player mode, skip waiting room and go directly to game
      if (settings.amountOfPlayers === 1) {
        navigate(`/room/${code}`, {
          state: {
            ...settings,
            playerName,
            isHost: true,
          },
        });
      } else {
        navigate(`/waiting/${code}`, {
          state: {
            playerName,
            isHost: true, // Mark this player as the host
          },
        });
      }

      // Clean up listener after navigation
      socket.off("room-created", handleRoomCreated);
    };

    socket.on("room-created", handleRoomCreated);

    // Create the room
    if (socket.connected) {
      socket.emit("create-room", {
        code: roomCode,
        settings,
        host: playerName,
      });
    } else {
      // If not connected, wait for connection then emit
      socket.on("connect", () => {
        console.log("🔌 Connected to server with ID:", socket.id);
        socket.emit("create-room", {
          code: roomCode,
          settings,
          host: playerName,
        });
      });
    }
  };

  return (
    <div className="settings-page">
      <div className="settings-page-background">
        {/* Header with back button, logo, and invite code */}
        <div className="settings-header">
          <button className="back-button" onClick={handleBackClick}>
            <span className="back-arrow">&lt;&lt;</span>
            <span className="back-text">Back</span>
          </button>

          <div className="logo">
            <span className="logo-text">Guessify</span>
          </div>

          <div className="game-code-section">
            <span className="invite-text">INVITE CODE:</span>
            <button className="game-code-button" onClick={handleGameCodeClick}>
              <span className="code-text">{roomCode || "..."}</span>
              <span className="copy-icon">📋</span>
            </button>
          </div>
        </div>

        {/* Game settings form */}
        <Settings settings={settings} setSettings={setSettings} />

        {/* Button to confirm settings and start game */}
        <div className="create-room-section">
          <button className="create-room-button" onClick={handleCreateRoom}>
            Create Room
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
