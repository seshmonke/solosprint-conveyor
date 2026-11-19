// The feed: every line carries the time; at the bottom — the live status line:
// what runs, for how long, and when the agent last showed signs of life. The
// live line exists only in a terminal; control characters never reach the
// journal. Feed lines print above it: console.log clears the line, prints,
// and redraws it.

import { format } from 'node:util';

const FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const REDRAW_MS = 100;
const CLEAR = '\r\u001b[2K';

type Activity = {
  label: string;
  startedAt: number;
  /** The last agent event; null — the process has no events (the gate). */
  lastEventAt: number | null;
  /** Waiting for the owner: a line without a spinner or timers. */
  waiting: boolean;
};

let current: Activity | null = null;
let frame = 0;
let installed = false;
let live = false;

export function duration(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(seconds / 60);
  if (minutes === 0) return `${seconds}s`;
  const hours = Math.floor(minutes / 60);
  if (hours === 0) return `${minutes}m ${seconds % 60}s`;
  return `${hours}h ${minutes % 60}m`;
}

/** The time goes after leading newlines; an empty line needs none. */
export function stamp(text: string, at: Date): string {
  const lead = /^\n*/.exec(text)?.[0] ?? '';
  const rest = text.slice(lead.length);
  if (!rest.trim()) return text;
  return `${lead}${at.toLocaleTimeString('en-GB')} ${rest}`;
}

export function formatActivity(activity: Activity, now: number, tick: number): string {
  if (activity.waiting) return `… ${activity.label}`;
  const parts = [activity.label, duration(now - activity.startedAt)];
  if (activity.lastEventAt !== null)
    parts.push(`last event ${duration(now - activity.lastEventAt)} ago`);
  return `${FRAMES[tick % FRAMES.length] ?? ''} ${parts.join(' · ')}`;
}

function render(): string {
  if (current === null) return '';
  const line = formatActivity(current, Date.now(), frame);
  const width = process.stdout.columns || 80;
  return line.length >= width ? `${line.slice(0, width - 2)}…` : line;
}

function redraw(): void {
  process.stdout.write(`${CLEAR}${render()}`);
}

/** Feed lines always carry the time; the live line exists only in a terminal. */
export function installFeed(): void {
  if (installed) return;
  installed = true;
  // Outside a terminal isTTY is undefined; for `if` that is false.
  live = process.stdout.isTTY;
  const log = console.log.bind(console);
  console.log = (...args: unknown[]) => {
    if (live) process.stdout.write(CLEAR);
    log(stamp(format(...args), new Date()));
    if (live) process.stdout.write(render());
  };
  if (!live) return;
  setInterval(() => {
    if (current === null || current.waiting) return;
    frame += 1;
    redraw();
  }, REDRAW_MS).unref();
  process.on('exit', () => {
    process.stdout.write(CLEAR);
  });
}

export function beginActivity(label: string, options: { events: boolean }): void {
  const now = Date.now();
  current = { label, startedAt: now, lastEventAt: options.events ? now : null, waiting: false };
  if (live) redraw();
}

export function touchActivity(): void {
  if (current?.lastEventAt != null) current.lastEventAt = Date.now();
}

export function waitActivity(label: string): void {
  current = { label, startedAt: Date.now(), lastEventAt: null, waiting: true };
  if (live) redraw();
}

export function endActivity(): void {
  current = null;
  if (live) redraw();
}
