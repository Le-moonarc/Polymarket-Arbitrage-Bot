/**
 * Trading Bot Module
 * 
 * Main trading interface for Polymarket with order placement,
 * cancellation, and position management.
 */

import { Config } from './config';
import { OrderSigner } from './signer';
import { ClobClient, RelayerClient, ApiCredentials } from './client';
import { Order, OrderResult, OrderSide, OrderType } from '../types';

export class TradingBotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TradingBotError';
  }
}

export class NotInitializedError extends TradingBotError {
  constructor(message: string) {
    super(message);
    this.name = 'NotInitializedError';
  }
}

export class TradingBot {
  private signer?: OrderSigner;
  private clobClient?: ClobClient;
  private relayerClient?: RelayerClient;
  private apiCreds?: ApiCredentials;
  public readonly config: Config;

  constructor(
    configPath?: string,
    config?: Config,
    safeAddress?: string,
    builderCreds?: any,
    privateKey?: string,
    encryptedKeyPath?: string,
    password?: string,
    apiCredsPath?: string,
    logLevel: string = 'INFO'
  ) {
    // Load configuration
    if (configPath) {
      this.config = Config.load(configPath);
    } else if (config) {
      this.config = config;
    } else {
      this.config = new Config();
    }

    // Override with provided parameters
    if (safeAddress) {
      this.config.safeAddress = safeAddress.toLowerCase();
    }
    if (builderCreds) {
      this.config.builder = builderCreds;
      this.config.useGasless = true;
    }

    // Initialize components
    if (privateKey) {
      this.signer = new OrderSigner(privateKey);
    } else if (encryptedKeyPath && password) {
      this.loadEncryptedKey(encryptedKeyPath, password);
    }

    // Load API credentials
    if (apiCredsPath) {
      this.loadApiCreds(apiCredsPath);
    }

    // Initialize API clients
    this.initClients();

    // Auto-derive API credentials if we have a signer but no API creds
    if (this.signer && !this.apiCreds) {
      this.deriveApiCreds();
    }
  }

  private loadEncryptedKey(filepath: string, password: string): void {
    // TODO: Implement encrypted key loading
    throw new TradingBotError('Encrypted key loading not yet implemented');
  }

  private loadApiCreds(filepath: string): void {
    // TODO: Implement API credentials loading
    // For now, skip
  }

  private async deriveApiCreds(): Promise<void> {
    if (!this.signer || !this.clobClient) {
      return;
    }

    try {
      this.apiCreds = await this.clobClient.createOrDeriveApiKey(this.signer);
      this.clobClient.setApiCreds(this.apiCreds);
    } catch (error: any) {
      console.warn(`Failed to derive API credentials: ${error.message}`);
    }
  }

  private initClients(): void {
    // CLOB client
    this.clobClient = new ClobClient(
      this.config.clob.host,
      this.config.clob.chainId,
      this.config.clob.signatureType,
      this.config.safeAddress,
      this.apiCreds,
      this.config.useGasless ? this.config.builder : undefined
    );

    // Relayer client (for gasless)
    if (this.config.useGasless) {
      this.relayerClient = new RelayerClient(
        this.config.relayer.host,
        this.config.clob.chainId,
        this.config.builder,
        this.config.relayer.txType
      );
    }
  }

  isInitialized(): boolean {
    return !!(
      this.signer &&
      this.config.safeAddress &&
      this.clobClient
    );
  }

  private requireSigner(): OrderSigner {
    if (!this.signer) {
      throw new NotInitializedError(
        'Signer not initialized. Provide privateKey or encryptedKey.'
      );
    }
    return this.signer;
  }

  async placeOrder(
    tokenId: string,
    price: number,
    size: number,
    side: OrderSide,
    orderType: OrderType = 'GTC',
    feeRateBps: number = 0
  ): Promise<OrderResult> {
    const signer = this.requireSigner();

    try {
      // Create order
      const order: Order = {
        tokenId,
        price,
        size,
        side,
        maker: this.config.safeAddress,
        feeRateBps,
      };

      // Sign order
      const signed = signer.signOrder(order);

      // Submit to CLOB
      const response = await this.clobClient!.postOrder(signed, orderType);

      return TradingBot.createOrderResultFromResponse(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Failed to place order',
      };
    }
  }

  async cancelOrder(orderId: string): Promise<OrderResult> {
    try {
      const response = await this.clobClient!.cancelOrder(orderId);
      return {
        success: true,
        orderId,
        message: 'Order cancelled',
        data: response,
      };
    } catch (error: any) {
      return {
        success: false,
        orderId,
        message: error.message || 'Failed to cancel order',
      };
    }
  }

  async cancelAllOrders(): Promise<OrderResult> {
    try {
      const response = await this.clobClient!.cancelAllOrders();
      return {
        success: true,
        message: 'All orders cancelled',
        data: response,
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Failed to cancel orders',
      };
    }
  }

  async cancelMarketOrders(market?: string, assetId?: string): Promise<OrderResult> {
    try {
      const response = await this.clobClient!.cancelMarketOrders(market, assetId);
      return {
        success: true,
        message: `Orders cancelled for market ${market || 'all'}`,
        data: response,
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Failed to cancel market orders',
      };
    }
  }

  async getOpenOrders(): Promise<Record<string, any>[]> {
    try {
      return await this.clobClient!.getOpenOrders();
    } catch (error: any) {
      console.error(`Failed to get open orders: ${error.message}`);
      return [];
    }
  }

  async getOrder(orderId: string): Promise<Record<string, any> | null> {
    try {
      return await this.clobClient!.getOrder(orderId);
    } catch (error: any) {
      console.error(`Failed to get order ${orderId}: ${error.message}`);
      return null;
    }
  }

  async getTrades(tokenId?: string, limit: number = 100): Promise<Record<string, any>[]> {
    try {
      return await this.clobClient!.getTrades(tokenId, limit);
    } catch (error: any) {
      console.error(`Failed to get trades: ${error.message}`);
      return [];
    }
  }

  async getOrderBook(tokenId: string): Promise<Record<string, any>> {
    try {
      return await this.clobClient!.getOrderBook(tokenId);
    } catch (error: any) {
      console.error(`Failed to get order book: ${error.message}`);
      return {};
    }
  }

  async getMarketPrice(tokenId: string): Promise<Record<string, any>> {
    try {
      return await this.clobClient!.getMarketPrice(tokenId);
    } catch (error: any) {
      console.error(`Failed to get market price: ${error.message}`);
      return {};
    }
  }

  async deploySafeIfNeeded(): Promise<boolean> {
    if (!this.config.useGasless || !this.relayerClient) {
      return false;
    }

    try {
      await this.relayerClient.deploySafe(this.config.safeAddress);
      return true;
    } catch (error: any) {
      console.warn(`Safe deployment failed (may already be deployed): ${error.message}`);
      return false;
    }
  }

  static createOrderResultFromResponse(response: Record<string, any>): OrderResult {
    const success = response.success || false;
    const errorMsg = response.errorMsg || '';

    return {
      success,
      orderId: response.orderId,
      status: response.status,
      message: errorMsg || (success ? 'Order placed successfully' : 'Order failed'),
      data: response,
    };
  }
}
