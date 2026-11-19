import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { loadInstance } from "./instance.js";
// Conveyor configuration — docs/conveyor.md. Environment variables are the
// instance seams: a trial run and tests point them at a stub and a scratch repo.
/** Root of the instance repository: where `solosprint-conveyor` is run from. */
export const REPO = resolve(process.env['SOLOSPRINT_REPO'] ?? process.cwd());
/** The conveyor's own checkout: prompts and the methodology docs the roles read. */
export const CONVEYOR_DIR = resolve(import.meta.dirname, '..');
/** Working copy — in the home directory, not a temp dir: containers may not see /tmp. */
export const WORKTREE = process.env['SOLOSPRINT_WORKTREE'] ?? join(homedir(), 'solosprint-worktree');
/** State, owner questions, journals — outside git. */
export const STATE_DIR = process.env['SOLOSPRINT_STATE'] ?? join(REPO, '.solosprint');
/** Adapter binary (or stub); may carry its own leading args: "node adapters/stub/stub.ts". */
export const ADAPTER_BIN = process.env['SOLOSPRINT_AGENT_BIN'] ?? 'solosprint-adapter-opencode';
/** Emergency brake on one agent session, a client-side estimate in dollars. */
export const MAX_BUDGET_USD = process.env['SOLOSPRINT_MAX_BUDGET_USD'];
/** Fix rounds on a red gate or a REJECT before the owner is asked. */
export const MAX_FIX_ROUNDS = 2;
/** The gate; overridden only for trial runs. */
export const GATE = (process.env['SOLOSPRINT_GATE'] ?? 'pnpm verify').split(' ');
/** Install before the gate; overridden only for trial runs. */
export const INSTALL = (process.env['SOLOSPRINT_INSTALL'] ?? 'pnpm install --frozen-lockfile --prefer-offline').split(' ');
export const ANSWER_POLL_MS = 3000;
export const instance = loadInstance(REPO);
export const E2E_PORTS = instance.ports.e2e;
export const LIVE_PORTS = instance.ports.live;
export const STORYBOOK_PORT = instance.ports.storybook;
