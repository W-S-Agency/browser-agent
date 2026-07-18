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

// DNS-rebinding guard: loopback bind + token do NOT stop a malicious web page
// whose domain re-resolves to 127.0.0.1 — its requests are same-origin (it can
// read /auth/token, then POST /execute). A loopback Host allowlist closes this.
const LOOPBACK_HOSTS = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i;
app.use((req, res, next) => {
  if (!LOOPBACK_HOSTS.test(req.headers.host || '')) {
    logger.warn('[Bridge] Rejected non-loopback Host header (DNS rebinding guard)', {
      host: req.headers.host, path: req.path
    });
    return res.status(403).json({ success: false, error: 'Forbidden: bad Host header' });
  }
  next();
});

// Auth for mutating HTTP endpoints (Safety v0 transport hardening).
// GET endpoints stay open: the server binds to 127.0.0.1 only, and the
// extension bootstraps by fetching /auth/token without a token.
function requireAuth(req, res, next) {
  const token = req.headers['x-auth-token'];
  if (!validateToken(token)) {
    logger.warn('[Bridge] Unauthorized HTTP request', {
      path: req.path,
      ip: req.socket.remoteAddress,
      token: token ? 'invalid' : 'missing'
    });
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: missing or invalid X-Auth-Token header. Fetch the token from GET /auth/token (localhost only).'
    });
  }
  next();
}

// WebSocket Server — loopback only: real logged-in browser sessions must not
// be reachable from the LAN. Bind BOTH loopbacks: "localhost" resolves to
// ::1 on modern Node clients and to 127.0.0.1 in Chrome — IPv4-only binding
// breaks the former (verified live 18.07: ECONNREFUSED ::1).
// NOTE: listen/bind errors are emitted ASYNC as an 'error' event — a try/catch
// around the constructor catches nothing and an unhandled 'error' crashes the
// process. Handle the event (mirrors the http6 pattern below).
const wss = new WebSocketServer({ port: PORT, host: '127.0.0.1' });
wss.on('error', (e) => logger.error('[Bridge] WS server error (IPv4 loopback)', { error: e.message }));
wss.on('listening', () => logger.info(`[Bridge] WebSocket Server listening on ws://127.0.0.1:${PORT}`));
const wss6 = new WebSocketServer({ port: PORT, host: '::1' });
wss6.on('error', (e) => logger.warn('[Bridge] IPv6 loopback WS bind unavailable, IPv4 only', { error: e.message }));
wss6.on('listening', () => logger.info(`[Bridge] WebSocket Server also listening on ws://[::1]:${PORT}`));

// Handle WebSocket connections from Chrome Extensions
const handleWsConnection = (ws, req) => {
  // DNS-rebinding guard (same rationale as the HTTP middleware above)
  if (!LOOPBACK_HOSTS.test(req.headers.host || '')) {
    logger.warn('[Bridge] Rejected WS with non-loopback Host header (DNS rebinding guard)', { host: req.headers.host });
    ws.close(1008, 'Forbidden: bad Host header');
    return;
  }

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
          alias: message.alias,
          authToken: message.authToken,
          browserInfo: message.browserInfo,
          websocket: ws
        });

        logger.info('[Bridge] Profile registered', {
          id: profile.id,
          alias: profile.alias || 'none'
        });

        // Send confirmation
        ws.send(JSON.stringify({
          type: 'registered',
          success: true,
          profileId: profile.id
        }));

        return;
      }

      // Handle alias update
      if (message.type === 'update_alias') {
        if (!profile) {
          logger.warn('[Bridge] Received update_alias before registration');
          return;
        }

        profileManager.updateAlias(message.profileId, message.alias);

        logger.info('[Bridge] Profile alias updated', {
          id: message.profileId,
          alias: message.alias
        });

        // Send confirmation
        ws.send(JSON.stringify({
          type: 'alias_updated',
          success: true
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
};
wss.on('connection', handleWsConnection);
wss6.on('connection', handleWsConnection);

// HTTP API for MCP Server
app.post('/execute', requireAuth, async (req, res) => {
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
      alias: p.alias || null,
      browserInfo: p.browserInfo,
      isActive: p.isActive,
      isConnected: p.isConnected,
      lastSeen: p.lastSeen
    }))
  });
});

// Set profile alias
app.post('/profiles/:profileId/alias', requireAuth, async (req, res) => {
  try {
    const { profileId } = req.params;
    const { alias } = req.body;

    if (!alias) {
      return res.status(400).json({
        success: false,
        error: 'Alias is required'
      });
    }

    // Validate alias format
    if (!/^[a-z0-9-]+$/.test(alias)) {
      return res.status(400).json({
        success: false,
        error: 'Alias must contain only lowercase letters, numbers, and hyphens'
      });
    }

    // Resolve profileId (in case it's already an alias)
    const resolvedId = profileManager.resolveProfileId(profileId);
    if (!resolvedId) {
      return res.status(404).json({
        success: false,
        error: `Profile not found: ${profileId}`
      });
    }

    // Update alias
    const profile = profileManager.updateAlias(resolvedId, alias);

    res.json({
      success: true,
      profile: {
        id: profile.id,
        alias: profile.alias
      }
    });

  } catch (error) {
    logger.error('[Bridge] Failed to set alias:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
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

// Start HTTP server — loopback only, both stacks (see WebSocket note above)
app.listen(HTTP_PORT, '127.0.0.1', () => {
  logger.info(`[Bridge] HTTP API listening on http://127.0.0.1:${HTTP_PORT}`);
  logger.info('[Bridge] Ready to accept connections');
});
const http6 = app.listen(HTTP_PORT, '::1', () => {
  logger.info(`[Bridge] HTTP API also listening on http://[::1]:${HTTP_PORT}`);
});
http6.on('error', (e) => {
  logger.warn('[Bridge] IPv6 loopback HTTP bind unavailable, IPv4 only', { error: e.message });
});

// Handle shutdown
process.on('SIGINT', () => {
  logger.info('\n[Bridge] Shutting down...');
  wss.close();
  wss6.close();
  process.exit(0);
});
