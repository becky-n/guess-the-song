import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import EnterName from './pages/EnterName'
import JoinRoom from './pages/JoinRoom'
import InGamePage from './pages/InGamePage'
import SettingsPage from './pages/SettingsPage'
import MultipleChoiceMode from './pages/MultipleChoiceMode'
import EndGamePage from './pages/EndGamePage'
import WaitingRoom from './pages/WaitingRoom';
import { socket } from './socket';
import { useEffect, useState } from 'react';


function App() {
  // const [fooEvents, setFooEvents] = useState([]);


  useEffect(() => {
    function onConnect() {
      console.log('Connected to server with ID:', socket.id);
    }

    function onDisconnect() {
      console.log('Disconnected from server');
    }

    // function onFooEvent(value) {
    //   setFooEvents(previous => [...previous, value]);
    // }

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    // socket.on('foo', onFooEvent);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      // socket.off('foo', onFooEvent);
    };
  }, []);

  return (
    <Router>
      <Routes>
        <Route path="/" element={<EnterName />} />
        <Route path="/room/:code" element={<InGamePage />} />
        <Route path="/waiting/:code" element={<WaitingRoom />} />
        <Route path="/lobby" element={<JoinRoom />} />
        <Route path="/create_room" element={<SettingsPage />} />
        <Route path="/game_mode_2" element={<MultipleChoiceMode />} />
        <Route path="/end_game" element={<EndGamePage />} />
      </Routes>
    </Router>
  )
}

export default App
