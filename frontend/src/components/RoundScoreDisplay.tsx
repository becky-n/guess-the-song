import React from "react";
import "../css/RoundScoreDisplay.css";

/** Player interface for round score display */
interface Player {
  readonly name: string;
  readonly points: number;
  readonly previousPoints: number;
  readonly correctAnswers: number;
}

/** Props interface for RoundScoreDisplay component */
interface RoundScoreDisplayProps {
  readonly players: Player[];
  readonly roundNumber: number;
  readonly totalRounds: number;
  readonly onContinue: () => void;
  readonly isFinalRound?: boolean;
  readonly correctAnswer?: string;
  readonly playerGotCorrect?: boolean;
  readonly isTimeUp?: boolean;
  readonly isHost?: boolean;
}

const RoundScoreDisplay: React.FC<RoundScoreDisplayProps> = ({
  players,
  roundNumber,
  totalRounds,
  onContinue,
  isFinalRound = false,
  correctAnswer,
  playerGotCorrect = true,
  isTimeUp = false,
  isHost = false,
}) => {
  // Sort players by points descending
  const sortedPlayers = [...players].sort((a, b) => b.points - a.points);

  return (
    <div className="round-score-display">
      <div className="round-score-header">
        <h2>{isFinalRound ? "Game Complete!" : `Round ${roundNumber} Complete!`}</h2>
        <p className="round-progress">
          {roundNumber} of {totalRounds}
        </p>
      </div>

      <div className="score-changes">
        {sortedPlayers.map((player, index) => {
          const scoreChange = player.points - player.previousPoints;
          const isPositive = scoreChange > 0;
          const isZero = scoreChange === 0;

          return (
            <div key={player.name} className="player-score-change">
              <div className="player-info">
                <span className="player-name">{player.name}</span>
                <div className="score-details">
                  <span className="total-score">{player.points} pts</span>
                  {!isZero && (
                    <span
                      className={`score-change ${isPositive ? "positive" : "negative"}`}
                    >
                      {isPositive ? "+" : ""}
                      {scoreChange}
                    </span>
                  )}
                </div>
              </div>

              <div className="player-rank">
                {index === 0 && <span className="rank-medal">🥇</span>}
                {index === 1 && <span className="rank-medal">🥈</span>}
                {index === 2 && <span className="rank-medal">🥉</span>}
                {index > 2 && <span className="rank-number">#{index + 1}</span>}
              </div>
            </div>
          );
        })}
      </div>

      {correctAnswer && (
        <div
          className={`correct-answer-section ${playerGotCorrect ? "correct" : "incorrect"}`}
        >
          <div className="correct-answer-message">
            {playerGotCorrect ? (
              <>
                <span className="correct-icon">✅</span>
                <span className="correct-text">Correct!</span>
              </>
            ) : (
              <>
                <span className="incorrect-icon">❌</span>
                <span className="incorrect-text">
                  {isTimeUp ? "Time's up!" : "Incorrect!"}
                </span>
              </>
            )}
          </div>
          <div className="correct-answer-display">
            <span className="correct-label">Correct answer:</span>
            <span className="correct-answer">{correctAnswer}</span>
          </div>
        </div>
      )}

      <div className="continue-section">
        <button
          className={`continue-button ${!isHost ? 'disabled' : ''}`}
          onClick={isHost ? onContinue : undefined}
          disabled={!isHost}
          aria-label={
            isHost 
              ? (isFinalRound ? "View final results" : `Continue to Round ${roundNumber + 1}`)
              : (isFinalRound ? "Waiting for host to view results" : `Waiting to start Round ${roundNumber + 1}`)
          }
        >
          {isHost 
            ? (isFinalRound ? "View Final Results" : `Continue to Round ${roundNumber + 1}`)
            : (isFinalRound ? "Waiting for host..." : `Waiting to start Round ${roundNumber + 1}`)
          } 
          </button>
      </div>
    </div>
  );
};

export default RoundScoreDisplay;