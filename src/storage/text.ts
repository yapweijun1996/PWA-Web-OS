import { LIMITS } from '../contracts';

const encoder = new TextEncoder();
// In Unicode mode a valid pair is matched as a single code point, not a surrogate.
const loneSurrogate = /[\uD800-\uDFFF]/u;

function exceedsBytes(text: string, limit: number): boolean {
  return text.length > limit || encoder.encode(text).byteLength > limit;
}

export function draftError(title: unknown, body: unknown): 'invalid' | 'limit_exceeded' | undefined {
  if (typeof title !== 'string' || typeof body !== 'string'
      || loneSurrogate.test(title) || loneSurrogate.test(body)) {
    return 'invalid';
  }
  if (exceedsBytes(title, LIMITS.titleBytes) || exceedsBytes(body, LIMITS.bodyBytes)) {
    return 'limit_exceeded';
  }
}
