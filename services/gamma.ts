/**
 * Gamma API Client
 * 
 * Market discovery for Polymarket 15-minute markets
 */

import axios, { AxiosInstance } from 'axios';
import { CoinSymbol, MarketInfo } from '../types';

const DEFAULT_HOST = 'https://gamma-api.polymarket.com';

const COIN_SLUGS: Record<CoinSymbol, string> = {
  BTC: 'btc-updown-15m',
  ETH: 'eth-updown-15m',
  SOL: 'sol-updown-15m',
  XRP: 'xrp-updown-15m',
};

export class GammaClient {
  private axiosInstance: AxiosInstance;
  private host: string;
  private timeout: number;

  constructor(host: string = DEFAULT_HOST, timeout: number = 10) {
    this.host = host.replace(/\/$/, '');
    this.timeout = timeout;
    this.axiosInstance = axios.create({
      baseURL: this.host,
      timeout: this.timeout,
    });
  }

  async getMarketBySlug(slug: string): Promise<Record<string, any> | null> {
    try {
      const response = await this.axiosInstance.get(`/markets/slug/${slug}`);
      return response.data;
    } catch {
      return null;
    }
  }

  async getCurrent15mMarket(coin: CoinSymbol): Promise<Record<string, any> | null> {
    const coinUpper = coin.toUpperCase() as CoinSymbol;
    if (!COIN_SLUGS[coinUpper]) {
      throw new Error(`Unsupported coin: ${coin}. Use: ${Object.keys(COIN_SLUGS).join(', ')}`);
    }

    const prefix = COIN_SLUGS[coinUpper];
    const now = new Date();

    // Round to current 15-minute window
    const minute = Math.floor(now.getMinutes() / 15) * 15;
    const currentWindow = new Date(now);
    currentWindow.setMinutes(minute, 0, 0);
    const currentTs = Math.floor(currentWindow.getTime() / 1000);

    // Try current window
    let slug = `${prefix}-${currentTs}`;
    let market = await this.getMarketBySlug(slug);
    if (market && market.acceptingOrders) {
      return market;
    }

    // Try next window
    const nextTs = currentTs + 900;
    slug = `${prefix}-${nextTs}`;
    market = await this.getMarketBySlug(slug);
    if (market && market.acceptingOrders) {
      return market;
    }

    // Try previous window
    const prevTs = currentTs - 900;
    slug = `${prefix}-${prevTs}`;
    market = await this.getMarketBySlug(slug);
    if (market && market.acceptingOrders) {
      return market;
    }

    return null;
  }

  parseTokenIds(market: Record<string, any>): Record<string, string> {
    const clobTokenIds = this.parseJsonField(market.clobTokenIds || '[]');
    const outcomes = this.parseJsonField(market.outcomes || '["Up", "Down"]');

    return this.mapOutcomes(outcomes, clobTokenIds);
  }

  parsePrices(market: Record<string, any>): Record<string, number> {
    const outcomePrices = this.parseJsonField(market.outcomePrices || '["0.5", "0.5"]');
    const outcomes = this.parseJsonField(market.outcomes || '["Up", "Down"]');

    return this.mapOutcomes(outcomes, outcomePrices, (v) => parseFloat(v));
  }

  private parseJsonField(value: any): any[] {
    if (typeof value === 'string') {
      return JSON.parse(value);
    }
    return value;
  }

  private mapOutcomes(
    outcomes: any[],
    values: any[],
    cast: (v: any) => any = (v) => v
  ): Record<string, any> {
    const result: Record<string, any> = {};
    outcomes.forEach((outcome, i) => {
      if (i < values.length) {
        result[String(outcome).toLowerCase()] = cast(values[i]);
      }
    });
    return result;
  }

  async getMarketInfo(coin: CoinSymbol): Promise<MarketInfo | null> {
    const market = await this.getCurrent15mMarket(coin);
    if (!market) {
      return null;
    }

    const tokenIds = this.parseTokenIds(market);
    const prices = this.parsePrices(market);

    return {
      slug: market.slug || '',
      question: market.question || '',
      endDate: market.endDate || '',
      tokenIds,
      prices,
      acceptingOrders: market.acceptingOrders || false,
    };
  }
}
