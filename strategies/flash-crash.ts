/**
 * Flash Crash Trading Strategy
 * 
 * Monitors 15-minute markets for sudden price drops and executes trades
 */

import { TradingBot } from '../core/bot';
import { MarketManager } from '../services/market';
import { OrderbookSnapshot, CoinSymbol } from '../types';

export interface FlashCrashConfig {
  coin: CoinSymbol;
  size: number;
  dropThreshold: number;
  priceLookbackSeconds: number;
  takeProfit: number;
  stopLoss: number;
}

export class FlashCrashStrategy {
  private bot: TradingBot;
  private config: FlashCrashConfig;
  private market: MarketManager;
  private running: boolean = false;
  private priceHistory: Map<string, Array<{ timestamp: number; price: number }>> = new Map();

  constructor(bot: TradingBot, config: FlashCrashConfig) {
    this.bot = bot;
    this.config = config;
    this.market = new MarketManager(config.coin);
    this.priceHistory.set('up', []);
    this.priceHistory.set('down', []);
  }

  async run(): Promise<void> {
    try {
      if (!(await this.market.start())) {
        console.error('Failed to start market manager');
        return;
      }

      await this.market.waitForData(5.0);

      this.market.onBookUpdate((snapshot) => {
        this.handleBookUpdate(snapshot);
      });

      this.running = true;

      while (this.running) {
        const prices = this.getCurrentPrices();
        await this.onTick(prices);
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    } catch (error: any) {
      console.error(`Strategy error: ${error.message}`);
    } finally {
      await this.market.stop();
    }
  }

  private handleBookUpdate(snapshot: OrderbookSnapshot): void {
    const side = this.getSideForToken(snapshot.assetId);
    if (side) {
      this.recordPrice(side, snapshot.midPrice);
    }
  }

  private getSideForToken(tokenId: string): 'up' | 'down' | null {
    const tokenIds = this.market.tokenIds;
    if (tokenId === tokenIds.up) return 'up';
    if (tokenId === tokenIds.down) return 'down';
    return null;
  }

  private recordPrice(side: 'up' | 'down', price: number): void {
    const history = this.priceHistory.get(side) || [];
    history.push({ timestamp: Date.now(), price });
    
    // Keep only last 100 entries
    if (history.length > 100) {
      history.shift();
    }
    this.priceHistory.set(side, history);
  }

  private detectFlashCrash(side: 'up' | 'down'): { detected: boolean; oldPrice: number; newPrice: number } | null {
    const history = this.priceHistory.get(side) || [];
    if (history.length < 2) return null;

    const now = Date.now();
    const lookbackMs = this.config.priceLookbackSeconds * 1000;
    const currentPrice = history[history.length - 1].price;

    // Find price from lookback window
    let oldPrice: number | null = null;
    for (let i = history.length - 2; i >= 0; i--) {
      if (now - history[i].timestamp <= lookbackMs) {
        oldPrice = history[i].price;
        break;
      }
    }

    if (oldPrice === null) return null;

    const drop = oldPrice - currentPrice;
    if (drop >= this.config.dropThreshold) {
      return { detected: true, oldPrice, newPrice: currentPrice };
    }

    return null;
  }

  private getCurrentPrices(): Record<string, number> {
    return {
      up: this.market.getMidPrice('up'),
      down: this.market.getMidPrice('down'),
    };
  }

  private async onTick(prices: Record<string, number>): Promise<void> {
    // Check for flash crashes
    for (const side of ['up', 'down'] as const) {
      const crash = this.detectFlashCrash(side);
      if (crash && crash.detected) {
        console.log(
          `FLASH CRASH detected on ${side.toUpperCase()}: ` +
          `${crash.oldPrice.toFixed(4)} -> ${crash.newPrice.toFixed(4)}`
        );
        
        const tokenId = this.market.tokenIds[side];
        if (tokenId) {
          const size = this.config.size / crash.newPrice;
          await this.bot.placeOrder(
            tokenId,
            Math.min(crash.newPrice + 0.02, 0.99),
            size,
            'BUY'
          );
        }
      }
    }
  }

  stop(): void {
    this.running = false;
  }
}
