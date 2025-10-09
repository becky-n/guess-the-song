import React, { useState } from "react";
import "../css/JoinRoom.css";
import { songService } from "../services/songServices";

import { useNavigate, useLocation } from "react-router-dom";

interface GuessifyProps {}

const JoinRoom: React.FC<GuessifyProps> = () => {
  const [code, setCode] = useState<string>("");

  const navigate = useNavigate();
  const location = useLocation();
  const playerName = location.state?.playerName; // get name from EnterName

  const handleCreateRoom = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    songService.fetchRandom().then((songs) => {
      console.log("Fetched songs", songs);
    });

    // Pass playerName along to SettingsPage
    navigate("/create_room", { state: { playerName } });
  };

  /* Commented out handleJoinRoom as it is only required for A2
  const handleJoinRoom = () => {
    // If you also want JOIN button to go somewhere and preserve the name
    navigate("/create_room", { state: { playerName } });
  };
  */

  const handleBackClick = (): void => {
    navigate("/");
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    setCode(e.target.value.toUpperCase());
  };

  return (
    <div className="guessify-container">
      {/* Back Button */}
      <button onClick={handleBackClick} className="joinroom-back-button">
        <span className="joinroom-back-arrow">&lt;&lt;</span>
        <span className="joinroom-back-text">Back</span>
      </button>

      <div className="guessify-content">
        {/* Logo/Title */}
        <h1 className="guessify-title">Guessify</h1>

        {/* Input Section */}
        <div className="guessify-input-section">
          <input
            type="text"
            placeholder="ENTER CODE"
            value={code}
            onChange={handleInputChange}
            className="guessify-input"
            maxLength={8}
          />
          <button className="guessify-join-button">
            JOIN
            {/* Note: handleJoinRoom is currently disabled */}
          </button>
        </div>

        {/* Divider */}
        <div className="guessify-divider">
          <span className="guessify-or">OR</span>
        </div>

        {/* Create Room Button */}
        <button onClick={handleCreateRoom} className="guessify-create-button">
          CREATE ROOM
        </button>
      </div>
    </div>
  );
};

export default JoinRoom;