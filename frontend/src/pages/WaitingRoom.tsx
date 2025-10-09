import React, { useState, useEffect } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { socket } from '../socket';



const WaitingRoom: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { code } = useParams<{ code: string }>();
  
  const state = location.state as {
    playerName?: string;
    isHost?: boolean;
    socketId?: string;
  };
  
  const playerName = state?.playerName || "Player";
  const isHost = state?.isHost || false;
  
  const [players, setPlayers] = useState<string[]>([]);
  const [amountOfPlayersInRoom, setAmountOfPlayersInRoom] = useState(0);


  useEffect(() => {

    if (!socket || !socket.connected) return;

    socket.emit("join", { code, playerName });

    socket.on("join-error", ({ message }) => {
      alert(message);
      // Navigate back to lobby
      navigate('/lobby', { state: { playerName } });
    });

    // Handle successful join
    socket.on("join-success", ({ roomCode, playerName: joinedPlayer, players: roomPlayers, amountOfPlayersInRoom, playerScores }) => {

      setPlayers(roomPlayers);
      setAmountOfPlayersInRoom(amountOfPlayersInRoom);
    });


    socket.on("game-started", ( settings ) => {  

      // Navigate to actual game 
      navigate(`/room/${code}`, {
        state: {
          ...settings,
          playerName,
          isHost
        }
      });
    });

    return () => {
      socket.off('join-error');
      socket.off('join-success');
      socket.off('game-started');
    };
  }, [code, playerName, navigate]);

  const handleStartGame = () => {
    //TODO: Validate enough players, settings, etc.
    if (socket && isHost) {
      socket.emit("start-game", { code });
    }
  };

  return (
    <div style={{ 
      padding: '20px', 
      backgroundColor: '#9191e9ff', 
      color: 'black', 
      width: '100vw',
      height: '100vh',
      margin: 0,
      fontFamily: 'Arial, sans-serif',
      boxSizing: 'border-box'
    }}>
      <div style={{ textAlign: 'center', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <h1> Waiting Room </h1>
        
        <div style={{ 
          backgroundColor: '#b8b8f1ff', 
          padding: '20px', 
          borderRadius: '10px', 
          margin: '20px 0' 
        }}>
          <h2>Room: {code}</h2>
          <p><strong>You:</strong> {playerName}</p>
        </div>

        <div style={{ 
          backgroundColor: '#aaaae8ff', 
          padding: '20px', 
          borderRadius: '10px', 
          margin: '20px 0' 
        }}>
          <h3>Players in Room ({players.length}/{amountOfPlayersInRoom}):</h3>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {players.map((player, index) => (
              <li key={index} style={{ 
                padding: '8px', 
                backgroundColor: '#7e7eb7ff', 
                margin: '5px 0', 
                borderRadius: '5px' 
              }}>
                {player} {player === playerName && isHost ? '(Host)' : ''}
              </li>
            ))}
          </ul>
        </div>

        {isHost ? (
          <div>
            <p>You are the host! Start the game when everyone has joined.</p>
            <button 
              onClick={handleStartGame}
              style={{
                padding: '15px 30px',
                backgroundColor: '#e94560',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '18px',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              START GAME
            </button>
          </div>
        ) : (
          <div>
            <p>Waiting for host to start the game...</p>
            <div style={{ fontSize: '24px' }}>⏳</div>
          </div>
        )}

        <button 
          onClick={() => navigate('/lobby', { state: { playerName } })}
          style={{
            padding: '30px 50px',
            backgroundColor: '#ffffffff',
            color: 'black',
            border: 'none',
            borderRadius: '5px',
            marginTop: '20px',
            cursor: 'pointer'
          }}
        >
          Leave Room
        </button>
      </div>
    </div>
  );
};

export default WaitingRoom;
