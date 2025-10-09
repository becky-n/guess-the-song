import "../css/Settings.css";
import React from "react";

import PlayersIcon from "../assets/setting-icons/Players.png";
import ModeIcon from "../assets/setting-icons/Vector.png";
import RoundIcon from "../assets/setting-icons/Round.png";
import TimerIcon from "../assets/setting-icons/Timer.png";

const GENRES = ["kpop", "pop", "hiphop", "edm"] as const;
export type Genre = (typeof GENRES)[number];

export interface GameSettings {
  players: string;
  guessType: string;
  gameMode: string;
  rounds: string;
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
  players: [
    "Single Player",
    "2 Players",
    "3 Players",
    "4 Players",
    "5 Players",
    "6 Players",
    "7 Players",
    "8 Players",
  ] as const,
  gameMode: ["Single Song", "Mixed Songs"] as const,
  rounds: ["5 Rounds", "10 Rounds", "15 Rounds", "20 Rounds"] as const,
  guessTime: ["10 sec", "15 sec", "20 sec", "30 sec"] as const,
  genre: GENRES,
} as const;

type SettingKey = keyof typeof options;

// Icon & Label mapping for each setting
const icons: Record<
  Exclude<SettingKey, never>,
  { src: string; label: string }
> = {
  players: { src: PlayersIcon, label: "PLAYERS" },
  gameMode: { src: ModeIcon, label: "GAME MODE" },
  rounds: { src: RoundIcon, label: "ROUNDS" },
  guessTime: { src: TimerIcon, label: "GUESS TIME" },
  genre: { src: ModeIcon, label: "GENRE" },
};

const Settings: React.FC<SettingsProps> = ({ settings, setSettings }) => {
  // Update settings when a dropdown changes
  const handleChange = (key: SettingKey, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value } as GameSettings));
  };

  const renderDropdown = (key: SettingKey) => (
    <div className="setting-row" key={key}>
      <div className="setting-info">
        <div className="setting-icon">
          <img src={icons[key].src} alt={icons[key].label} />
        </div>
        <span className="setting-label">{icons[key].label}</span>
      </div>
      <select
        className="setting-dropdown"
        value={settings[key] as string}
        onChange={(e) => handleChange(key, e.target.value)}
      >
        {options[key].map((option) => (
          <option key={option} value={option}>
            {option.toString()}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <div className="settings-container">
      {renderDropdown("players")}
      {renderDropdown("gameMode")}
      {renderDropdown("rounds")}
      {renderDropdown("guessTime")}
      {renderDropdown("genre")}
    </div>
  );
};

export default Settings;
