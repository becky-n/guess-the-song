import axios from "axios";

export const deezer = axios.create({
  baseURL: "https://api.deezer.com",
  timeout: 10000,
});

// Deezer API client for fetching and processing song data
export async function deezerGet(path, { params = {} } = {}) {
  const { data } = await deezer.get(path, { params });
  return data;
}
