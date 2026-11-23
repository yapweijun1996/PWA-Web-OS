import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';

export async function startRecoveryTunnel(loopback: string, configPath: string) {
  // Keep this process independent of any tunnels configured on the host.
  await writeFile(configPath, '{}\n');
  const child = spawn('cloudflared', [
    'tunnel', '--config', configPath, '--no-autoupdate', '--protocol', 'http2',
    '--url', new URL(loopback).origin,
  ], { stdio: ['ignore', 'pipe', 'pipe'] });
  const closed = new Promise<void>(resolve => child.once('close', () => resolve()));
  let output = '';
  let deadline: ReturnType<typeof setTimeout> | undefined;

  async function close() {
    child.kill('SIGTERM');
    const force = setTimeout(() => child.kill('SIGKILL'), 5_000);
    try { await closed; }
    finally { clearTimeout(force); }
  }

  try {
    const origin = await new Promise<string>((resolve, reject) => {
      function inspect(chunk: Buffer) {
        output = (output + chunk.toString()).slice(-8_192);
        const address = /https:\/\/[a-z0-9-]+\.trycloudflare\.com\b/.exec(output)?.[0];
        if (address) resolve(address);
      }
      child.stdout.on('data', inspect);
      child.stderr.on('data', inspect);
      child.once('error', reject);
      child.once('close', code => reject(new Error(`Cloudflare Quick Tunnel exited with code ${code}\n${output}`)));
      deadline = setTimeout(() => reject(new Error(`Cloudflare Quick Tunnel did not issue an HTTPS address\n${output}`)), 45_000);
    });
    return { url: new URL(new URL(loopback).pathname, origin).href, close, diagnostics: () => output };
  } catch (error) {
    await close();
    throw error;
  } finally {
    clearTimeout(deadline);
  }
}
