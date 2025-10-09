# Guess The Song!

_A real-time multiplayer music guessing game built with Deezer_

[GitHub Repository](https://github.com/310assignment/guess-the-song)

> Developed as part of the University of Auckland SOFTENG 310 Assignment 1 (Semester 2, 2025)
> **Team: Butter** | Members: Eddie Kim, Lucas Jung, Caleb Jung, Jaeha Chang, Kevin Kim, Andrew Jeon

## What does this project do?

**Guess The Song!** is a web-based, real-time multiplayer game where players listen to short song previews and try to guess either the song title or artist as quickly as possible. It's built to make music discovery fun, social, and competitive.

### Features included in part 1

- Audio preview guessing
- Song caching and preview fetching from Deezer
- Timed guessing and scoring
- Selecting game mode and difficulty

---

## Why is this project useful?

- Promotes interactive music discovery in a playful environment
- Demonstrates how to build a full-stack real-time web application
- Provides a fun way to discover new music with friends
- Showcases modern web development technologies

---

## How do I get started?

### Prerequisites

- Node.js (v20 or higher) & npm

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/310assignment/guess-the-song
   cd guess-the-song
   ```

2. **Install dependencies**

   ```bash
   # Install backend dependencies
   cd backend
   npm install

   # Install frontend dependencies
   cd frontend
   npm install
   ```

3. **Set up environment variables**

   Create `.env` files in both `backend` directory and root directory of the project

   **server/.env:**

   ```env
   PORT=8080
   CACHE_TTL_MINUTES=30
   ```

   **root/.env:**

   ```env
   VITE_API_BASE_URL = "http://localhost:8080/"
   ```

### Running Locally

1. **Start the backend server**

   ```bash
   cd backend
   npm run dev
   ```

2. **Start the frontend (in another terminal)**

   ```bash
   cd frontend
   npm run dev
   ```

3. **Open your browser**
   Navigate to `http://localhost:8080`

### Testing & Deployment

**Testing:**

```bash
# Run tests (when implemented)
npm run test
```

**Deployment:**

- Application is in development - Has not been deployed yet

---

## How can the software be used?

This project is released under the **MIT License**. You're free to:

- Use, modify, and distribute the software
- Use it for commercial purposes
- Modify and distribute modified versions
- Use it privately

**Requirements:**

- Preserve the original license and copyright notices
- Include a copy of the MIT License in your distribution

---

## What versions are available?

### v0.1.0 – A1 Release

**Current Features:**

- Single-player mode
- Guess from single audio or mixed previews
- Timed guessing and scoring
- Song caching and preview fetching from Deezer (Genre set to K-pop)
- Game settings and customization
- Final results and winner display

### Future A2 Releases

**Planned Features:**

- Live multiplayer using Socket.io
- Game rooms and lobbies
- User authentication for storing history
- Leaderboards and statistics
- Enhanced UI/UX improvements

---

## Where can I get more help?

- **GitHub Wiki** - Meeting minutes, contributor list, additional usage guides
- **Issues** - Submit bugs and feature requests
- **Team Contact** - For technical help, contact the team via GitHub
- **Email** - Reach out to team members directly

---

## Tech Stack

**Frontend:**

- React.js
- HTML/CSS/TypeScript
- Socket.IO Client (not yet implemented)

**Backend:**

- Node.js
- Express.js
- Socket.IO Server (not yet implemented)
- PostgreSQL (not yet implemented)

**APIs & Services:**

- Deezer API
- Real-time communication via WebSockets (not yet implemented)

---

## Contributing

We welcome contributions! Please see our Contributing Guidelines for details on how to submit pull requests, report bugs, and suggest new features.

---

_Made by Team Butter_
