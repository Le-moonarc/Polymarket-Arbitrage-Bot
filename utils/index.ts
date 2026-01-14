/**
 * Utility Functions
 */

import { Config } from '../core/config';
import { TradingBot } from '../core/bot';

export function validateAddress(address: string): boolean {
  if (!address) return false;
  if (!address.startsWith('0x')) return false;
  if (address.length !== 42) return false;
  try {
    BigInt(address);
    return true;
  } catch {
    return false;
  }
}

export function validatePrivateKey(key: string): [boolean, string] {
  if (!key) {
    return [false, 'Private key cannot be empty'];
  }

  let normalized = key.trim().toLowerCase();
  if (normalized.startsWith('0x')) {
    normalized = normalized.slice(2);
  }

  if (normalized.length !== 64) {
    return [false, 'Private key must be 64 hex characters (32 bytes)'];
  }

  try {
    BigInt(`0x${normalized}`);
    return [true, `0x${normalized}`];
  } catch {
    return [false, 'Private key contains invalid characters'];
  }
}

export function formatPrice(price: number, decimals: number = 2): string {
  const percentage = price * 100;
  return `${price.toFixed(decimals)} (${percentage.toFixed(0)}%)`;
}

export function formatUsdc(amount: number, decimals: number = 2): string {
  return `$${amount.toFixed(decimals)} USDC`;
}

export function truncateAddress(address: string, chars: number = 6): string {
  if (!address || address.length < chars * 2 + 2) {
    return address;
  }
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

export function truncateTokenId(tokenId: string, chars: number = 8): string {
  if (!tokenId || tokenId.length <= chars) {
    return tokenId;
  }
  return `${tokenId.slice(0, chars)}...`;
}

export function createBotFromEnv(): TradingBot {
  const privateKey = process.env.POLY_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error(
      'POLY_PRIVATE_KEY environment variable is required. ' +
        'Set it with: export POLY_PRIVATE_KEY=your_key'
    );
  }

  const safeAddress = process.env.POLY_PROXY_WALLET;
  if (!safeAddress) {
    throw new Error(
      'POLY_PROXY_WALLET environment variable is required. ' +
        'Set it with: export POLY_PROXY_WALLET=0x...'
    );
  }

  const config = Config.fromEnv();
  return new TradingBot(undefined, config, undefined, undefined, privateKey);
}
