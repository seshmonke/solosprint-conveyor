import { z } from 'zod';

// The feed renders adapter events: a progress event is one line. The full
// stream goes to the session journal.

const TEXT_LIMIT = 300;

const progressEvent = z.object({
  type: z.literal('progress'),
  text: z.string(),
});

const oneLine = (text: string) => {
  const flat = text.replaceAll(/\s+/g, ' ').trim();
  return flat.length > TEXT_LIMIT ? `${flat.slice(0, TEXT_LIMIT - 1)}…` : flat;
};

/** Feed lines from an adapter event; anything but progress is not shown. */
export function describeEvent(event: unknown): string[] {
  const parsed = progressEvent.safeParse(event);
  if (!parsed.success) return [];
  return [`› ${oneLine(parsed.data.text)}`];
}

/**
 * The session environment without the harness variables of a parent agent:
 * a conveyor started from inside an agent session would otherwise hand the
 * child sessions its own config, server, and auth. The adapter keeps the
 * user's config through the default config directories.
 */
export function agentEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return Object.fromEntries(Object.entries(env).filter(([key]) => !/^OPENCODE_/.test(key)));
}
