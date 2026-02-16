/**
 * Bridge Client
 * HTTP client for communicating with WebSocket Bridge Server
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

export class BridgeClient {
  private client: AxiosInstance;

  constructor(baseURL: string) {
    this.client = axios.create({
      baseURL,
      timeout: 35000, // 35s (command timeout is 30s)
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Execute command on browser
   */
  async executeCommand(command: any, profileId?: string): Promise<any> {
    try {
      const response = await this.client.post<CommandResult>('/execute', {
        command,
        profileId,
      });

      if (!response.data.success) {
        throw new Error(response.data.error || 'Command execution failed');
      }

      return response.data.result;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 404) {
          throw new Error(
            'No browser profile connected. Please make sure Chrome Extension is installed and running.'
          );
        }
        throw new Error(error.response?.data?.error || error.message);
      }
      throw error;
    }
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
}
