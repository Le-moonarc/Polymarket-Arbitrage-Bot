#!/usr/bin/env node
/**
 * Flash Crash Strategy Runner
 * 
 * CLI entry point for running the Flash Crash trading strategy
 */

import * as dotenv from 'dotenv';
import { TradingBot } from '../core/bot';
import { Config } from '../core/config';
import { FlashCrashStrategy, FlashCrashConfig } from '../strategies/flash-crash';
import { CoinSymbol } from '../types';

// Load environment variables
dotenv.config();

async function main() {
  const args = process.argv.slice(2);
  
  // Parse arguments (simplified - use a proper CLI library in production)
  const coin = (args.find((a) => a.startsWith('--coin'))?.split('=')[1] || 'ETH').toUpperCase() as CoinSymbol;
  const size = parseFloat(args.find((a) => a.startsWith('--size'))?.split('=')[1] || '5.0');
  const drop = parseFloat(args.find((a) => a.startsWith('--drop'))?.split('=')[1] || '0.30');
  const lookback = parseInt(args.find((a) => a.startsWith('--lookback'))?.split('=')[1] || '10', 10);
  const takeProfit = parseFloat(args.find((a) => a.startsWith('--take-profit'))?.split('=')[1] || '0.10');
  const stopLoss = parseFloat(args.find((a) => a.startsWith('--stop-loss'))?.split('=')[1] || '0.05');

  // Check environment
  const privateKey = process.env.POLY_PRIVATE_KEY;
  const safeAddress = process.env.POLY_PROXY_WALLET;

  if (!privateKey || !safeAddress) {
    console.error('Error: POLY_PRIVATE_KEY and POLY_PROXY_WALLET must be set');
    console.error('Set them in .env file or export as environment variables');
    process.exit(1);
  }

  // Create bot
  const config = Config.fromEnv();
  const bot = new TradingBot(undefined, config, undefined, undefined, privateKey);

  if (!bot.isInitialized()) {
    console.error('Error: Failed to initialize bot');
    process.exit(1);
  }

  // Create strategy config
  const strategyConfig: FlashCrashConfig = {
    coin,
    size,
    dropThreshold: drop,
    priceLookbackSeconds: lookback,
    takeProfit,
    stopLoss,
  };

  // Print configuration
  console.log('\n' + '='.repeat(60));
  console.log(`  Flash Crash Strategy - ${coin} 15-Minute Markets`);
  console.log('='.repeat(60) + '\n');

  console.log('Configuration:');
  console.log(`  Coin: ${coin}`);
  console.log(`  Size: $${size.toFixed(2)}`);
  console.log(`  Drop threshold: ${drop.toFixed(2)}`);
  console.log(`  Lookback: ${lookback}s`);
  console.log(`  Take profit: +$${takeProfit.toFixed(2)}`);
  console.log(`  Stop loss: -$${stopLoss.toFixed(2)}`);
  console.log();

  // Create and run strategy
  const strategy = new FlashCrashStrategy(bot, strategyConfig);

  try {
    await strategy.run();
  } catch (error: any) {
    console.error(`\nError: ${error.message}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
