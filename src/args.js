// The --index option shared by every command.
import { parseArgs } from 'node:util'

export const DEFAULT_INDEX = 'default'

// Used as a file name and inside the workspace name, so kept to characters
// that are safe in both.
const INDEX_NAME = /^[a-z0-9][a-z0-9_-]*$/i

/**
 * @returns {{ positionals: string[], index: string }}
 */
export function parseCli (argv = process.argv.slice(2)) {
  const { values, positionals } = parseArgs({
    args: argv,
    options: { index: { type: 'string', short: 'i' } },
    allowPositionals: true
  })

  const index = values.index ?? DEFAULT_INDEX
  if (!INDEX_NAME.test(index)) {
    throw new Error(`--index takes a name made of letters, numbers, - and _ (got "${index}")`)
  }

  return { positionals, index }
}
