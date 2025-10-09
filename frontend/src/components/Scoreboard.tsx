import React, { type JSX } from "react";
import "../css/Scoreboard.css";
import medalGold from "../assets/1st-place-medal.png";
import medalSilver from "../assets/2nd-place-medal.png";
import medalBronze from "../assets/3rd-place-medal.png";

/**
 * Represents a player with a name and score.
 */
interface Player {
  name: string;
  points: number;
}

/**
 * Props for Scoreboard component.
 */
interface ScoreboardProps {
  players: Player[];
}

/**
 * Renders a medal or rank number depending on index.
 */
const renderRank = (index: number): JSX.Element => {
  switch (index) {
    case 0:
      return <img src={medalGold} alt="1st place" />;
    case 1:
      return <img src={medalSilver} alt="2nd place" />;
    case 2:
      return <img src={medalBronze} alt="3rd place" />;
    default:
      return <span className="rank-text">#{index + 1}</span>;
  }
};

/**
 * Scoreboard component for displaying player rankings during the game.
 */
const Scoreboard: React.FC<ScoreboardProps> = ({ players = [] }) => {
  return (
    <div className="scoreboard">
      {players.length === 0 ? (
        <div className="scoreboard-empty">
          <span>Waiting for players...</span>
        </div>
      ) : (
        players.map((player, index) => (
          <div className="scoreboard-player" key={player.name}>
            <div className="player-rank">{renderRank(index)}</div>
            <div className="player-info">
              <span className="player-name">{player.name}</span>
              <span className="player-points">{player.points} points</span>
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export default Scoreboard;