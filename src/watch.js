// Keep an index in step with its folder. `npm run index -- <folder> --watch`
//
// Only the files that changed are re-embedded: their old passages are removed
// by id and the new ones added. Re-indexing a whole folder of notes to pick up
// one edited paragraph would take far longer than the edit did.
import { ragDeleteEmbeddings, ragCloseWorkspace } from '@qvac/sdk'
import { existsSync, readFileSync, watch } from 'node:fs'
import { extname, join } from 'node:path'
import { splitIntoPassages, TEXT_EXTENSIONS } from './passages.js'
import { embedPassages } from './embed.js'
import { saveSources, plural } from './store.js'

// Editors save in bursts (a temp file, a rename, a metadata touch), so changes
// are collected for a moment and handled together.
const SETTLE_MS = 500

const isNote = (file) =>
  TEXT_EXTENSIONS.includes(extname(file).toLowerCase()) &&
  !file.split(/[\\/]/).some((part) => part.startsWith('.') || part === 'node_modules')

/**
 * Watch `root` until Ctrl+C, updating the index as files change.
 *
 * @returns {Promise<void>} Resolves when the user stops watching.
 */
export function watchFolder ({ modelId, workspace, index, root, passages }) {
  let current = passages
  const pending = new Set()
  let timer = null
  let running = Promise.resolve()

  const update = async (files) => {
    for (const file of files) {
      const path = join(root, file)
      const old = current.filter((p) => p.file === file)
      const fresh = existsSync(path)
        ? splitIntoPassages(readFileSync(path, 'utf8')).map((p) => ({ file, ...p }))
        : []

      if (old.length) await ragDeleteEmbeddings({ workspace, ids: old.map((p) => p.id) })
      const added = await embedPassages({ modelId, workspace, passages: fresh })

      current = [...current.filter((p) => p.file !== file), ...added]
      const what = fresh.length ? `${plural(added.length, 'passage')}` : 'removed'
      console.log(`  ${new Date().toLocaleTimeString()}  ${file}: ${what}`)
    }

    saveSources({ name: index, folder: root, passages: current })
    // Released after every update so `npm run ask` can open the same index
    // from another terminal while this one keeps watching.
    await ragCloseWorkspace({ workspace }).catch(() => {})
  }

  const watcher = watch(root, { recursive: true }, (_event, file) => {
    if (!file || !isNote(file)) return
    pending.add(file)
    clearTimeout(timer)
    timer = setTimeout(() => {
      const files = [...pending]
      pending.clear()
      running = running.then(() => update(files)).catch((error) => {
        console.error(`  update failed: ${error?.message ?? error}`)
      })
    }, SETTLE_MS)
  })

  console.log(`\nWatching ${root} for changes. Press Ctrl+C to stop.`)

  return new Promise((resolve) => {
    process.once('SIGINT', async () => {
      watcher.close()
      clearTimeout(timer)
      await running
      resolve()
    })
  })
}
