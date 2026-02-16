// Browser Agent Bridge Server
// WebSocket + HTTP server that connects Chrome Extension with MCP Server

import { WebSocketServer } from 'ws';
import express from 'express';
import cors from 'cors';
import { ProfileManager } from './profile-manager.js';
import logger from './logger.js';
import { getAuthToken, validateToken, getAuthTokenPath } from './auth.js';
import { URL } from 'url';

const PORT = 18792;
const HTTP_PORT = 18793;

// Initialize authentication token
const authToken = getAuthToken();
logger.info('[Bridge] Auth token ready', { tokenPath: getAuthTokenPath() });

// Initialize
const app = express();
const profileManager = new ProfileManager();

// Middleware
app.use(cors({ origin: 'http://localhost' }));
app.use(express.json());

// WebSocket Server
const wss = new WebSocketServer({ port: PORT });

logger.info(`[Bridge] WebSocket Server listening on ws://localhost:${PORT}`);

// Handle WebSocket connections from Chrome Extensions
wss.on('connection', (ws, req) => {
  // Parse URL to extract token
  const url = new URL(req.url, `ws://localhost:${PORT}`);
  const token = url.searchParams.get('token');

  // Validate authentication token
  if (!validateToken(token)) {
    logger.warn('[Bridge] Unauthorized WebSocket connection attempt', {
      from: req.socket.remoteAddress,
      token: token ? 'invalid' : 'missing'
    });
    ws.close(1008, 'Unauthorized: Invalid or missing authentication token');
    return;
  }

  logger.info('[Bridge] Authenticated WebSocket connection', { from: req.socket.remoteAddress });

  let profile = null;

  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data.toString());

      // Handle registration
      if (message.type === 'register') {
        profile = profileManager.registerProfile({
          profileId: message.profileId,
          authToken: message.authToken,
          browserInfo: message.browserInfo,
          websocket: ws
        });

        logger.info('[Bridge] Profile registered:', profile.id);

        // Send confirmation
        ws.send(JSON.stringify({
          type: 'registered',
          success: true,
          profileId: profile.id
        }));

        return;
      }

      // Handle command responses
      if (message.id) {
        // Store response for pending command
        profileManager.handleResponse(profile.id, message);
      }

    } catch (error) {
      logger.error('[Bridge] Error handling WebSocket message:', error);
    }
  });

  ws.on('close', () => {
    if (profile) {
      logger.info('[Bridge] Profile disconnected:', profile.id);
      profileManager.unregisterProfile(profile.id);
    }
  });

  ws.on('error', (error) => {
    logger.error('[Bridge] WebSocket error:', error);
  });
});

// HTTP API for MCP Server
app.post('/execute', async (req, res) => {
  try {
    const { command, profileId, timeout = 30000 } = req.body;

    logger.info(`[Bridge] Executing command: ${command.type} (profile: ${profileId || 'active'})`);

    // Get target profile
    const profile = profileId
      ? profileManager.getProfile(profileId)
      : profileManager.getActiveProfile();

    if (!profile) {
      return res.status(404).json({
        success: false,
        error: 'No active profile found. Make sure Chrome Extension is running.'
      });
    }

    // Execute command
    const result = await profileManager.executeCommand(profile.id, command, timeout);

    res.json({
      success: true,
      result
    });

  } catch (error) {
    logger.error('[Bridge] Command execution failed:', error);

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Auth token endpoint (localhost only)
app.get('/auth/token', (req, res) => {
  // Only allow requests from localhost for security
  const clientIp = req.socket.remoteAddress;
  if (clientIp !== '127.0.0.1' && clientIp !== '::1' && clientIp !== '::ffff:127.0.0.1') {
    logger.warn('[Bridge] Auth token request from non-localhost', { ip: clientIp });
    return res.status(403).json({
      success: false,
      error: 'Forbidden: Token endpoint only accessible from localhost'
    });
  }

  res.json({
    success: true,
    token: authToken
  });
});

app.get('/profiles', (req, res) => {
  const profiles = profileManager.listProfiles();

  res.json({
    success: true,
    profiles: profiles.map(p => ({
      id: p.id,
      browserInfo: p.browserInfo,
      isActive: p.isActive,
      isConnected: p.isConnected,
      lastSeen: p.lastSeen
    }))
  });
});

app.get('/health', (req, res) => {
  const profiles = profileManager.listProfiles();

  res.json({
    status: 'ok',
    uptime: process.uptime(),
    profiles: profiles.length,
    activeProfile: profileManager.getActiveProfile()?.id || null
  });
});

// Start HTTP server
app.listen(HTTP_PORT, () => {
  logger.info(`[Bridge] HTTP API listening on http://localhost:${HTTP_PORT}`);
  logger.info('[Bridge] Ready to accept connections');
});

// Handle shutdown
process.on('SIGINT', () => {
  logger.info('\n[Bridge] Shutting down...');
  wss.close();
  process.exit(0);
});
