import { expect, test } from 'vitest';
import { createBuildId } from './build-info';

test('encodes the build timestamp as a short ID', () => {
  expect(createBuildId(36 ** 7)).toBe('b-10000000');
});
