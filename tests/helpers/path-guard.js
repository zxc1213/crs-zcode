import path from 'node:path';

/**
 * path.join with an enforced boundary: the resolved target must stay inside
 * `root`. Guards test fixtures against accidentally writing outside the
 * temporary base directory (LLM-shaped ids flow through these helpers).
 * @param {string} root - boundary directory
 * @param {...string} segments - path segments to join under root
 * @returns {string} absolute path guaranteed to be within root
 */
export function safeJoin(root, ...segments) {
  const base = path.resolve(root);
  const target = path.resolve(base, ...segments);
  if (target !== base && !target.startsWith(base + path.sep)) {
    throw new Error(`path escapes boundary [${base}]: ${segments.join('/')}`);
  }
  return target;
}
