import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { REPO, WORKTREE } from "./config.js";
import { sh, trySh } from "./shell.js";
// The sprint runs on a sprint/NN branch in a separate working copy; a closed
// and accepted sprint reaches main fast-forward only, then main is pushed.
export const git = (cwd, ...args) => sh('git', args, cwd);
export function head(cwd) {
    return git(cwd, 'rev-parse', 'HEAD');
}
export function dirty(cwd) {
    return git(cwd, 'status', '--porcelain');
}
/** The sprint branch off the current main in the conveyor working copy. */
export function prepareWorktree(branch) {
    if (!existsSync(WORKTREE)) {
        git(REPO, 'worktree', 'add', '-B', branch, WORKTREE, 'main');
        return;
    }
    const changes = dirty(WORKTREE);
    if (changes)
        throw new Error(`Uncommitted changes in the working copy ${WORKTREE}:\n${changes}`);
    git(WORKTREE, 'switch', '-C', branch, 'main');
}
/** The last commit touching the file — the agreed sprint composition. */
export function lastCommitOf(cwd, file) {
    const sha = git(cwd, 'log', '-1', '--format=%H', 'main', '--', file);
    if (!sha)
        throw new Error(`File ${file} is not committed in main — the composition is not fixed.`);
    return sha;
}
export function changedFiles(cwd, range) {
    return git(cwd, 'diff', '--name-only', range).split('\n').filter(Boolean);
}
export function commitsAhead(cwd, base) {
    return Number(git(cwd, 'rev-list', '--count', `${base}..HEAD`));
}
/**
 * main moved ahead during the sprint (the owner committed) — the sprint
 * branch is rebased onto it. Returns the files that came from main, or the
 * conflict text.
 */
export function rebaseOntoMain(base) {
    const mainHead = git(REPO, 'rev-parse', 'main');
    if (trySh('git', ['merge-base', '--is-ancestor', mainHead, 'HEAD'], WORKTREE).code === 0)
        return { files: [] };
    const files = changedFiles(REPO, `${base}..${mainHead}`);
    const rebase = trySh('git', ['rebase', 'main'], WORKTREE);
    if (rebase.code !== 0) {
        trySh('git', ['rebase', '--abort'], WORKTREE);
        return { conflict: rebase.output };
    }
    return { files };
}
/** Merge the sprint branch into main fast-forward in the main copy. */
export function fastForwardMain(branch) {
    const current = trySh('git', ['symbolic-ref', '--short', 'HEAD'], REPO).output;
    if (current !== 'main')
        return `the main copy has "${current}" checked out, not main`;
    const merge = trySh('git', ['merge', '--ff-only', branch], REPO);
    if (merge.code !== 0)
        return `fast-forward main failed:\n${merge.output}`;
    return null;
}
/** Push main from the main copy: everything accumulated in main ships. Returns the error text. */
export function pushMain() {
    const push = trySh('git', ['push', 'origin', 'main'], REPO);
    return push.code === 0 ? null : push.output;
}
/** Does the repository have CI workflows — without them there is no run to wait for. */
export function hasWorkflows() {
    const dir = join(REPO, '.github/workflows');
    return existsSync(dir) && readdirSync(dir).some((name) => /\.ya?ml$/.test(name));
}
