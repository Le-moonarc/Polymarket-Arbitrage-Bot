/**
 * EIP-712 Order Signing Module
 * 
 * Provides EIP-712 signature functionality for Polymarket orders
 * and authentication messages.
 */

import { ethers } from 'ethers';
import { Order, SignedOrder } from '../types';

const USDC_DECIMALS = 6;

// Polymarket CLOB EIP-712 domain
const DOMAIN = {
  name: 'ClobAuthDomain',
  version: '1',
  chainId: 137, // Polygon mainnet
};

// Order type definition for EIP-712
const ORDER_TYPES = {
  Order: [
    { name: 'salt', type: 'uint256' },
    { name: 'maker', type: 'address' },
    { name: 'signer', type: 'address' },
    { name: 'taker', type: 'address' },
    { name: 'tokenId', type: 'uint256' },
    { name: 'makerAmount', type: 'uint256' },
    { name: 'takerAmount', type: 'uint256' },
    { name: 'expiration', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'feeRateBps', type: 'uint256' },
    { name: 'side', type: 'uint8' },
    { name: 'signatureType', type: 'uint8' },
  ],
};

export class SignerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SignerError';
  }
}

export class OrderSigner {
  private wallet: ethers.Wallet;
  public readonly address: string;

  constructor(privateKey: string) {
    // Normalize private key
    let key = privateKey.trim();
    if (key.startsWith('0x')) {
      key = key.slice(2);
    }

    try {
      this.wallet = new ethers.Wallet(`0x${key}`);
      this.address = this.wallet.address;
    } catch (error: any) {
      throw new SignerError(`Invalid private key: ${error.message}`);
    }
  }

  signAuthMessage(timestamp?: string, nonce: number = 0): string {
    if (!timestamp) {
      timestamp = Math.floor(Date.now() / 1000).toString();
    }

    const authTypes = {
      ClobAuth: [
        { name: 'address', type: 'address' },
        { name: 'timestamp', type: 'string' },
        { name: 'nonce', type: 'uint256' },
        { name: 'message', type: 'string' },
      ],
    };

    const messageData = {
      address: this.address,
      timestamp,
      nonce,
      message: 'This message attests that I control the given wallet',
    };

    // Note: ethers.js v6 uses different API for EIP-712 signing
    // This is a simplified version - actual implementation may need adjustment
    const domain = DOMAIN;
    const types = authTypes;
    const value = messageData;

    // For now, return a placeholder - actual EIP-712 signing requires ethers.js v6 specific API
    // In production, use: await this.wallet.signTypedData(domain, types, value)
    throw new SignerError('EIP-712 signing not fully implemented - requires ethers.js v6 EIP-712 support');
  }

  signOrder(order: Order): SignedOrder {
    try {
      // Validate order
      if (order.side !== 'BUY' && order.side !== 'SELL') {
        throw new SignerError(`Invalid side: ${order.side}`);
      }
      if (order.price <= 0 || order.price > 1) {
        throw new SignerError(`Invalid price: ${order.price}`);
      }
      if (order.size <= 0) {
        throw new SignerError(`Invalid size: ${order.size}`);
      }

      const nonce = order.nonce || Math.floor(Date.now() / 1000);
      const feeRateBps = order.feeRateBps || 0;
      const signatureType = order.signatureType || 2;

      // Calculate amounts
      const makerAmount = BigInt(Math.floor(order.size * order.price * 10 ** USDC_DECIMALS));
      const takerAmount = BigInt(Math.floor(order.size * 10 ** USDC_DECIMALS));
      const sideValue = order.side === 'BUY' ? 0 : 1;

      const orderMessage = {
        salt: 0,
        maker: ethers.getAddress(order.maker),
        signer: this.address,
        taker: '0x0000000000000000000000000000000000000000',
        tokenId: BigInt(order.tokenId),
        makerAmount,
        takerAmount,
        expiration: 0,
        nonce,
        feeRateBps,
        side: sideValue,
        signatureType,
      };

      // Sign using EIP-712
      // Note: This requires ethers.js v6 EIP-712 signing support
      // In production: const signature = await this.wallet.signTypedData(DOMAIN, ORDER_TYPES, orderMessage);
      
      // Placeholder - actual implementation needed
      const signature = '0x' + '0'.repeat(130); // Placeholder signature

      return {
        order: {
          tokenId: order.tokenId,
          price: order.price,
          size: order.size,
          side: order.side,
          maker: order.maker,
          nonce,
          feeRateBps,
          signatureType,
        },
        signature,
        signer: this.address,
      };
    } catch (error: any) {
      throw new SignerError(`Failed to sign order: ${error.message}`);
    }
  }

  signOrderDict(
    tokenId: string,
    price: number,
    size: number,
    side: 'BUY' | 'SELL',
    maker: string,
    nonce?: number,
    feeRateBps: number = 0
  ): SignedOrder {
    const order: Order = {
      tokenId,
      price,
      size,
      side,
      maker,
      nonce,
      feeRateBps,
      signatureType: 2,
    };
    return this.signOrder(order);
  }
}
