import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { createWriteStream } from 'node:fs';

export type RunResult = { code: number; output: string };

/** Short synchronous command (git, ss); a non-zero code is an exception. */
export function sh(cmd: string, args: string[], cwd: string): string {
  const result = spawnSync(cmd, args, { cwd, encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`${cmd} ${args.join(' ')} (${cwd}): ${result.stderr || result.stdout}`.trim());
  }
  return result.stdout.trim();
}

/** The same without exceptions: code and output. */
export function trySh(cmd: string, args: string[], cwd: string): RunResult {
  const result = spawnSync(cmd, args, { cwd, encoding: 'utf8' });
  return { code: result.status ?? 1, output: `${result.stdout}${result.stderr}`.trim() };
}

/** Long command (the verify gate): output goes to the journal and memory. */
export function run(cmd: string, args: string[], cwd: string, logFile: string): Promise<RunResult> {
  return new Promise((resolve) => {
    const log = createWriteStream(logFile);
    const child = spawn(cmd, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    const collect = (chunk: Buffer) => {
      output += chunk.toString();
      log.write(chunk);
    };
    child.stdout.on('data', collect);
    child.stderr.on('data', collect);
    child.on('close', (code) => {
      log.end();
      resolve({ code: code ?? 1, output });
    });
  });
}

/** A process for the duration of owner waiting (Storybook, preview); own group — killed whole. */
export function startBackground(
  cmd: string,
  args: string[],
  cwd: string,
  logFile: string,
): ChildProcess {
  const log = createWriteStream(logFile);
  const child = spawn(cmd, args, { cwd, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.pipe(log);
  child.stderr.pipe(log);
  return child;
}

export function stopBackground(child: ChildProcess): void {
  if (child.pid === undefined || child.exitCode !== null) return;
  try {
    process.kill(-child.pid, 'SIGTERM');
  } catch {
    // The group has already finished.
  }
}

/** Waits for a line in the process output: readiness is judged by output, not by polling the port. */
export function waitForOutput(
  child: ChildProcess,
  pattern: RegExp,
  timeoutMs: number,
): Promise<boolean> {
  return new Promise((resolve) => {
    let seen = '';
    const timer = setTimeout(() => {
      resolve(false);
    }, timeoutMs);
    const onData = (chunk: Buffer) => {
      seen += chunk.toString();
      if (pattern.test(seen)) {
        clearTimeout(timer);
        resolve(true);
      }
    };
    child.stdout?.on('data', onData);
    child.stderr?.on('data', onData);
    child.on('close', () => {
      clearTimeout(timer);
      resolve(pattern.test(seen));
    });
  });
}

/** Busy ports from the list — via the socket table, no connection attempts. */
export function busyPorts(ports: number[]): number[] {
  const listening = trySh('ss', ['-ltnH'], '/').output;
  return ports.filter((port) => new RegExp(`:${port}\\s`).test(listening));
}

/** The process is alive (signal 0 checks without sending anything). */
export function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
