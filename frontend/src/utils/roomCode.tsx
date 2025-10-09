/**
 * Generates a random room code (6 characters, alphanumeric)
 */
export const generateRoomCode = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  
  // Use crypto.getRandomValues for better randomness
  const randomArray = new Uint8Array(6);
  crypto.getRandomValues(randomArray);
  
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(randomArray[i] % chars.length);
  }
  return result;
};

/**
 * Validates if a room code has the correct format
 */
export const isValidRoomCode = (code: string): boolean => {
  return /^[A-Z0-9]{6}$/.test(code);
};