/**
 * TypeScript type definitions for Polymarket Arbitrage Bot
 */

export type OrderSide = 'BUY' | 'SELL';
export type OrderType = 'GTC' | 'GTD' | 'FOK';

export interface Order {
  tokenId: string;
  price: number;
  size: number;
  side: OrderSide;
  maker: string;
  nonce?: number;
  feeRateBps?: number;
  signatureType?: number;
}

export interface SignedOrder {
  order: Order;
  signature: string;
  signer: string;
}

export interface OrderResult {
  success: boolean;
  orderId?: string;
  status?: string;
  message: string;
  data?: Record<string, any>;
}

export interface OrderbookLevel {
  price: number;
  size: number;
}

export interface OrderbookSnapshot {
  assetId: string;
  market: string;
  timestamp: number;
  bids: OrderbookLevel[];
  asks: OrderbookLevel[];
  hash?: string;
  bestBid: number;
  bestAsk: number;
  midPrice: number;
}

export interface PriceChange {
  assetId: string;
  price: number;
  size: number;
  side: string;
  bestBid: number;
  bestAsk: number;
  hash?: string;
}

export interface LastTradePrice {
  assetId: string;
  market: string;
  price: number;
  size: number;
  side: string;
  timestamp: number;
  feeRateBps?: number;
}

export interface BuilderConfig {
  apiKey: string;
  apiSecret: string;
  apiPassphrase: string;
}

export interface ClobConfig {
  host: string;
  chainId: number;
  signatureType: number;
}

export interface RelayerConfig {
  host: string;
  txType: string;
}

export interface BotConfig {
  safeAddress: string;
  rpcUrl: string;
  clob: ClobConfig;
  relayer: RelayerConfig;
  builder: BuilderConfig;
  defaultTokenId?: string;
  defaultSize?: number;
  defaultPrice?: number;
  dataDir?: string;
  logLevel?: string;
  useGasless?: boolean;
}

export interface ApiCredentials {
  apiKey: string;
  secret: string;
  passphrase: string;
}

export interface MarketInfo {
  slug: string;
  question: string;
  endDate: string;
  tokenIds: Record<string, string>;
  prices: Record<string, number>;
  acceptingOrders: boolean;
}

export type CoinSymbol = 'BTC' | 'ETH' | 'SOL' | 'XRP';
