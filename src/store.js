// Where each indexed passage came from.
//
// The SDK's vector store keeps only the text of a passage, not which file or
// line it was taken from. So indexing also writes this small map, and a
// search result is traced back to its source by looking its text up here.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const MAP_PATH = join('.askdocs', 'sources.json')

export function saveSources ({ folder, passages }) {
  mkdirSync(dirname(MAP_PATH), { recursive: true })
  writeFileSync(MAP_PATH, JSON.stringify({ folder, indexedAt: new Date().toISOString(), passages }, null, 2))
}

/** @returns {{folder: string, passages: Array, byText: Map} | null} */
export function loadSources () {
  if (!existsSync(MAP_PATH)) return null
  const saved = JSON.parse(readFileSync(MAP_PATH, 'utf8'))
  return { ...saved, byText: new Map(saved.passages.map((p) => [p.text, p])) }
}
