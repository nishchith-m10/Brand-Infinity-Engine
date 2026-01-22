// Using Jest (project default test runner)
import { spawn } from 'child_process';
import path from 'path';

const CLI = process.execPath; // node
const TSX_CLI = path.join('node_modules', 'tsx', 'dist', 'cli.mjs');

function runScript(scriptPath: string, env: Record<string, string> = {}) {
  return new Promise<{ stdout: string; stderr: string; code: number | null }>((resolve) => {
    const child = spawn(CLI, ['-r', 'dotenv/config', TSX_CLI, scriptPath], {
      env: {
        ...process.env,
        DOTENV_CONFIG_PATH: '.env.local',
        ...env,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (c) => (stdout += c.toString()));
    child.stderr?.on('data', (c) => (stderr += c.toString()));

    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      resolve({ stdout, stderr, code: null });
    }, 5000);

    child.on('exit', (code) => {
      clearTimeout(timer);
      resolve({ stdout, stderr, code });
    });
  });
}

describe('one-off job scripts', () => {

  test('add_embedding_job exits cleanly', async () => {
    const script = path.join('scripts', 'add_embedding_job.ts');
    const res = await runScript(script);
    expect(res.code).toBe(0);
    expect(res.stdout).toMatch(/Added job id:/);
    expect(res.stdout).toMatch(/Closed queue connections/);
  }, 20000);

  test('add_video_job exits cleanly', async () => {
    const script = path.join('scripts', 'add_video_job.ts');
    const res = await runScript(script);
    expect(res.code).toBe(0);
    expect(res.stdout).toMatch(/Added job id:/);
    expect(res.stdout).toMatch(/Closed queue connections/);
  }, 20000);
});