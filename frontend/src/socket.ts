import { io } from 'socket.io-client';

const URL = import.meta.env.VITE_API_BASE_URL;
if (!URL) {
  throw new Error("VITE_API_BASE_URL is not defined");
}
console.log("Connecting to Socket.IO server at:", URL);

export const socket = io(URL);