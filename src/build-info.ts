export function createBuildId(timestamp: number): string {
  return `b-${timestamp.toString(36)}`;
}
