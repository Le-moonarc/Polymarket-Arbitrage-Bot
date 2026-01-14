/**
 * Polymarket Arbitrage Bot - Main Entry Point
 * 
 * TypeScript trading bot for Polymarket with gasless transactions
 * and real-time WebSocket orderbook streaming.
 */

// Core exports
export { TradingBot, TradingBotError, NotInitializedError } from './core/bot';
export { Config, ConfigError, ConfigNotFoundError, isBuilderConfigured } from './core/config';
export { OrderSigner, SignerError } from './core/signer';
export { ClobClient, RelayerClient, ApiClient, ApiError, AuthenticationError, OrderError } from './core/client';

// Services
export { MarketWebSocket, BookCallback, PriceChangeCallback, TradeCallback } from './services/websocket';
export { GammaClient } from './services/gamma';
export { MarketManager } from './services/market';

// Strategies
export { FlashCrashStrategy, FlashCrashConfig } from './strategies/flash-crash';

// Utils
export {
  validateAddress,
  validatePrivateKey,
  formatPrice,
  formatUsdc,
  truncateAddress,
  truncateTokenId,
  createBotFromEnv,
} from './utils';

// Types
export * from './types';
