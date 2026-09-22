// Index a folder so it can be asked about. `npm run index -- <folder> [--index name] [--watch]`
import { ragCloseWorkspace, ragDeleteWorkspace, unloadModel, close } from '@qvac/sdk'
import { existsSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { EMBED_MODEL, workspaceFor, load } from './models.js'
import { parseCli, DEFAULT_INDEX } from './args.js'
import { readFolder, TEXT_EXTENSIONS } from './passages.js'
import { saveSources, plural } from './store.js'
import { embedPassages } from './embed.js'
import { watchFolder } from './watch.js'

let modelId
let workspace

try {
  const { positionals: [folder], index, watch } = parseCli()
  workspace = workspaceFor(index)

  if (!folder || !existsSync(folder) || !statSync(folder).isDirectory()) {
    throw new Error('Usage: npm run index -- <folder of notes> [--index name] [--watch]')
  }

  const passages = readFolder(folder)
  if (passages.length === 0) {
    throw new Error(`No ${TEXT_EXTENSIONS.join(' / ')} files found in ${folder}`)
  }
  const files = new Set(passages.map((p) => p.file)).size
  console.error(`  found ${plural(passages.length, 'passage')} in ${plural(files, 'file')}`)

  modelId = await load(EMBED_MODEL, 'embedding model')

  // Start from an empty store. Re-indexing the same folder would otherwise
  // store every passage twice, and each would come back twice in a search.
  await ragDeleteWorkspace({ workspace }).catch(() => {})

  const embedded = await embedPassages({
    modelId,
    workspace,
    passages,
    onProgress: (stage, current, total) => {
      if (process.stderr.isTTY) process.stderr.write(`\r  ${stage} ${current}/${total}   `)
    }
  })
  if (process.stderr.isTTY) process.stderr.write('\n')

  saveSources({ name: index, folder: resolve(folder), passages: embedded })

  const dropped = passages.length - embedded.length
  console.log(`\nIndexed ${plural(embedded.length, 'passage')} from ${plural(files, 'file')} in ${folder} as "${index}".`)
  if (dropped) console.log(`${dropped} could not be embedded and were skipped.`)
  const flag = index === DEFAULT_INDEX ? '' : ` --index ${index}`
  console.log(`Ask a question with: npm run ask -- "your question"${flag}`)

  if (watch) {
    // Released first, so questions can be asked while this keeps running.
    await ragCloseWorkspace({ workspace }).catch(() => {})
    await watchFolder({ modelId, workspace, index, root: resolve(folder), passages: embedded })
  }
} catch (error) {
  console.error(`\n  ${error?.message ?? error}`)
  process.exitCode = 1
} finally {
  if (workspace) await ragCloseWorkspace({ workspace }).catch(() => {})
  if (modelId) await unloadModel({ modelId }).catch(() => {})
  await close().catch(() => {})
}
