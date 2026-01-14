/**
 * WebSocket Client Module
 * 
 * Real-time WebSocket connectivity to Polymarket CLOB API
 * for market data streaming.
 */

import WebSocket from 'ws';
import {
  OrderbookSnapshot,
  OrderbookLevel,
  PriceChange,
  LastTradePrice,
} from '../types';

const WSS_MARKET_URL = 'wss://ws-subscriptions-clob.polymarket.com/ws/market';

export type BookCallback = (snapshot: OrderbookSnapshot) => void | Promise<void>;
export type PriceChangeCallback = (market: string, changes: PriceChange[]) => void | Promise<void>;
export type TradeCallback = (trade: LastTradePrice) => void | Promise<void>;
export type ErrorCallback = (error: Error) => void;
export type ConnectionCallback = () => void;

export class MarketWebSocket {
  private url: string;
  private reconnectInterval: number;
  private pingInterval: number;
  private pingTimeout: number;
  private ws?: WebSocket;
  private running: boolean = false;
  private subscribedAssets: Set<string> = new Set();
  private _orderbooks: Map<string, OrderbookSnapshot> = new Map();
  private reconnectTimer?: NodeJS.Timeout;
  private pingTimer?: NodeJS.Timeout;

  // Callbacks
  private onBookCallback?: BookCallback;
  private onPriceChangeCallback?: PriceChangeCallback;
  private onTradeCallback?: TradeCallback;
  private onErrorCallback?: ErrorCallback;
  private onConnectCallback?: ConnectionCallback;
  private onDisconnectCallback?: ConnectionCallback;

