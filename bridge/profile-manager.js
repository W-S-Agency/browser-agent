// Profile Manager
// Manages multiple browser profiles and command execution

import crypto from 'crypto';
import logger from './logger.js';

export class ProfileManager {
  constructor() {
    this.profiles = new Map();
    this.aliases = new Map(); // Map alias -> profileId
    this.pendingCommands = new Map();
    this.activeProfileId = null;
  }

  // Register new profile
  registerProfile({ profileId, alias, authToken, browserInfo, websocket }) {
    // Validate auth token (basic validation for MVP)
    if (!authToken || authToken.length < 16) {
      throw new Error('Invalid auth token');
    }

    const profile = {
      id: profileId,
      alias: alias || null,
      authToken,
      browserInfo,
      websocket,
      isActive: false,
      isConnected: true,
      lastSeen: Date.now()
    };

    this.profiles.set(profileId, profile);

    // Store alias mapping if provided
    if (alias) {
      this.aliases.set(alias, profileId);
      logger.info('[ProfileManager] Registered alias', { alias, profileId });
    }

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

  // Get profile by ID or alias
  getProfile(profileIdOrAlias) {
    // Try direct profileId lookup first
    let profile = this.profiles.get(profileIdOrAlias);
    if (profile) return profile;

    // Try alias lookup
    const resolvedId = this.aliases.get(profileIdOrAlias);
    if (resolvedId) {
      return this.profiles.get(resolvedId);
    }

    return null;
  }

  // Resolve alias to profileId
  resolveProfileId(profileIdOrAlias) {
    // Check if it's already a valid profileId
    if (this.profiles.has(profileIdOrAlias)) {
      return profileIdOrAlias;
    }

    // Try to resolve as alias
    const resolvedId = this.aliases.get(profileIdOrAlias);
    if (resolvedId && this.profiles.has(resolvedId)) {
      return resolvedId;
    }

    return null;
  }

  // Update profile alias
  updateAlias(profileId, newAlias) {
    const profile = this.profiles.get(profileId);
    if (!profile) {
      throw new Error(`Profile not found: ${profileId}`);
    }

    // Remove old alias mapping if exists
    if (profile.alias) {
      this.aliases.delete(profile.alias);
    }

    // Update profile with new alias
    profile.alias = newAlias;

    // Add new alias mapping
    if (newAlias) {
      this.aliases.set(newAlias, profileId);
      logger.info('[ProfileManager] Updated alias', { profileId, newAlias });
    }

    return profile;
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

  // Execute command on profile (supports alias resolution)
  executeCommand(profileIdOrAlias, command, timeout = 30000) {
    // Resolve alias to profileId
    const profileId = this.resolveProfileId(profileIdOrAlias);
    if (!profileId) {
      throw new Error(`Profile not found: ${profileIdOrAlias}`);
    }

    const profile = this.profiles.get(profileId);
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
