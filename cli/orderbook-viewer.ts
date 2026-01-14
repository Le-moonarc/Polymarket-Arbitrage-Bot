#!/usr/bin/env node
/**
 * Orderbook Viewer
 * 
 * Real-time orderbook visualization for Polymarket 15-minute markets
 */

import * as dotenv from 'dotenv';
import { MarketManager } from '../services/market';
import { CoinSymbol } from '../types';

// Load environment variables
dotenv.config();

async function main() {
  const args = process.argv.slice(2);
  const coin = (args.find((a) => a.startsWith('--coin'))?.split('=')[1] || 'ETH').toUpperCase() as CoinSymbol;

  const market = new MarketManager(coin);

  market.onBookUpdate((snapshot) => {
    renderOrderbook(market, coin);
  });

  if (!(await market.start())) {
    console.error('Failed to start market manager');
    process.exit(1);
  }

  await market.waitForData(5.0);

  // Render initial state
  renderOrderbook(market, coin);

  // Update display periodically
  setInterval(() => {
    renderOrderbook(market, coin);
  }, 100);

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    await market.stop();
    process.exit(0);
  });
}

function renderOrderbook(market: MarketManager, coin: CoinSymbol): void {
  const upOb = market.getOrderbook('up');
  const downOb = market.getOrderbook('down');

  // Clear screen
  process.stdout.write('\x1B[2J\x1B[H');

  // Header
  const wsStatus = market.isConnected ? 'Connected' : 'Disconnected';
  console.log('='.repeat(80));
  console.log(`Orderbook TUI | ${coin} | ${wsStatus}`);
  console.log('='.repeat(80));

  // Market info
  const currentMarket = market.currentMarket;
  if (currentMarket) {
    console.log(`Market: ${currentMarket.question}`);
    console.log(`Slug: ${currentMarket.slug}`);
    console.log();
  }

  // Orderbook display
  console.log(`${'UP'.padStart(39)}|${'DOWN'.padStart(39)}`);
  console.log(`${'Bid'.padStart(9)} ${'Size'.padStart(9)} | ${'Ask'.padStart(9)} ${'Size'.padStart(9)}|${'Bid'.padStart(9)} ${'Size'.padStart(9)} | ${'Ask'.padStart(9)} ${'Size'.padStart(9)}`);
  console.log('-'.repeat(80));

  const upBids = upOb?.bids.slice(0, 10) || [];
  const upAsks = upOb?.asks.slice(0, 10) || [];
  const downBids = downOb?.bids.slice(0, 10) || [];
  const downAsks = downOb?.asks.slice(0, 10) || [];

  for (let i = 0; i < 10; i++) {
    const upBid = i < upBids.length
      ? `${upBids[i].price.toFixed(4).padStart(9)} ${upBids[i].size.toFixed(1).padStart(9)}`
      : `${'--'.padStart(9)} ${'--'.padStart(9)}`;
    const upAsk = i < upAsks.length
      ? `${upAsks[i].price.toFixed(4).padStart(9)} ${upAsks[i].size.toFixed(1).padStart(9)}`
      : `${'--'.padStart(9)} ${'--'.padStart(9)}`;
    const downBid = i < downBids.length
      ? `${downBids[i].price.toFixed(4).padStart(9)} ${downBids[i].size.toFixed(1).padStart(9)}`
      : `${'--'.padStart(9)} ${'--'.padStart(9)}`;
    const downAsk = i < downAsks.length
      ? `${downAsks[i].price.toFixed(4).padStart(9)} ${downAsks[i].size.toFixed(1).padStart(9)}`
      : `${'--'.padStart(9)} ${'--'.padStart(9)}`;
    
    console.log(`${upBid} | ${upAsk}|${downBid} | ${downAsk}`);
  }

  console.log('-'.repeat(80));

  // Summary
  const upMid = upOb?.midPrice || 0;
  const downMid = downOb?.midPrice || 0;
  const upSpread = market.getSpread('up');
  const downSpread = market.getSpread('down');

  console.log(
    `Mid: ${upMid.toFixed(4)}  Spread: ${upSpread.toFixed(4)}           |` +
    `Mid: ${downMid.toFixed(4)}  Spread: ${downSpread.toFixed(4)}`
  );

  console.log('='.repeat(80));
  console.log('Press Ctrl+C to exit');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
