// Index a folder so it can be asked about. `npm run index -- <folder> [--index name]`
import { ragIngest, ragCloseWorkspace, ragDeleteWorkspace, unloadModel, close } from '@qvac/sdk'
import { existsSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { EMBED_MODEL, workspaceFor, load } from './models.js'
import { parseCli, DEFAULT_INDEX } from './args.js'
import { readFolder, TEXT_EXTENSIONS } from './passages.js'
import { saveSources, plural } from './store.js'

let modelId
let workspace

try {
  const { positionals: [folder], index } = parseCli()
  workspace = workspaceFor(index)

  if (!folder || !existsSync(folder) || !statSync(folder).isDirectory()) {
    throw new Error('Usage: npm run index -- <folder of notes> [--index name]')
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

  const result = await ragIngest({
    modelId,
    workspace,
    documents: passages.map((p) => p.text),
    // Already split along paragraph lines above; letting the SDK re-chunk
    // would cut passages at arbitrary points and break the map back to files.
    chunk: false,
    onProgress: (stage, current, total) => {
      if (process.stderr.isTTY) process.stderr.write(`\r  ${stage} ${current}/${total}   `)
    }
  })
  if (process.stderr.isTTY) process.stderr.write('\n')

  saveSources({ name: index, folder: resolve(folder), passages })

  const dropped = result.droppedIndices.length
  console.log(`\nIndexed ${plural(passages.length - dropped, 'passage')} from ${plural(files, 'file')} in ${folder} as "${index}".`)
  if (dropped) console.log(`${dropped} could not be embedded and were skipped.`)
  const flag = index === DEFAULT_INDEX ? '' : ` --index ${index}`
  console.log(`Ask a question with: npm run ask -- "your question"${flag}`)
} catch (error) {
  console.error(`\n  ${error?.message ?? error}`)
  process.exitCode = 1
} finally {
  if (workspace) await ragCloseWorkspace({ workspace }).catch(() => {})
  if (modelId) await unloadModel({ modelId }).catch(() => {})
  await close().catch(() => {})
}
