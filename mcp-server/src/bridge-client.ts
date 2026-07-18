/**
 * Bridge Client v2.0
 * HTTP client with auto-retry for Service Worker wake-up delays
 */

import axios, { AxiosInstance } from 'axios';

export interface BridgeHealth {
  status: string;
  uptime: number;
  profiles: number;
  activeProfile: string | null;
}

export interface Profile {
  id: string;
  alias: string | null;
  browserInfo: any;
  isActive: boolean;
  isConnected: boolean;
  lastSeen: number;
}

export interface CommandResult {
  success: boolean;
  result?: any;
  error?: string;
}

const RETRY_DELAY = 2000; // 2 seconds between retries
const MAX_RETRIES = 3;    // Wait up to 6 seconds for reconnect

export class BridgeClient {
  private client: AxiosInstance;
  private authToken: string | null = null;
  private tokenPromise: Promise<string | null> | null = null;

  constructor(baseURL: string) {
    this.client = axios.create({
      baseURL,
      timeout: 35000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Fetch (and cache) the bridge auth token. The bridge is loopback-only and
   * serves the token via GET /auth/token to localhost processes; mutating
   * endpoints (/execute) require it as X-Auth-Token (Safety v0 hardening).
   */
  private getAuthToken(force = false): Promise<string | null> {
    if (this.authToken && !force) return Promise.resolve(this.authToken);
    if (!this.tokenPromise) {
      // single in-flight fetch shared by concurrent callers
      this.tokenPromise = this.client
        .get<{ success: boolean; token: string }>('/auth/token')
        .then((r) => r.data?.token || null)
        .catch(() => null) // older bridge without auth — header simply omitted
        .then((token) => {
          this.authToken = token;
          this.tokenPromise = null;
          return token;
        });
    }
    return this.tokenPromise;
  }

  /**
   * Execute command on browser with auto-retry
   * If no profile connected (Service Worker sleeping), waits and retries
   */
  async executeCommand(command: any, profileId?: string): Promise<any> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const token = await this.getAuthToken();
        const response = await this.client.post<CommandResult>('/execute', {
          command,
          profileId,
        }, { headers: token ? { 'X-Auth-Token': token } : {} });

        if (!response.data.success) {
          throw new Error(response.data.error || 'Command execution failed');
        }

        return response.data.result;
      } catch (error) {
        if (axios.isAxiosError(error)) {
          // 401 = stale/missing token (bridge restarted with a new one) — refresh and retry
          if (error.response?.status === 401 && attempt < MAX_RETRIES) {
            await this.sleep(500); // avoid a tight 401 burst
            await this.getAuthToken(true);
            lastError = new Error('Bridge auth token was stale — refreshed');
            continue;
          }

          // 404 = no profile connected — Service Worker might be waking up
          if (error.response?.status === 404 && attempt < MAX_RETRIES) {
            console.error(
              `[BridgeClient] No profile connected (attempt ${attempt + 1}/${MAX_RETRIES + 1}). ` +
              `Waiting ${RETRY_DELAY}ms for Service Worker reconnect...`
            );
            lastError = new Error('No browser profile connected');
            await this.sleep(RETRY_DELAY);
            continue;
          }

          if (error.response?.status === 404) {
            throw new Error(
              'No browser profile connected after retries. Chrome Extension Service Worker may have stopped. ' +
              'Try: 1) Open chrome://extensions/ and reload Browser Agent, 2) Check the extension icon shows green checkmark.'
            );
          }

          throw new Error(error.response?.data?.error || error.message);
        }
        throw error;
      }
    }

    throw lastError || new Error('Command failed after retries');
  }

  /**
   * List connected profiles
   */
  async listProfiles(): Promise<Profile[]> {
    const response = await this.client.get<{ profiles: Profile[] }>('/profiles');
    return response.data.profiles;
  }

  /**
   * Check Bridge Server health
   */
  async checkHealth(): Promise<BridgeHealth> {
    const response = await this.client.get<BridgeHealth>('/health');
    return response.data;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
