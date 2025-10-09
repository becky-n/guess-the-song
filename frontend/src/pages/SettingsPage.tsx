import Settings from "../components/Settings";
import "../css/SettingsPage.css";
import { useNavigate, useLocation } from "react-router-dom";
import { useState } from "react";

const GENRES = ["kpop", "pop", "hiphop", "edm"] as const;
type Genre = typeof GENRES[number];

const SettingsPage = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Retrieve player name from previous page (fallback: "You")
  const playerName = location.state?.playerName || "You";

  // Game settings state (default values)
  const [settings, setSettings] = useState({
    players: "Single Player",
    guessType: "Guess Song",
    gameMode: "Single Song",
    rounds: "10 Rounds",
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

  const handleCreateRoom = () => {
    navigate("/game", { state: { ...settings, playerName } });
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
              <span className="code-text">ABC123</span>
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