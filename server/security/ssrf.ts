import dns from 'node:dns/promises';
import { URL } from 'node:url';

const PRIVATE_IP_RANGES = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^0\./,
  /^::1$/,
  /^fc00:/,
  /^fe80:/,
];

export async function validateSafeUrl(rawUrl: string, allowedInternalHost?: string): Promise<boolean> {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return false;
    }

    if (allowedInternalHost && (parsed.host === allowedInternalHost || parsed.hostname === allowedInternalHost)) {
      return true;
    }

    // Must be https for external public instances
    if (parsed.protocol !== 'https:') {
      return false;
    }

    const ips = await dns.resolve(parsed.hostname);
    for (const ip of ips) {
      for (const range of PRIVATE_IP_RANGES) {
        if (range.test(ip)) {
          return false; // Private IP blocked
        }
      }
    }
    return true;
  } catch {
    return false;
  }
}
