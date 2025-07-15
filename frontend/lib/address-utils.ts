/**
 * Formats a long address to a shorter display format
 * @param address - The full address string
 * @param startChars - Number of characters to show at the start (default: 6)
 * @param endChars - Number of characters to show at the end (default: 4)
 * @returns Formatted address string
 */
export function formatAddress(
  address: string,
  startChars = 6,
  endChars = 4,
): string {
  if (address.length <= startChars + endChars) {
    return address;
  }
  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
}

/**
 * Validates if a string is a valid Solana address
 * @param address - The address to validate
 * @returns boolean indicating if address is valid
 */
export function isValidSolanaAddress(address: string): boolean {
  try {
    // Basic validation - Solana addresses are base58 encoded and 32-44 characters
    return /^[A-HJ-NP-Za-km-z1-9]{32,44}$/.test(address);
  } catch {
    return false;
  }
}

/**
 * Copies text to clipboard with error handling
 * @param text - Text to copy
 * @returns Promise<boolean> - Success status
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    return false;
  }
}
