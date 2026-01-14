/**
 * API Client Module
 * 
 * Provides clients for interacting with Polymarket CLOB API
 * and Builder Relayer API.
 */

import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import * as crypto from 'crypto';
import { BuilderConfig, ApiCredentials, BotConfig } from '../types';

export class ApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

export class AuthenticationError extends ApiError {
  constructor(message: string) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class OrderError extends ApiError {
  constructor(message: string) {
    super(message);
    this.name = 'OrderError';
  }
}

export class ApiClient {
  protected axiosInstance: AxiosInstance;
  protected baseUrl: string;
  protected timeout: number;
  protected retryCount: number;

  constructor(baseUrl: string, timeout: number = 30, retryCount: number = 3) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.timeout = timeout;
    this.retryCount = retryCount;
    this.axiosInstance = axios.create({
      baseURL: this.baseUrl,
      timeout: this.timeout,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  protected async request<T>(
    method: string,
    endpoint: string,
    data?: any,
    headers?: Record<string, string>,
    params?: Record<string, any>
  ): Promise<T> {
    const url = `${this.baseUrl}/${endpoint.replace(/^\//, '')}`;
    const config: AxiosRequestConfig = {
      method: method.toUpperCase(),
      url,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      params,
      data,
    };

    let lastError: Error | null = null;
    for (let attempt = 0; attempt < this.retryCount; attempt++) {
      try {
        const response = await this.axiosInstance.request<T>(config);
        return response.data;
      } catch (error: any) {
        lastError = error;
        if (attempt < this.retryCount - 1) {
          await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    }

    throw new ApiError(`Request failed after ${this.retryCount} attempts: ${lastError?.message}`);
  }
}

export class ClobClient extends ApiClient {
  private chainId: number;
  private signatureType: number;
  private funder: string;
  private apiCreds?: ApiCredentials;
  private builderCreds?: BuilderConfig;

  constructor(
    host: string = 'https://clob.polymarket.com',
    chainId: number = 137,
    signatureType: number = 2,
    funder: string = '',
    apiCreds?: ApiCredentials,
    builderCreds?: BuilderConfig,
    timeout: number = 30
  ) {
    super(host, timeout);
    this.chainId = chainId;
    this.signatureType = signatureType;
    this.funder = funder;
    this.apiCreds = apiCreds;
    this.builderCreds = builderCreds;
  }

  private buildHeaders(method: string, path: string, body: string = ''): Record<string, string> {
    const headers: Record<string, string> = {};

    // Builder HMAC authentication
    if (this.builderCreds && this.isBuilderConfigured(this.builderCreds)) {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const message = `${timestamp}${method}${path}${body}`;
      const signature = crypto
        .createHmac('sha256', this.builderCreds.apiSecret)
        .update(message)
        .digest('hex');

      headers['POLY_BUILDER_API_KEY'] = this.builderCreds.apiKey;
      headers['POLY_BUILDER_TIMESTAMP'] = timestamp;
      headers['POLY_BUILDER_PASSPHRASE'] = this.builderCreds.apiPassphrase;
      headers['POLY_BUILDER_SIGNATURE'] = signature;
    }

    // User API credentials (L2 authentication)
    if (this.apiCreds && this.isApiCredsValid()) {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const message = `${timestamp}${method}${path}${body}`;

      let signature: string;
      try {
        const secretBuffer = Buffer.from(this.apiCreds.secret, 'base64');
        signature = crypto.createHmac('sha256', secretBuffer).update(message).digest('base64');
      } catch {
        // Fallback: use secret directly if not base64 encoded
        signature = crypto
          .createHmac('sha256', this.apiCreds.secret)
          .update(message)
          .digest('hex');
      }

      headers['POLY_ADDRESS'] = this.funder;
      headers['POLY_API_KEY'] = this.apiCreds.apiKey;
      headers['POLY_TIMESTAMP'] = timestamp;
      headers['POLY_PASSPHRASE'] = this.apiCreds.passphrase;
      headers['POLY_SIGNATURE'] = signature;
    }

    return headers;
  }

  private isBuilderConfigured(creds: BuilderConfig): boolean {
    return !!(
      creds?.apiKey &&
      creds?.apiSecret &&
      creds?.apiPassphrase
    );
  }

  private isApiCredsValid(): boolean {
    return !!(this.apiCreds?.apiKey && this.apiCreds?.secret && this.apiCreds?.passphrase);
  }

  setApiCreds(creds: ApiCredentials): void {
    this.apiCreds = creds;
  }

  async getOrderBook(tokenId: string): Promise<Record<string, any>> {
    return this.request('GET', '/book', undefined, undefined, { token_id: tokenId });
  }

  async getMarketPrice(tokenId: string): Promise<Record<string, any>> {
    return this.request('GET', '/price', undefined, undefined, { token_id: tokenId });
  }

  async getOpenOrders(): Promise<Record<string, any>[]> {
    const endpoint = '/data/orders';
    const headers = this.buildHeaders('GET', endpoint);
    const result = await this.request<Record<string, any> | Record<string, any>[]>(
      'GET',
      endpoint,
      undefined,
      headers
    );

    if (Array.isArray(result)) {
      return result;
    }
    if (result && 'data' in result && Array.isArray(result.data)) {
      return result.data;
    }
    return [];
  }

  async getOrder(orderId: string): Promise<Record<string, any>> {
    const endpoint = `/data/order/${orderId}`;
    const headers = this.buildHeaders('GET', endpoint);
    return this.request('GET', endpoint, undefined, headers);
  }

  async getTrades(tokenId?: string, limit: number = 100): Promise<Record<string, any>[]> {
    const endpoint = '/data/trades';
    const headers = this.buildHeaders('GET', endpoint);
    const params: Record<string, any> = { limit };
    if (tokenId) params.token_id = tokenId;

    const result = await this.request<Record<string, any> | Record<string, any>[]>(
      'GET',
      endpoint,
      undefined,
      headers,
      params
    );

    if (Array.isArray(result)) {
      return result;
    }
    if (result && 'data' in result && Array.isArray(result.data)) {
      return result.data;
    }
    return [];
  }

  async postOrder(signedOrder: Record<string, any>, orderType: string = 'GTC'): Promise<Record<string, any>> {
    const endpoint = '/order';
    const body = {
      order: signedOrder.order || signedOrder,
      owner: this.funder,
      orderType,
    };

    if (signedOrder.signature) {
      body.signature = signedOrder.signature;
    }

    const bodyJson = JSON.stringify(body);
    const headers = this.buildHeaders('POST', endpoint, bodyJson);

    return this.request('POST', endpoint, body, headers);
  }

  async cancelOrder(orderId: string): Promise<Record<string, any>> {
    const endpoint = '/order';
    const body = { orderID: orderId };
    const bodyJson = JSON.stringify(body);
    const headers = this.buildHeaders('DELETE', endpoint, bodyJson);

    return this.request('DELETE', endpoint, body, headers);
  }

  async cancelAllOrders(): Promise<Record<string, any>> {
    const endpoint = '/cancel-all';
    const headers = this.buildHeaders('DELETE', endpoint);
    return this.request('DELETE', endpoint, undefined, headers);
  }

  async cancelMarketOrders(market?: string, assetId?: string): Promise<Record<string, any>> {
    const endpoint = '/cancel-market-orders';
    const body: Record<string, any> = {};
    if (market) body.market = market;
    if (assetId) body.asset_id = assetId;

    const bodyJson = Object.keys(body).length > 0 ? JSON.stringify(body) : '';
    const headers = this.buildHeaders('DELETE', endpoint, bodyJson);

    return this.request('DELETE', endpoint, Object.keys(body).length > 0 ? body : undefined, headers);
  }

  async createOrDeriveApiKey(signer: any, nonce: number = 0): Promise<ApiCredentials> {
    try {
      return await this.createApiKey(signer, nonce);
    } catch {
      return await this.deriveApiKey(signer, nonce);
    }
  }

  async createApiKey(signer: any, nonce: number = 0): Promise<ApiCredentials> {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const authSignature = signer.signAuthMessage(timestamp, nonce);

    const headers = {
      POLY_ADDRESS: signer.address,
      POLY_SIGNATURE: authSignature,
      POLY_TIMESTAMP: timestamp,
      POLY_NONCE: nonce.toString(),
    };

    const response = await this.request<Record<string, any>>('POST', '/auth/api-key', undefined, headers);
    return {
      apiKey: response.apiKey || '',
      secret: response.secret || '',
      passphrase: response.passphrase || '',
    };
  }

  async deriveApiKey(signer: any, nonce: number = 0): Promise<ApiCredentials> {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const authSignature = signer.signAuthMessage(timestamp, nonce);

    const headers = {
      POLY_ADDRESS: signer.address,
      POLY_SIGNATURE: authSignature,
      POLY_TIMESTAMP: timestamp,
      POLY_NONCE: nonce.toString(),
    };

    const response = await this.request<Record<string, any>>('GET', '/auth/derive-api-key', undefined, headers);
    return {
      apiKey: response.apiKey || '',
      secret: response.secret || '',
      passphrase: response.passphrase || '',
    };
  }
}

export class RelayerClient extends ApiClient {
  private chainId: number;
  private builderCreds?: BuilderConfig;
  private txType: string;

  constructor(
    host: string = 'https://relayer-v2.polymarket.com',
    chainId: number = 137,
    builderCreds?: BuilderConfig,
    txType: string = 'SAFE',
    timeout: number = 60
  ) {
    super(host, timeout);
    this.chainId = chainId;
    this.builderCreds = builderCreds;
    this.txType = txType;
  }

  private buildHeaders(method: string, path: string, body: string = ''): Record<string, string> {
    if (!this.builderCreds || !this.isBuilderConfigured(this.builderCreds)) {
      throw new AuthenticationError('Builder credentials required for relayer');
    }

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const message = `${timestamp}${method}${path}${body}`;
    const signature = crypto
      .createHmac('sha256', this.builderCreds.apiSecret)
      .update(message)
      .digest('hex');

    return {
      POLY_BUILDER_API_KEY: this.builderCreds.apiKey,
      POLY_BUILDER_TIMESTAMP: timestamp,
      POLY_BUILDER_PASSPHRASE: this.builderCreds.apiPassphrase,
      POLY_BUILDER_SIGNATURE: signature,
    };
  }

  private isBuilderConfigured(creds: BuilderConfig): boolean {
    return !!(
      creds?.apiKey &&
      creds?.apiSecret &&
      creds?.apiPassphrase
    );
  }

  async deploySafe(safeAddress: string): Promise<Record<string, any>> {
    const endpoint = '/deploy';
    const body = { safeAddress };
    const bodyJson = JSON.stringify(body);
    const headers = this.buildHeaders('POST', endpoint, bodyJson);

    return this.request('POST', endpoint, body, headers);
  }

  async approveUsdc(safeAddress: string, spender: string, amount: string): Promise<Record<string, any>> {
    const endpoint = '/approve-usdc';
    const body = {
      safeAddress,
      spender,
      amount: amount.toString(),
    };
    const bodyJson = JSON.stringify(body);
    const headers = this.buildHeaders('POST', endpoint, bodyJson);

    return this.request('POST', endpoint, body, headers);
  }

  async approveToken(
    safeAddress: string,
    tokenId: string,
    spender: string,
    amount: string
  ): Promise<Record<string, any>> {
    const endpoint = '/approve-token';
    const body = {
      safeAddress,
      tokenId,
      spender,
      amount: amount.toString(),
    };
    const bodyJson = JSON.stringify(body);
    const headers = this.buildHeaders('POST', endpoint, bodyJson);

    return this.request('POST', endpoint, body, headers);
  }
}
