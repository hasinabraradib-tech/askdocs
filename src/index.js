// Index a folder so it can be asked about. `npm run index -- <folder>`
import { ragIngest, ragCloseWorkspace, ragDeleteWorkspace, unloadModel, close } from '@qvac/sdk'
import { existsSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { EMBED_MODEL, WORKSPACE, load } from './models.js'
import { readFolder, TEXT_EXTENSIONS } from './passages.js'
import { saveSources } from './store.js'

const folder = process.argv[2]
let modelId

try {
  if (!folder || !existsSync(folder) || !statSync(folder).isDirectory()) {
    throw new Error('Usage: npm run index -- <folder of notes>')
  }

  const passages = readFolder(folder)
  if (passages.length === 0) {
    throw new Error(`No ${TEXT_EXTENSIONS.join(' / ')} files found in ${folder}`)
  }
  const files = new Set(passages.map((p) => p.file)).size
  console.error(`  found ${passages.length} passages in ${files} files`)

  modelId = await load(EMBED_MODEL, 'embedding model')

  // Start from an empty store. Re-indexing the same folder would otherwise
  // store every passage twice, and each would come back twice in a search.
  await ragDeleteWorkspace({ workspace: WORKSPACE }).catch(() => {})

  const result = await ragIngest({
    modelId,
    workspace: WORKSPACE,
    documents: passages.map((p) => p.text),
    // Already split along paragraph lines above; letting the SDK re-chunk
    // would cut passages at arbitrary points and break the map back to files.
    chunk: false,
    onProgress: (stage, current, total) => {
      if (process.stderr.isTTY) process.stderr.write(`\r  ${stage} ${current}/${total}   `)
    }
  })
  if (process.stderr.isTTY) process.stderr.write('\n')

  saveSources({ folder: resolve(folder), passages })

  const dropped = result.droppedIndices.length
  console.log(`\nIndexed ${passages.length - dropped} passages from ${files} files in ${folder}.`)
  if (dropped) console.log(`${dropped} could not be embedded and were skipped.`)
  console.log('Ask a question with: npm run ask -- "your question"')
} catch (error) {
  console.error(`\n  ${error?.message ?? error}`)
  process.exitCode = 1
} finally {
  await ragCloseWorkspace({ workspace: WORKSPACE }).catch(() => {})
  if (modelId) await unloadModel({ modelId }).catch(() => {})
  await close().catch(() => {})
}
