# Polymarket Arbitrage Bot (TypeScript)

Production-ready TypeScript trading bot for Polymarket with gasless transactions and real-time WebSocket orderbook streaming.

## Features

- **Dutch Book Arbitrage** - Automatic guaranteed-profit trading when UP_ASK + DOWN_ASK < 1.0
- **Gasless Trading** - Builder Program integration for zero gas fees
- **Real-time WebSocket** - Live orderbook updates and market data
- **15-Minute Markets** - Built-in support for BTC/ETH/SOL/XRP markets
- **Flash Crash Strategy** - Pre-built volatility trading strategy
- **TypeScript** - Fully typed codebase for better development experience
- **Modern Architecture** - Clean, modular code structure

## Quick Start

### Installation

```bash
git clone https://github.com/vladmeer/polymarket-arbitrage-bot.git
cd polymarket-arbitrage-bot
npm install
```

### Configuration

Set environment variables:

```bash
export POLY_PRIVATE_KEY=your_private_key
export POLY_PROXY_WALLET=0xYourPolymarketProxyWallet
```

> **PROXY WALLET**: Find at [polymarket.com/settings](https://polymarket.com/settings)

### Quick Start - Orderbook Viewer

View real-time orderbook data (read-only, no trading):

```bash
# View ETH market orderbook
npm run orderbook-viewer -- --coin=ETH
```

**Note:** Orderbook viewer doesn't require credentials - it's a read-only monitoring tool.

#### Quick Start - Dutch Book Arbitrage

Run the automated Dutch book arbitrage bot:

```bash
# Monitor and trade arbitrage opportunities (BTC, ETH, SOL, XRP)
npm run dutch-book -- --coin=ETH
```

**Note:** Dutch book arbitrage requires `POLY_PRIVATE_KEY` and `POLY_PROXY_WALLET` environment variables.

### Quick Start - Flash Crash Strategy

Run the automated trading strategy:

```bash
# Run with default settings (ETH, $5 size, 30% drop threshold)
npm run flash-crash -- --coin=ETH
```

**Note:** Flash crash strategy requires `POLY_PRIVATE_KEY` and `POLY_PROXY_WALLET` environment variables.

## Trading Strategies

### Dutch Book Arbitrage

**Guaranteed Profit Trading** - Real-time WebSocket monitoring detects arbitrage opportunities when the sum of UP_ASK + DOWN_ASK prices is less than 1.0. The bot automatically executes trades on both sides, locking in a guaranteed profit at market resolution.

**How it works:**
- Monitors BTC, ETH, SOL, XRP 15-minute markets in real-time
- Detects when `UP_ASK + DOWN_ASK < 1.0` (arbitrage opportunity)
- Automatically executes simultaneous buy orders on both UP and DOWN tokens
- Guaranteed profit at market resolution regardless of outcome

**Example:**
- UP token ask price: 0.48
- DOWN token ask price: 0.49
- Total cost: 0.97
- Guaranteed payout: 1.00
- **Profit: 0.03 (3%)**

### Flash Crash Strategy

Monitors 15-minute markets for sudden probability drops and executes trades automatically.

```bash
# Default settings
npm run flash-crash -- --coin=BTC
```

**Parameters:**
- `--coin` - BTC, ETH, SOL, XRP (default: ETH)
- `--drop` - Drop threshold (default: 0.30)
- `--size` - Trade size in USDC (default: 5.0)
- `--lookback` - Detection window in seconds (default: 10)
- `--take-profit` - Take profit in dollars (default: 0.10)
- `--stop-loss` - Stop loss in dollars (default: 0.05)

### Orderbook Viewer

Real-time orderbook visualization:

```bash
npm run orderbook-viewer -- --coin=BTC
```

## Usage Examples

### Basic Usage

```typescript
import { createBotFromEnv } from './utils';
import { TradingBot, Config } from './core/bot';

const bot = createBotFromEnv();
const orders = await bot.getOpenOrders();
console.log(`Open orders: ${orders.length}`);
```

### Place Order

```typescript
import { TradingBot, Config } from './core/bot';

const config = new Config();
config.safeAddress = '0x...';
const bot = new TradingBot(undefined, config, undefined, undefined, '0x...');

const result = await bot.placeOrder(
  'token_id',
  0.65,
  10.0,
  'BUY'
);
```

### WebSocket Streaming

```typescript
import { MarketWebSocket } from './services/websocket';

const ws = new MarketWebSocket();
ws.onBook((snapshot) => {
  console.log(`Price: ${snapshot.midPrice.toFixed(4)}`);
});

await ws.subscribe(['token_id']);
await ws.run();
```

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `POLY_PRIVATE_KEY` | Yes | Wallet private key |
| `POLY_PROXY_WALLET` | Yes | Polymarket Proxy wallet address |
| `POLY_BUILDER_API_KEY` | Optional | Builder Program API key (gasless) |
| `POLY_BUILDER_API_SECRET` | Optional | Builder Program API secret |
| `POLY_BUILDER_API_PASSPHRASE` | Optional | Builder Program passphrase |

### Config File

Create `config.yaml`:

```yaml
safe_address: "0xYourAddress"
builder:
  api_key: "your_key"
  api_secret: "your_secret"
  api_passphrase: "your_passphrase"
```

Load with: `new TradingBot('config.yaml', undefined, undefined, undefined, '0x...')`

## Gasless Trading

Enable gasless trading via Builder Program:

1. Apply at [polymarket.com/settings?tab=builder](https://polymarket.com/settings?tab=builder)
2. Set environment variables: `POLY_BUILDER_API_KEY`, `POLY_BUILDER_API_SECRET`, `POLY_BUILDER_API_PASSPHRASE`

The bot automatically uses gasless mode when credentials are present.

## Project Structure

```
polymarket-arbitrage-bot/
├── core/                    # Core trading functionality
│   ├── bot.ts              # TradingBot class
│   ├── client.ts           # API clients (CLOB, Relayer)
│   ├── config.ts           # Configuration management
│   └── signer.ts           # EIP-712 order signing
├── services/               # Service layer
│   ├── websocket.ts        # WebSocket client
│   ├── gamma.ts            # Market discovery
│   └── market.ts           # Market manager
├── strategies/             # Trading strategies
│   ├── dutch-book.ts      # Dutch book arbitrage strategy
│   └── flash-crash.ts     # Flash crash strategy
├── cli/                    # CLI applications
│   ├── flash-crash-runner.ts
│   └── orderbook-viewer.ts
├── utils/                  # Utility functions
└── types/                  # TypeScript type definitions
```

## Building

```bash
# Build TypeScript
npm run build

# Run in development mode
npm run dev

# Run production build
npm start
```

## Security

- Never commit `.env` files
- Use a dedicated trading wallet
- Keep private keys secure
- Review all code before running with real funds

## API Reference

**TradingBot**: `placeOrder()`, `cancelOrder()`, `getOpenOrders()`, `getTrades()`, `getOrderBook()`, `getMarketPrice()`

**MarketWebSocket**: `subscribe()`, `run()`, `disconnect()`, `getOrderbook()`, `getMidPrice()`

**GammaClient**: `getMarketInfo()`, `getCurrent15mMarket()`, `getMarketBySlug()`

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Missing credentials | Set `POLY_PRIVATE_KEY` and `POLY_PROXY_WALLET` |
| Invalid private key | Ensure 64 hex characters (0x prefix optional) |
| Order failed | Check sufficient balance |
| WebSocket errors | Verify network/firewall settings |
| TypeScript errors | Run `npm run build` to check for type errors |

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Support & Contact

For questions, issues, or custom bot development:

- **Telegram**: [@Kei4650](https://t.me/Kei4650)
- **X (Twitter)**: [@kei_4650](https://x.com/kei_4650)