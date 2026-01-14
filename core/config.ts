/**
 * Configuration Management Module
 * 
 * Handles loading and validation of bot configuration from YAML files
 * and environment variables.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';
import { BotConfig, BuilderConfig, ClobConfig, RelayerConfig } from '../types';

const ENV_PREFIX = 'POLY_';

function getEnv(name: string, defaultValue: string = ''): string {
  return process.env[`${ENV_PREFIX}${name}`] || defaultValue;
}

function getEnvBool(name: string, defaultValue: boolean = false): boolean {
  const val = getEnv(name, '').toLowerCase();
  if (val === '1' || val === 'true' || val === 'yes' || val === 'on') return true;
  if (val === '0' || val === 'false' || val === 'no' || val === 'off') return false;
  return defaultValue;
}

function getEnvInt(name: string, defaultValue: number = 0): number {
  const val = getEnv(name, '');
  if (val) {
    const parsed = parseInt(val, 10);
    if (!isNaN(parsed)) return parsed;
  }
  return defaultValue;
}

function getEnvFloat(name: string, defaultValue: number = 0.0): number {
  const val = getEnv(name, '');
  if (val) {
    const parsed = parseFloat(val);
    if (!isNaN(parsed)) return parsed;
  }
  return defaultValue;
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

export class ConfigNotFoundError extends ConfigError {
  constructor(filepath: string) {
    super(`Config file not found: ${filepath}`);
    this.name = 'ConfigNotFoundError';
  }
}

export class Config {
  safeAddress: string = '';
  rpcUrl: string = 'https://polygon-rpc.com';
  clob: ClobConfig = {
    host: 'https://clob.polymarket.com',
    chainId: 137,
    signatureType: 2,
  };
  relayer: RelayerConfig = {
    host: 'https://relayer-v2.polymarket.com',
    txType: 'SAFE',
  };
  builder: BuilderConfig = {
    apiKey: '',
    apiSecret: '',
    apiPassphrase: '',
  };
  defaultTokenId: string = '';
  defaultSize: number = 1.0;
  defaultPrice: number = 0.5;
  dataDir: string = 'credentials';
  logLevel: string = 'INFO';
  useGasless: boolean = false;

  constructor() {
    // Auto-enable gasless if builder is configured
    if (isBuilderConfigured(this.builder)) {
      this.useGasless = true;
    }
  }

  static load(filepath: string = 'config.yaml'): Config {
    if (!fs.existsSync(filepath)) {
      throw new ConfigNotFoundError(filepath);
    }

    const content = fs.readFileSync(filepath, 'utf-8');
    const data = yaml.parse(content) || {};

    return Config.fromDict(data);
  }

  static fromDict(data: Record<string, any>): Config {
    const config = new Config();

    if (data.safe_address) config.safeAddress = data.safe_address.toLowerCase();
    if (data.rpc_url) config.rpcUrl = data.rpc_url;

    if (data.clob) {
      config.clob = {
        host: data.clob.host || config.clob.host,
        chainId: data.clob.chain_id || config.clob.chainId,
        signatureType: data.clob.signature_type || config.clob.signatureType,
      };
    }

    if (data.relayer) {
      config.relayer = {
        host: data.relayer.host || config.relayer.host,
        txType: data.relayer.tx_type || config.relayer.txType,
      };
    }

    if (data.builder) {
      config.builder = {
        apiKey: data.builder.api_key || '',
        apiSecret: data.builder.api_secret || '',
        apiPassphrase: data.builder.api_passphrase || '',
      };
    }

    if (data.default_token_id) config.defaultTokenId = data.default_token_id;
    if (data.default_size) config.defaultSize = parseFloat(data.default_size);
    if (data.default_price) config.defaultPrice = parseFloat(data.default_price);
    if (data.data_dir) config.dataDir = data.data_dir;
    if (data.log_level) config.logLevel = data.log_level.toUpperCase();

    config.useGasless = isBuilderConfigured(config.builder);

    return config;
  }

  static fromEnv(): Config {
    const config = new Config();

    const safeAddress = getEnv('PROXY_WALLET');
    if (safeAddress) config.safeAddress = safeAddress.toLowerCase();

    const rpcUrl = getEnv('RPC_URL');
    if (rpcUrl) config.rpcUrl = rpcUrl;

    const apiKey = getEnv('BUILDER_API_KEY');
    const apiSecret = getEnv('BUILDER_API_SECRET');
    const apiPassphrase = getEnv('BUILDER_API_PASSPHRASE');
    if (apiKey || apiSecret || apiPassphrase) {
      config.builder = {
        apiKey,
        apiSecret,
        apiPassphrase,
      };
    }

    const clobHost = getEnv('CLOB_HOST');
    const chainId = getEnvInt('CHAIN_ID', 137);
    if (clobHost) {
      config.clob = {
        host: clobHost,
        chainId,
        signatureType: 2,
      };
    } else if (chainId !== 137) {
      config.clob.chainId = chainId;
    }

    const dataDir = getEnv('DATA_DIR');
    if (dataDir) config.dataDir = dataDir;

    const logLevel = getEnv('LOG_LEVEL');
    if (logLevel) config.logLevel = logLevel.toUpperCase();

    const defaultSize = getEnvFloat('DEFAULT_SIZE');
    if (defaultSize) config.defaultSize = defaultSize;

    const defaultPrice = getEnvFloat('DEFAULT_PRICE');
    if (defaultPrice) config.defaultPrice = defaultPrice;

    config.useGasless = isBuilderConfigured(config.builder);

    return config;
  }

  static loadWithEnv(filepath: string = 'config.yaml'): Config {
    let config: Config;
    if (fs.existsSync(filepath)) {
      config = Config.load(filepath);
    } else {
      config = new Config();
    }

    // Override with environment variables
    const safeAddress = getEnv('PROXY_WALLET');
    if (safeAddress) config.safeAddress = safeAddress.toLowerCase();

    const rpcUrl = getEnv('RPC_URL');
    if (rpcUrl) config.rpcUrl = rpcUrl;

    const apiKey = getEnv('BUILDER_API_KEY');
    const apiSecret = getEnv('BUILDER_API_SECRET');
    const apiPassphrase = getEnv('BUILDER_API_PASSPHRASE');
    if (apiKey) config.builder.apiKey = apiKey;
    if (apiSecret) config.builder.apiSecret = apiSecret;
    if (apiPassphrase) config.builder.apiPassphrase = apiPassphrase;

    const dataDir = getEnv('DATA_DIR');
    if (dataDir) config.dataDir = dataDir;

    const logLevel = getEnv('LOG_LEVEL');
    if (logLevel) config.logLevel = logLevel.toUpperCase();

    config.useGasless = isBuilderConfigured(config.builder);

    return config;
  }

  validate(): string[] {
    const errors: string[] = [];

    if (!this.safeAddress) errors.push('safeAddress is required');
    if (!this.rpcUrl) errors.push('rpcUrl is required');
    if (!this.clob.host || !this.clob.host.startsWith('http')) {
      errors.push('clob configuration is invalid');
    }
    if (this.useGasless && !this.builder.isConfigured()) {
      errors.push('gasless mode enabled but builder credentials not configured');
    }

    return errors;
  }

  getCredentialPath(name: string): string {
    return path.join(this.dataDir, name);
  }

  getEncryptedKeyPath(): string {
    return this.getCredentialPath('encrypted_key.json');
  }

  getApiCredsPath(): string {
    return this.getCredentialPath('api_creds.json');
  }
}

// Helper function for BuilderConfig
export function isBuilderConfigured(builder: BuilderConfig): boolean {
  return !!(builder.apiKey && builder.apiSecret && builder.apiPassphrase);
}
