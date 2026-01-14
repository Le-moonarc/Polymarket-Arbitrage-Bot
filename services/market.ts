/**
 * Market Manager Service
 * 
 * Manages market discovery and WebSocket connections
 */

import { GammaClient } from './gamma';
import { MarketWebSocket, BookCallback, ConnectionCallback } from './websocket';
import { OrderbookSnapshot, CoinSymbol, MarketInfo } from '../types';

export class MarketManager {
  private coin: CoinSymbol;
  private gamma: GammaClient;
  private ws?: MarketWebSocket;
  private currentMarket?: MarketInfo;
  private running: boolean = false;
  private wsConnected: boolean = false;

  private onBookCallbacks: BookCallback[] = [];
  private onMarketChangeCallbacks: Array<(oldSlug: string, newSlug: string) => void> = [];
  private onConnectCallbacks: ConnectionCallback[] = [];
  private onDisconnectCallbacks: ConnectionCallback[] = [];

  constructor(coin: CoinSymbol = 'BTC') {
    this.coin = coin.toUpperCase() as CoinSymbol;
    this.gamma = new GammaClient();
  }

  get isConnected(): boolean {
    return this.wsConnected;
  }

  get isRunning(): boolean {
    return this.running;
  }

  get tokenIds(): Record<string, string> {
    return this.currentMarket?.tokenIds || {};
  }

  get currentMarket(): MarketInfo | undefined {
    return this.currentMarket;
  }

  getOrderbook(side: 'up' | 'down'): OrderbookSnapshot | undefined {
    if (!this.ws || !this.currentMarket) {
      return undefined;
    }
    const tokenId = this.currentMarket.tokenIds[side];
    return tokenId ? this.ws.getOrderbook(tokenId) : undefined;
  }

  getMidPrice(side: 'up' | 'down'): number {
    if (!this.ws || !this.currentMarket) {
      return 0.0;
    }
    const tokenId = this.currentMarket.tokenIds[side];
    return tokenId ? this.ws.getMidPrice(tokenId) : 0.0;
  }

  getBestBid(side: 'up' | 'down'): number {
    const ob = this.getOrderbook(side);
    return ob?.bestBid || 0.0;
  }

  getBestAsk(side: 'up' | 'down'): number {
    const ob = this.getOrderbook(side);
    return ob?.bestAsk || 1.0;
  }

  getSpread(side: 'up' | 'down'): number {
    const ob = this.getOrderbook(side);
    if (ob && ob.bestBid > 0) {
      return ob.bestAsk - ob.bestBid;
    }
    return 0.0;
  }

  onBookUpdate(callback: BookCallback): BookCallback {
    this.onBookCallbacks.push(callback);
    return callback;
  }

  onMarketChange(callback: (oldSlug: string, newSlug: string) => void) {
    this.onMarketChangeCallbacks.push(callback);
  }

  onConnect(callback: ConnectionCallback): ConnectionCallback {
    this.onConnectCallbacks.push(callback);
    return callback;
  }

  onDisconnect(callback: ConnectionCallback): ConnectionCallback {
    this.onDisconnectCallbacks.push(callback);
    return callback;
  }

  async discoverMarket(): Promise<MarketInfo | null> {
    return await this.gamma.getMarketInfo(this.coin);
  }

  private async setupWebSocket(): Promise<boolean> {
    if (!this.currentMarket) {
      return false;
    }

    this.ws = new MarketWebSocket();

    this.ws.onBook((snapshot) => {
      this.onBookCallbacks.forEach((cb) => {
        try {
          const result = cb(snapshot);
          if (result instanceof Promise) {
            result.catch(() => {});
          }
        } catch {}
      });
    });

    this.ws.onConnect(() => {
      this.wsConnected = true;
      this.onConnectCallbacks.forEach((cb) => {
        try {
          cb();
        } catch {}
      });
    });

    this.ws.onDisconnect(() => {
      this.wsConnected = false;
      this.onDisconnectCallbacks.forEach((cb) => {
        try {
          cb();
        } catch {}
      });
    });

    const tokenList = Object.values(this.currentMarket.tokenIds);
    if (tokenList.length > 0) {
      await this.ws.subscribe(tokenList, true);
    }

    return true;
  }

  async start(): Promise<boolean> {
    this.running = true;

    // Discover initial market
    const market = await this.discoverMarket();
    if (!market) {
      this.running = false;
      return false;
    }

    this.currentMarket = market;

    // Setup WebSocket
    if (!(await this.setupWebSocket())) {
      this.running = false;
      return false;
    }

    // Start WebSocket in background
    this.ws!.run(true).catch(() => {});

    return true;
  }

  async stop(): Promise<void> {
    this.running = false;
    if (this.ws) {
      await this.ws.disconnect();
      this.ws = undefined;
    }
    this.wsConnected = false;
  }

  async waitForData(timeout: number = 5.0): Promise<boolean> {
    const start = Date.now();
    while (Date.now() - start < timeout * 1000) {
      if (this.wsConnected) {
        if (this.getOrderbook('up') || this.getOrderbook('down')) {
          return true;
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return false;
  }
}
