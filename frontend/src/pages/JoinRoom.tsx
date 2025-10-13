import React, { useEffect, useState } from "react";
import "../css/JoinRoom.css";
import { useNavigate, useLocation } from "react-router-dom";
import { isValidRoomCode } from "../utils/roomCode";

interface GuessifyProps {}

const JoinRoom: React.FC<GuessifyProps> = () => {
  const [code, setCode] = useState<string>("");
  const [name, setName] = useState<string>("");

  const navigate = useNavigate();
  const location = useLocation();
  const navPlayerName = (location.state as { playerName?: string } | null)?.playerName;

  // Persist player name so refresh on Waiting/Join doesn’t lose it
  useEffect(() => {
    if (navPlayerName && navPlayerName.trim()) {
      setName(navPlayerName.trim());
      sessionStorage.setItem("guessify_playerName", navPlayerName.trim());
    } else {
      const fromStorage = sessionStorage.getItem("guessify_playerName");
      if (fromStorage) setName(fromStorage);
    }
  }, [navPlayerName]);

  const handleCreateRoom = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (!name?.trim()) {
      alert("Please enter your name first!");
      return;
    }
    // Only pass playerName; server will own room config later
    navigate("/create_room", { state: { playerName: name.trim() } });
  };

  const handleJoinRoom = (e?: React.MouseEvent<HTMLButtonElement>) => {
    if (e) e.preventDefault();

    const trimmed = code.trim();
    if (!trimmed) {
      alert("Please enter a room code!");
      return;
    }
    if (!name?.trim()) {
      alert("Please enter your name first!");
      return;
    }
    if (!isValidRoomCode(trimmed)) {
      alert("Invalid room code format! Code should be 6 characters (letters and numbers).");
      return;
    }

    // Navigate to waiting room; server will emit room-info there
    navigate(`/waiting/${trimmed}`, {
      state: {
        playerName: name.trim(),
        isHost: false,
      },
    });
  };

  const handleBackClick = (): void => {
    navigate("/");
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
    setCode(value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && isValidRoomCode(code) && name?.trim()) {
      handleJoinRoom();
    }
  };

  const isJoinEnabled = isValidRoomCode(code) && !!name?.trim();

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
            onKeyDown={handleKeyDown}
            className="guessify-input"
            maxLength={6}          
          />
          <button
            className="guessify-join-button"
            onClick={handleJoinRoom}
            disabled={!isJoinEnabled}  
          >
            JOIN
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