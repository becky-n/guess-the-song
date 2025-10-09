import "../css/Settings.css";
import React from "react";

import PlayersIcon from "../assets/setting-icons/Players.png";
import ModeIcon from "../assets/setting-icons/Vector.png";
import RoundIcon from "../assets/setting-icons/Round.png";
import TimerIcon from "../assets/setting-icons/Timer.png";


const GENRES = ["kpop", "pop", "hiphop", "edm"] as const;
export type Genre = (typeof GENRES)[number];

  
// Player count mapping object
export const PlayerCount = {
  'Single Player': 1,
  '2 Players': 2,
  '3 Players': 3,
  '4 Players': 4,
  '5 Players': 5,
  '6 Players': 6,
  '7 Players': 7,
  '8 Players': 8
} as const;

export const RoundsCount = {
  '5 Rounds': 5,
  '10 Rounds': 10,
  '15 Rounds': 15,
  '20 Rounds': 20
} as const;

// Type for player count keys
export type PlayerCountKey = keyof typeof PlayerCount;
export type RoundsCountKey = keyof typeof RoundsCount;

// Helper function to get integer player count from string
export const getPlayerCount = (playerString: string): number => {
  return PlayerCount[playerString as PlayerCountKey] || 1;
};

export const getRoundsCount = (roundsString: string): number => {
  return RoundsCount[roundsString as RoundsCountKey] || 10;
};

export const getPlayerCountString = (count: number): string => {
  const entry = Object.entries(PlayerCount).find(([, value]) => value === count);
  return entry ? entry[0] : "Unknown";
};

export const getRoundsCountString = (count: number): string => {
  const entry = Object.entries(RoundsCount).find(([, value]) => value === count);
  return entry ? entry[0] : "Unknown";
};

// Define shape of settings state
export interface GameSettings {
  amountOfPlayers: number;
  guessType: string;
  gameMode: string;
  rounds: number;
  guessTime: string;
  genre: Genre;
}

// Props expected by Settings component
interface SettingsProps {
  settings: GameSettings;
  setSettings: React.Dispatch<React.SetStateAction<GameSettings>>;
}

// Dropdown options for each setting
const options = {
  amountOfPlayers: ['Single Player', '2 Players', '3 Players', '4 Players', '5 Players', '6 Players', '7 Players', '8 Players'],
  gameMode: ['Single Song', 'Mixed Songs'],
  rounds: ['5 Rounds', '10 Rounds', '15 Rounds', '20 Rounds'],
  guessTime: ['10 sec', '15 sec', '20 sec', '30 sec'],
  genre: GENRES,
};

// Icon & Label mapping for each setting
const icons = {
  amountOfPlayers: { src: PlayersIcon, label: 'PLAYERS' },
  gameMode: { src: ModeIcon, label: 'GAME MODE' },
  rounds: { src: RoundIcon, label: 'ROUNDS' },
  guessTime: { src: TimerIcon, label: 'GUESS TIME' },
  genre: { src: ModeIcon, label: "GENRE" },
};

const Settings: React.FC<SettingsProps> = ({ settings, setSettings }) => {
  // Update settings when a dropdown changes
  const handleChange = (key: keyof GameSettings, value: string) => {
    if (key === 'amountOfPlayers' && (value in PlayerCount)) {
      setSettings(prev => ({ ...prev, [key]: getPlayerCount(value) }));
    }
    else if (key === 'rounds' && (value in RoundsCount)) {
      setSettings(prev => ({ ...prev, [key]: getRoundsCount(value) }));
    }
    else {
      setSettings(prev => ({ ...prev, [key]: value }));
    }
  };

  // Reusable dropdown renderer method
const renderDropdown = (key: keyof typeof options) => (
  <div className="setting-row" key={key}>
    <div className="setting-info">
      <div className="setting-icon">
        <img src={icons[key].src} alt={icons[key].label} />
      </div>
      <span className="setting-label">{icons[key].label}</span>
    </div>
    <select
      className="setting-dropdown"
      value={
        key === 'amountOfPlayers' 
          ? getPlayerCountString(settings[key]) 
          : key === 'rounds' 
          ? getRoundsCountString(settings[key]) 
          : settings[key]
      }
      onChange={(e) => handleChange(key, e.target.value)}
    >
      {options[key].map(option => (
        <option key={option} value={option}>{option}</option>
      ))}
    </select>
  </div>
);

  return (
    <div className="settings-container">
      {renderDropdown('amountOfPlayers')}
      {renderDropdown('gameMode')}
      {renderDropdown('rounds')}
      {renderDropdown('guessTime')}
      {renderDropdown("genre")}

    </div>
  );
};

export default Settings;
