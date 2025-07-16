// Ethereum Network Configuration
export const ETHEREUM_CONFIG = {
  CHAIN_ID: 11155111, // Sepolia
  TRANSACTION_TYPE: 2, // EIP-1559
} as const;

// Common ERC20 Addresses (Sepolia)
export const ERC20_ADDRESSES = {
  USDC_SEPOLIA_2: '0xbe72e441bf55620febc26715db68d3494213d8cb',
} as const;

// All ERC20 addresses as an array for compatibility
export const COMMON_ERC20_ADDRESSES = Object.values(ERC20_ADDRESSES);

// Hardcoded recipient address for transfers
export const HARDCODED_RECIPIENT_ADDRESS =
  '0x041477de8ecbcf633cb13ea10aa86cdf4d437c29';

// ERC20 Interface ABI
export const ERC20_TRANSFER_ABI = [
  'function transfer(address to, uint256 amount) returns (bool)',
] as const;
