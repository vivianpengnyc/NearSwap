import { sha256 } from 'js-sha256';
import { NearAPI } from './near-api';
import BN from 'bn.js';

export interface HTLCParams {
  sender: string;
  receiver: string;
  amount: string; // in yoctoNEAR
  secret?: string;
  hashlock?: string;
  timelock: number; // Unix timestamp in seconds
}

export interface HTLCDetails {
  htlcId: string;
  sender: string;
  receiver: string;
  amount: string;
  hashlock: string;
  timelock: number;
  withdrawn: boolean;
  refunded: boolean;
  secret?: string;
}

export class HTLCBuilder {
  private nearAPI: NearAPI;

  constructor(nearAPI: NearAPI) {
    this.nearAPI = nearAPI;
  }

  /**
   * Generate a random secret for HTLC
   */
  static generateSecret(): string {
    const bytes = new Uint8Array(32);
    if (typeof window !== 'undefined' && window.crypto) {
      window.crypto.getRandomValues(bytes);
    } else {
      // Node.js environment
      const crypto = require('crypto');
      crypto.randomFillSync(bytes);
    }
    return Buffer.from(bytes).toString('hex');
  }

  /**
   * Generate hashlock from secret
   */
  static generateHashlock(secret: string): string {
    return sha256(secret);
  }

  /**
   * Create an HTLC on NEAR
   */
  async createHTLC(params: HTLCParams): Promise<string> {
    // Validate parameters
    if (!params.secret && !params.hashlock) {
      throw new Error('Either secret or hashlock must be provided');
    }

    const hashlock = params.hashlock || HTLCBuilder.generateHashlock(params.secret!);
    
    // Validate timelock is in the future
    const currentTime = Math.floor(Date.now() / 1000);
    if (params.timelock <= currentTime) {
      throw new Error('Timelock must be in the future');
    }

    // Create HTLC on NEAR
    const htlcId = await this.nearAPI.createHTLC(
      params.receiver,
      hashlock,
      params.timelock,
      params.amount
    );

    return htlcId;
  }

  /**
   * Withdraw from HTLC using secret
   */
  async withdraw(htlcId: string, secret: string): Promise<any> {
    return await this.nearAPI.withdrawHTLC(htlcId, secret);
  }

  /**
   * Refund HTLC after timelock expires
   */
  async refund(htlcId: string): Promise<any> {
    return await this.nearAPI.refundHTLC(htlcId);
  }

  /**
   * Get HTLC details
   */
  async getHTLCDetails(htlcId: string): Promise<HTLCDetails | null> {
    const htlc = await this.nearAPI.getHTLC(htlcId);
    
    if (!htlc) {
      return null;
    }

    return {
      htlcId,
      sender: htlc.sender,
      receiver: htlc.receiver,
      amount: htlc.amount,
      hashlock: htlc.hashlock,
      timelock: htlc.timelock,
      withdrawn: htlc.withdrawn,
      refunded: htlc.refunded,
      secret: htlc.secret,
    };
  }

  /**
   * Monitor HTLC status
   */
  async waitForHTLCEvent(
    htlcId: string,
    eventType: 'withdrawn' | 'refunded',
    timeoutMs: number = 300000
  ): Promise<HTLCDetails> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      const htlc = await this.getHTLCDetails(htlcId);
      
      if (!htlc) {
        throw new Error('HTLC not found');
      }
      
      if (eventType === 'withdrawn' && htlc.withdrawn) {
        return htlc;
      }
      
      if (eventType === 'refunded' && htlc.refunded) {
        return htlc;
      }
      
      // Wait 2 seconds before checking again
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    throw new Error(`Timeout waiting for HTLC ${eventType} event`);
  }

  /**
   * Validate that a secret matches a hashlock
   */
  static validateSecret(secret: string, hashlock: string): boolean {
    return HTLCBuilder.generateHashlock(secret) === hashlock;
  }

  /**
   * Calculate remaining time until timelock expires
   */
  static getRemainingTime(timelock: number): number {
    const currentTime = Math.floor(Date.now() / 1000);
    return Math.max(0, timelock - currentTime);
  }

  /**
   * Format NEAR amount for display
   */
  static formatAmount(yoctoNear: string): string {
    return NearAPI.formatNearAmount(yoctoNear);
  }

  /**
   * Parse NEAR amount from string
   */
  static parseAmount(nearAmount: string): string {
    return NearAPI.parseNearAmount(nearAmount);
  }
}