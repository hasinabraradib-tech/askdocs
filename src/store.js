// Where each indexed passage came from, one map per named index.
//
// The SDK's vector store keeps only the text of a passage, not which file or
// line it was taken from. So indexing also writes this small map, and a
// search result is traced back to its source by looking its text up here.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'

const STORE_DIR = '.askdocs'

const mapPath = (name) => join(STORE_DIR, `${name}.json`)

export function saveSources ({ name, folder, passages }) {
  mkdirSync(STORE_DIR, { recursive: true })
  writeFileSync(mapPath(name), JSON.stringify({ name, folder, indexedAt: new Date().toISOString(), passages }, null, 2))
}

/** @returns {{name: string, folder: string, passages: Array, byText: Map} | null} */
export function loadSources (name) {
  if (!existsSync(mapPath(name))) return null
  const saved = JSON.parse(readFileSync(mapPath(name), 'utf8'))
  return { ...saved, byText: new Map(saved.passages.map((p) => [p.text, p])) }
}

/** Every index on disk, read from the maps alone so no model has to load. */
export function listIndexes () {
  if (!existsSync(STORE_DIR)) return []
  return readdirSync(STORE_DIR)
    .filter((file) => file.endsWith('.json'))
    .map((file) => {
      const saved = JSON.parse(readFileSync(join(STORE_DIR, file), 'utf8'))
      return {
        name: basename(file, '.json'),
        folder: saved.folder,
        indexedAt: saved.indexedAt,
        passages: saved.passages.length,
        files: new Set(saved.passages.map((p) => p.file)).size
      }
    })
}

export const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`
