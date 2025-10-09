import Settings from "../components/Settings";
import "../css/SettingsPage.css";
import { useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { generateRoomCode } from "../utils/roomCode.tsx";
import type { GameSettings } from "../components/Settings";
import { PlayerCount } from "../components/Settings";
import { RoundsCount } from "../components/Settings";
import { io } from "socket.io-client";

const GENRES = ["kpop", "pop", "hiphop", "edm"] as const;
type Genre = typeof GENRES[number];

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
    amountOfPlayers: PlayerCount['Single Player'],
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
  const handleGameCodeClick = () => {
  };

  // Create room and move to game page, passing player info and settings
    const handleCreateRoom = () => {

      // create socket
      const socketUrl = import.meta.env.VITE_SOCKET_URL;
      if (!socketUrl) {
        alert("Socket URL is not defined. Please check your environment variables.");
        return;
      }
      const socket = io(socketUrl);

      socket.on("room-created", ({ code, rooms }) => {
        console.log("Room created successfully with code:", code, 'in ROOMS:', rooms);
        navigate(`/waiting/${code}`, {
          state: {
            playerName,
            isHost: true, // Mark this player as the host
          }
        });
      });

      socket.on("connect", () => {
        // console.log("🔌 Connected to server with ID:", socket.id);
        socket.emit("create-room", { code: roomCode, settings, host: playerName });
      });
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