  constructor(
    url: string = WSS_MARKET_URL,
    reconnectInterval: number = 5.0,
    pingInterval: number = 20.0,
    pingTimeout: number = 10.0
  ) {
    this.url = url;
    this.reconnectInterval = reconnectInterval;
    this.pingInterval = pingInterval;
    this.pingTimeout = pingTimeout;
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  getOrderbooks(): Map<string, OrderbookSnapshot> {
    return this.orderbooks;
  }

  getOrderbook(assetId: string): OrderbookSnapshot | undefined {
    return this._orderbooks.get(assetId);
  }

  getMidPrice(assetId: string): number {
    const ob = this._orderbooks.get(assetId);
    return ob?.midPrice || 0.0;
  }

  onBook(callback: BookCallback): BookCallback {
    this.onBookCallback = callback;
    return callback;
  }

  onPriceChange(callback: PriceChangeCallback): PriceChangeCallback {
    this.onPriceChangeCallback = callback;
    return callback;
  }

  onTrade(callback: TradeCallback): TradeCallback {
    this.onTradeCallback = callback;
    return callback;
  }

  onError(callback: ErrorCallback): ErrorCallback {
    this.onErrorCallback = callback;
    return callback;
  }

  onConnect(callback: ConnectionCallback): ConnectionCallback {
    this.onConnectCallback = callback;
    return callback;
  }

  onDisconnect(callback: ConnectionCallback): ConnectionCallback {
    this.onDisconnectCallback = callback;
    return callback;
  }

  async connect(): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        this.ws = new WebSocket(this.url);

        this.ws.on('open', () => {
          if (this.onConnectCallback) {
            this.onConnectCallback();
          }
          this.startPing();
          resolve(true);
        });

        this.ws.on('message', (data: WebSocket.Data) => {
          this.handleMessage(data.toString());
        });

        this.ws.on('error', (error: Error) => {
          if (this.onErrorCallback) {
            this.onErrorCallback(error);
          }
          resolve(false);
        });

        this.ws.on('close', () => {
          this.stopPing();
          if (this.onDisconnectCallback) {
            this.onDisconnectCallback();
          }
        });
      } catch (error: any) {
        if (this.onErrorCallback) {
          this.onErrorCallback(error);
        }
        resolve(false);
      }
    });
  }

  async disconnect(): Promise<void> {
    this.running = false;
    this.stopPing();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    if (this.ws) {
      this.ws.close();
      this.ws = undefined;
    }
  }

  async subscribe(assetIds: string[], replace: boolean = false): Promise<boolean> {
    if (assetIds.length === 0) {
      return false;
    }

    if (replace) {
      this.subscribedAssets.clear();
      this._orderbooks.clear();
    }

    assetIds.forEach((id) => this.subscribedAssets.add(id));

    if (!this.isConnected) {
      return true; // Will subscribe after connect
    }

    const subscribeMsg = {
      assets_ids: assetIds,
      type: 'MARKET',
    };

    try {
      this.ws!.send(JSON.stringify(subscribeMsg));
      return true;
    } catch (error: any) {
      if (this.onErrorCallback) {
        this.onErrorCallback(error);
      }
      return false;
    }
  }

  private handleMessage(message: string): void {
    try {
      const data = JSON.parse(message);
      const eventType = data.event_type || '';

      if (eventType === 'book') {
        const snapshot = this.parseOrderbookSnapshot(data);
        this._orderbooks.set(snapshot.assetId, snapshot);
        if (this.onBookCallback) {
          const result = this.onBookCallback(snapshot);
          if (result instanceof Promise) {
            result.catch((err) => {
              if (this.onErrorCallback) {
                this.onErrorCallback(err);
              }
            });
          }
        }
      } else if (eventType === 'price_change') {
        const market = data.market || '';
        const changes = (data.price_changes || []).map((pc: any) => this.parsePriceChange(pc));
        if (this.onPriceChangeCallback) {
          const result = this.onPriceChangeCallback(market, changes);
          if (result instanceof Promise) {
            result.catch((err) => {
              if (this.onErrorCallback) {
                this.onErrorCallback(err);
              }
            });
          }
        }
      } else if (eventType === 'last_trade_price') {
        const trade = this.parseLastTradePrice(data);
        if (this.onTradeCallback) {
          const result = this.onTradeCallback(trade);
          if (result instanceof Promise) {
            result.catch((err) => {
              if (this.onErrorCallback) {
                this.onErrorCallback(err);
              }
            });
          }
        }
      }
    } catch (error: any) {
      if (this.onErrorCallback) {
        this.onErrorCallback(error);
      }
    }
  }

  private parseOrderbookSnapshot(data: any): OrderbookSnapshot {
    const bids = (data.bids || []).map((b: any) => ({
      price: parseFloat(b.price),
      size: parseFloat(b.size),
    }));
    const asks = (data.asks || []).map((a: any) => ({
      price: parseFloat(a.price),
      size: parseFloat(a.size),
    }));

    bids.sort((a, b) => b.price - a.price); // Descending
    asks.sort((a, b) => a.price - b.price); // Ascending

    const bestBid = bids.length > 0 ? bids[0].price : 0.0;
    const bestAsk = asks.length > 0 ? asks[0].price : 1.0;
    const midPrice =
      bestBid > 0 && bestAsk < 1
        ? (bestBid + bestAsk) / 2
        : bestBid > 0
        ? bestBid
        : bestAsk < 1
        ? bestAsk
        : 0.5;

    return {
      assetId: data.asset_id || '',
      market: data.market || '',
      timestamp: parseInt(data.timestamp || '0', 10),
      bids,
      asks,
      hash: data.hash || '',
      bestBid,
      bestAsk,
      midPrice,
    };
  }

  private parsePriceChange(data: any): PriceChange {
    return {
      assetId: data.asset_id || '',
      price: parseFloat(data.price || '0'),
      size: parseFloat(data.size || '0'),
      side: data.side || '',
      bestBid: parseFloat(data.best_bid || '0'),
      bestAsk: parseFloat(data.best_ask || '1'),
      hash: data.hash || '',
    };
  }

  private parseLastTradePrice(data: any): LastTradePrice {
    return {
      assetId: data.asset_id || '',
      market: data.market || '',
      price: parseFloat(data.price || '0'),
      size: parseFloat(data.size || '0'),
      side: data.side || '',
      timestamp: parseInt(data.timestamp || '0', 10),
      feeRateBps: parseInt(data.fee_rate_bps || '0', 10),
    };
  }

  private startPing(): void {
    this.pingTimer = setInterval(() => {
      if (this.ws && this.isConnected) {
        this.ws.ping();
      }
    }, this.pingInterval * 1000);
  }

  private stopPing(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = undefined;
    }
  }

  async run(autoReconnect: boolean = true): Promise<void> {
    this.running = true;

    while (this.running) {
      if (await this.connect()) {
        // Subscribe to assets
        if (this.subscribedAssets.size > 0) {
          await this.subscribe(Array.from(this.subscribedAssets));
        }

        // Wait for connection to close
        await new Promise<void>((resolve) => {
          if (this.ws) {
            this.ws.on('close', () => resolve());
          } else {
            resolve();
          }
        });
      }

      if (!this.running) {
        break;
      }

      if (autoReconnect) {
        await new Promise((resolve) => {
          this.reconnectTimer = setTimeout(resolve, this.reconnectInterval * 1000);
        });
      } else {
        break;
      }
    }
  }

  stop(): void {
    this.running = false;
  }
}
