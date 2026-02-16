// Authentication module
// Generates and validates WebSocket authentication tokens

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TOKEN_FILE = path.join(__dirname, '.auth-token');

/**
 * Generate a new random authentication token
 */
function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Get or create authentication token
 * Token is persisted to file so Chrome Extension can read it
 */
export function getAuthToken() {
  try {
    // Try to read existing token
    if (fs.existsSync(TOKEN_FILE)) {
      const token = fs.readFileSync(TOKEN_FILE, 'utf8').trim();
      if (token && token.length === 64) {
        logger.info('Loaded existing auth token');
        return token;
      }
    }

    // Generate new token
    const token = generateToken();
    fs.writeFileSync(TOKEN_FILE, token, 'utf8');
    fs.chmodSync(TOKEN_FILE, 0o600); // Read/write only for owner
    logger.info('Generated new auth token', { tokenFile: TOKEN_FILE });
    return token;

  } catch (error) {
    logger.error('Failed to get/create auth token', { error: error.message });
    throw error;
  }
}

/**
 * Validate authentication token
 */
export function validateToken(token) {
  const validToken = getAuthToken();
  return token === validToken;
}

/**
 * Get auth token file path (for Chrome Extension to read)
 */
export function getAuthTokenPath() {
  return TOKEN_FILE;
}
