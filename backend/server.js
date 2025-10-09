//entry point for the Express server
// This file sets up the server, handles routes, and integrates with the Deezer API client

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import trackRoutes from "./routes/trackRoutes.js";
import { createServer } from "http";
import { Server } from "socket.io"; 
import kpopRoutes from "./routes/kpopRoutes.js";
import { console } from "inspector";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.disable("x-powered-by");

// K-Pop endpoints
app.use("/api/tracks", trackRoutes);

// tiny error handler
app.use((err, _req, res, _next) => {
  const status = err?.response?.status || 502;
  const msg =
    err?.response?.data?.error?.message || err?.message || "Upstream error";
  res.status(status).json({ error: msg });
});

const port = process.env.PORT || 8080;

// create HTTP server
const httpServer = createServer(app);

// attach Socket.IO
const io = new Server(httpServer, {
  cors: {
    origin: "*", // allow React frontend
    methods: ["GET", "POST"],
  },
});

// Store room data
const rooms = new Map();

// Helper function to initialize player score data
const initializePlayerScore = (playerName) => ({
  name: playerName,
  points: 0,
  previousPoints: 0,
  correctAnswers: 0
});

//  handle connections
io.on("connection", (socket) => {
  console.log("New client connected:", socket.id);

  socket.on("create-room", ({ code, settings, host }) => {

    socket.join(code);

    // Initialize room if it doesn't exist (with default settings)
    if (!rooms.has(code)) {
      console.log(`Creating new room ${code} with default settings`);
      const room = {
        players: [], 
        playerScores: new Map(), // Store player scores: playerName -> score object
        maxPlayers: settings.amountOfPlayers || 8, // default max players
        settings,
        host
      }
      rooms.set(code, room);

      socket.emit("room-created", { code, rooms: Object.fromEntries(rooms.entries()) });
    }
  });

  // join room event
  socket.on("join", ({ code, playerName }) => {
    console.log(`${playerName} attempting to join room ${code}`);

    socket.join(code);

    const room = rooms.get(code);

    if(!room) {
      socket.emit("join-error", { 
        message: `Room ${code} doesn't exist!` 
      });
      return;
    }
    
    // Check if room is full
    if (room.players.length >= room.maxPlayers) {
      console.log(`${playerName} tried to join full room ${code} (${room.players.length}/${room.maxPlayers})`);
      socket.emit("join-error", { 
        message: `Room is full! (${room.players.length}/${room.maxPlayers} players)` 
      });
      return;
    }
    
    // Check for duplicate names
    if (room.players.includes(playerName)) {
      console.log(`${playerName} tried to join room ${code} but name already exists`);
      socket.emit("join-error", { 
        message: `Player name "${playerName}" is already in this room!` 
      });
      return;
    }
    
    // Store player info for cleanup
    socket.playerName = playerName;
    socket.roomCode = code;
    
    // Add player to room
    room.players.push(playerName);
    
    // Initialize player score if not exists
    if (!room.playerScores) {
      room.playerScores = new Map();
    }
    if (!room.playerScores.has(playerName)) {
      room.playerScores.set(playerName, initializePlayerScore(playerName));
    }
    
    console.log(`${playerName} joined room ${code}. Players (${room.players.length}/${room.maxPlayers}):`, room.players);
    
    // Also send updated scores if available
    if (room.playerScores && room.playerScores.size > 0) {
      const allScores = Array.from(room.playerScores.values());
      io.to(code).emit("score-update", allScores);
    }
    
    // Send success confirmation to the joining player
    io.to(code).emit("join-success", { 
      roomCode: code, 
      playerName,
      players: room.players,
      maxPlayers: room.maxPlayers,
      amountOfPlayersInRoom: room.settings.amountOfPlayers, // default to 8 if not set,
      playerScores: Array.from(room.playerScores.values())
    });
    
    // Send current scores to the new player
    if (room.playerScores && room.playerScores.size > 0) {
      const allScores = Array.from(room.playerScores.values());
      socket.emit("score-update", allScores);
    }
  });

  socket.on('get-room-players-scores', ( code ) => {
    socket.join(code);

    const room = rooms.get(code);

    io.to(code).emit("room-players-scores", Array.from(room.playerScores.values()) || []);
  });

  socket.on('get-total-rounds', ( code ) => {
    socket.join(code);

    const room = rooms.get(code);

    socket.emit("total-rounds", room.settings.rounds);
  });


  socket.on('get-rooms', ( code ) => {
    socket.join(code);

    io.to(code).emit("rooms", Object.fromEntries(rooms.entries()));
    // socket.emit("rooms", Object.fromEntries(rooms.entries()));
  });

  // Handle score updates from players
  socket.on("update-score", ({ code, playerName, points, correctAnswers }) => {
  console.log(`🔍 DEBUG Backend received update-score:`, { 
    code, 
    playerName, 
    points, 
    correctAnswers,
    pointsType: typeof points,
    correctAnswersType: typeof correctAnswers
  });
    const room = rooms.get(code);
    if (!room || !room.playerScores){
          console.log(`❌ DEBUG: Room not found or no playerScores for code: ${code}`);
    return;
  }

    const playerScore = room.playerScores.get(playerName);
    if (playerScore) {
      playerScore.previousPoints = playerScore.points;
      playerScore.points = points;
      playerScore.correctAnswers = correctAnswers;

      console.log(`🔍 DEBUG: After update - playerScore:`, playerScore);
      
      console.log(`Score updated for ${playerName}: ${points} points, ${correctAnswers} correct`);
      
      // Send updated scores to all players in the room
      const allScores = Array.from(room.playerScores.values());
      io.to(code).emit("score-update", allScores);
    }
  });

  // Handle host continuing to next round
  socket.on("host-continue-round", ({ code, nextRound, totalRounds }) => {
    console.log(`Host in room ${code} continuing to round ${nextRound}`);
    
    // Emit to all players in the room (including host)
    socket.to(code).emit("continue-to-next-round", { nextRound });
    socket.emit("continue-to-next-round", { nextRound }); // Also send to host
  });

  // Handle host ending the game
  socket.on("host-end-game", ({ code }) => {
    console.log(`Host in room ${code} ending the game`);
    
    // Navigate all players to end game page
    socket.to(code).emit("navigate-to-end-game");
    socket.emit("navigate-to-end-game"); // Also send to host
  });

  // host starts game event
  socket.on("start-game", ({ code }) => {
    socket.join(code);
    const room = rooms.get(code);

    console.log(`Game started in room ${code}`);
    io.to(code).emit("game-started", room.settings);
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
    
    // Clean up player from room if they were in one
    if (socket.playerName && socket.roomCode && rooms.has(socket.roomCode)) {
      const room = rooms.get(socket.roomCode);
      const playerIndex = room.players.indexOf(socket.playerName);
      if (playerIndex > -1) {
        room.players.splice(playerIndex, 1);
        console.log(`${socket.playerName} left room ${socket.roomCode}. Remaining players:`, room.players);
        
        // Update remaining players
        io.to(socket.roomCode).emit("players-updated", { 
          players: room.players, 
          maxPlayers: room.maxPlayers 
        });
        
        // Clean up empty rooms
        if (room.players.length === 0) {
          rooms.delete(socket.roomCode);
          console.log(`Room ${socket.roomCode} deleted - no players left`);
        }
      }
    }
  });
});

httpServer.listen(port, "0.0.0.0", () => {
});
