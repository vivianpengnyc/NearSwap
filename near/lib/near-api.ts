import { connect, keyStores, KeyPair, Contract, WalletConnection, utils } from 'near-api-js';
import { FinalExecutionOutcome } from 'near-api-js/lib/providers';
import BN from 'bn.js';

export interface NearConfig {
  networkId: string;
  nodeUrl: string;
  contractId: string;
  accountId?: string;
  privateKey?: string;
}

export class NearAPI {
  private config: NearConfig;
  private near: any;
  private account: any;
  private contract: any;

  constructor(config: NearConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    const keyStore = new keyStores.InMemoryKeyStore();
    
    if (this.config.privateKey && this.config.accountId) {
      const keyPair = KeyPair.fromString(this.config.privateKey);
      await keyStore.setKey(this.config.networkId, this.config.accountId, keyPair);
    }

    const nearConfig = {
      networkId: this.config.networkId,
      keyStore,
      nodeUrl: this.config.nodeUrl,
      walletUrl: `https://wallet.${this.config.networkId}.near.org`,
      helperUrl: `https://helper.${this.config.networkId}.near.org`,
      explorerUrl: `https://explorer.${this.config.networkId}.near.org`,
    };

    this.near = await connect(nearConfig);
    
    if (this.config.accountId) {
      this.account = await this.near.account(this.config.accountId);
    }

    // Initialize contract
    this.contract = new Contract(this.account, this.config.contractId, {
      viewMethods: ['get_htlc'],
      changeMethods: ['create_htlc', 'withdraw', 'refund'],
    });
  }

  async getAccountBalance(accountId: string): Promise<string> {
    const account = await this.near.account(accountId);
    const balance = await account.getAccountBalance();
    return balance.available;
  }

  async createHTLC(
    receiver: string,
    hashlock: string,
    timelock: number,
    amount: string
  ): Promise<string> {
    if (!this.account) {
      throw new Error('Account not initialized');
    }

    const result = await this.account.functionCall({
      contractId: this.config.contractId,
      methodName: 'create_htlc',
      args: {
        receiver,
        hashlock,
        timelock,
      },
      gas: new BN('100000000000000'), // 100 TGas
      attachedDeposit: new BN(amount),
    });

    return this.extractHTLCId(result);
  }

  async withdrawHTLC(htlcId: string, secret: string): Promise<FinalExecutionOutcome> {
    if (!this.account) {
      throw new Error('Account not initialized');
    }

    return await this.account.functionCall({
      contractId: this.config.contractId,
      methodName: 'withdraw',
      args: {
        htlc_id: htlcId,
        secret,
      },
      gas: new BN('100000000000000'), // 100 TGas
    });
  }

  async refundHTLC(htlcId: string): Promise<FinalExecutionOutcome> {
    if (!this.account) {
      throw new Error('Account not initialized');
    }

    return await this.account.functionCall({
      contractId: this.config.contractId,
      methodName: 'refund',
      args: {
        htlc_id: htlcId,
      },
      gas: new BN('100000000000000'), // 100 TGas
    });
  }

  async getHTLC(htlcId: string): Promise<any> {
    return await this.contract.get_htlc({ htlc_id: htlcId });
  }

  async getTransactionStatus(txHash: string): Promise<FinalExecutionOutcome> {
    const [hash, accountId] = txHash.split(':');
    return await this.near.connection.provider.txStatus(hash, accountId);
  }

  async waitForTransaction(txHash: string, waitUntil: 'INCLUDED' | 'EXECUTED' | 'FINAL' = 'EXECUTED'): Promise<FinalExecutionOutcome> {
    const [hash, accountId] = txHash.split(':');
    
    while (true) {
      try {
        const result = await this.near.connection.provider.txStatus(hash, accountId);
        
        if (waitUntil === 'INCLUDED' && result.status) {
          return result;
        }
        if (waitUntil === 'EXECUTED' && result.receipts_outcome) {
          return result;
        }
        if (waitUntil === 'FINAL' && result.status && result.status.SuccessValue !== undefined) {
          return result;
        }
      } catch (error) {
        // Transaction might not be available yet
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  private extractHTLCId(result: FinalExecutionOutcome): string {
    // Extract HTLC ID from logs or return value
    const logs = result.receipts_outcome[0]?.outcome?.logs || [];
    for (const log of logs) {
      if (log.includes('HTLC created:')) {
        return log.split(':')[1].trim();
      }
    }
    
    // If not in logs, try to decode return value
    const returnValue = result.status?.SuccessValue;
    if (returnValue) {
      return Buffer.from(returnValue, 'base64').toString();
    }
    
    throw new Error('Could not extract HTLC ID from transaction result');
  }

  // Utility functions
  static parseNearAmount(amount: string): string {
    return utils.format.parseNearAmount(amount) || '0';
  }

  static formatNearAmount(amount: string): string {
    return utils.format.formatNearAmount(amount);
  }
}