// The feed: every line carries the time; at the bottom — the live status line:
// what runs, for how long, and when the agent last showed signs of life. The
// live line exists only in a terminal; control characters never reach the
// journal. Feed lines print above it: console.log clears the line, prints,
// and redraws it.
import { format } from 'node:util';
const FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const REDRAW_MS = 100;
const CLEAR = '\r\u001b[2K';
let current = null;
let frame = 0;
let installed = false;
let live = false;
export function duration(ms) {
    const seconds = Math.max(0, Math.floor(ms / 1000));
    const minutes = Math.floor(seconds / 60);
    if (minutes === 0)
        return `${seconds}s`;
    const hours = Math.floor(minutes / 60);
    if (hours === 0)
        return `${minutes}m ${seconds % 60}s`;
    return `${hours}h ${minutes % 60}m`;
}
/** The time goes after leading newlines; an empty line needs none. */
export function stamp(text, at) {
    const lead = /^\n*/.exec(text)?.[0] ?? '';
    const rest = text.slice(lead.length);
    if (!rest.trim())
        return text;
    return `${lead}${at.toLocaleTimeString('en-GB')} ${rest}`;
}
export function formatActivity(activity, now, tick) {
    if (activity.waiting)
        return `… ${activity.label}`;
    const parts = [activity.label, duration(now - activity.startedAt)];
    if (activity.lastEventAt !== null)
        parts.push(`last event ${duration(now - activity.lastEventAt)} ago`);
    return `${FRAMES[tick % FRAMES.length] ?? ''} ${parts.join(' · ')}`;
}
function render() {
    if (current === null)
        return '';
    const line = formatActivity(current, Date.now(), frame);
    const width = process.stdout.columns || 80;
    return line.length >= width ? `${line.slice(0, width - 2)}…` : line;
}
function redraw() {
    process.stdout.write(`${CLEAR}${render()}`);
}
/** Feed lines always carry the time; the live line exists only in a terminal. */
export function installFeed() {
    if (installed)
        return;
    installed = true;
    // Outside a terminal isTTY is undefined; for `if` that is false.
    live = process.stdout.isTTY;
    const log = console.log.bind(console);
    console.log = (...args) => {
        if (live)
            process.stdout.write(CLEAR);
        log(stamp(format(...args), new Date()));
        if (live)
            process.stdout.write(render());
    };
    if (!live)
        return;
    setInterval(() => {
        if (current === null || current.waiting)
            return;
        frame += 1;
        redraw();
    }, REDRAW_MS).unref();
    process.on('exit', () => {
        process.stdout.write(CLEAR);
    });
}
export function beginActivity(label, options) {
    const now = Date.now();
    current = { label, startedAt: now, lastEventAt: options.events ? now : null, waiting: false };
    if (live)
        redraw();
}
export function touchActivity() {
    if (current?.lastEventAt != null)
        current.lastEventAt = Date.now();
}
export function waitActivity(label) {
    current = { label, startedAt: Date.now(), lastEventAt: null, waiting: true };
    if (live)
        redraw();
}
export function endActivity() {
    current = null;
    if (live)
        redraw();
}
