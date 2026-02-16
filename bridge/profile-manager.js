// Profile Manager
// Manages multiple browser profiles and command execution

import crypto from 'crypto';
import logger from './logger.js';

export class ProfileManager {
  constructor() {
    this.profiles = new Map();
    this.pendingCommands = new Map();
    this.activeProfileId = null;
  }

  // Register new profile
  registerProfile({ profileId, authToken, browserInfo, websocket }) {
    // Validate auth token (basic validation for MVP)
    if (!authToken || authToken.length < 16) {
      throw new Error('Invalid auth token');
    }

    const profile = {
      id: profileId,
      authToken,
      browserInfo,
      websocket,
      isActive: false,
      isConnected: true,
      lastSeen: Date.now()
    };

    this.profiles.set(profileId, profile);

    // Set as active if first profile
    if (this.profiles.size === 1) {
      this.setActiveProfile(profileId);
    }

    return profile;
  }

  // Unregister profile
  unregisterProfile(profileId) {
    const profile = this.profiles.get(profileId);
    if (profile) {
      profile.isConnected = false;

      // Remove if no pending commands
      const pendingCount = Array.from(this.pendingCommands.values())
        .filter(cmd => cmd.profileId === profileId).length;

      if (pendingCount === 0) {
        this.profiles.delete(profileId);
      }

      // Switch active profile if needed
      if (this.activeProfileId === profileId) {
        const connected = this.listProfiles().find(p => p.isConnected);
        this.activeProfileId = connected?.id || null;
      }
    }
  }

  // Get profile by ID
  getProfile(profileId) {
    return this.profiles.get(profileId);
  }

  // Get active profile
  getActiveProfile() {
    if (this.activeProfileId) {
      return this.profiles.get(this.activeProfileId);
    }

    // Return first connected profile
    const connected = this.listProfiles().find(p => p.isConnected);
    return connected || null;
  }

  // Set active profile
  setActiveProfile(profileId) {
    const profile = this.profiles.get(profileId);
    if (!profile) {
      throw new Error(`Profile not found: ${profileId}`);
    }

    // Deactivate previous
    if (this.activeProfileId) {
      const prev = this.profiles.get(this.activeProfileId);
      if (prev) prev.isActive = false;
    }

    // Activate new
    profile.isActive = true;
    this.activeProfileId = profileId;

    return profile;
  }

  // List all profiles
  listProfiles() {
    return Array.from(this.profiles.values());
  }

  // Execute command on profile
  executeCommand(profileId, command, timeout = 30000) {
    const profile = this.profiles.get(profileId);
    if (!profile) {
      throw new Error(`Profile not found: ${profileId}`);
    }

    if (!profile.isConnected) {
      throw new Error(`Profile not connected: ${profileId}`);
    }

    // Generate command ID
    const commandId = this.generateCommandId();
    command.id = commandId;

    // Send command to extension
    profile.websocket.send(JSON.stringify(command));

    // Wait for response
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.pendingCommands.delete(commandId);
        reject(new Error(`Command timeout: ${command.type}`));
      }, timeout);

      this.pendingCommands.set(commandId, {
        profileId,
        command,
        resolve,
        reject,
        timeoutId
      });
    });
  }

  // Handle command response from extension
  handleResponse(profileId, response) {
    const pending = this.pendingCommands.get(response.id);
    if (!pending) {
      logger.warn('[ProfileManager] Received response for unknown command', { commandId: response.id });
      return;
    }

    // Clear timeout
    clearTimeout(pending.timeoutId);

    // Resolve/reject promise
    if (response.success) {
      pending.resolve(response.result);
    } else {
      pending.reject(new Error(response.error || 'Command failed'));
    }

    // Remove from pending
    this.pendingCommands.delete(response.id);

    // Update last seen
    const profile = this.profiles.get(profileId);
    if (profile) {
      profile.lastSeen = Date.now();
    }
  }

  // Generate unique command ID
  generateCommandId() {
    return `cmd_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }
}
