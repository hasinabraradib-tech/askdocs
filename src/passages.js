// Reading a folder of notes and cutting it into passages worth searching.
import { readdirSync, readFileSync } from 'node:fs'
import { extname, join, relative } from 'node:path'

export const TEXT_EXTENSIONS = ['.md', '.markdown', '.txt']

// Roughly a long paragraph. Much shorter and a passage stops carrying enough
// context to answer anything; much longer and one strong sentence gets
// diluted by everything around it when the passage is embedded.
const TARGET_CHARS = 700

/** Every text file under `root`, skipping hidden folders and node_modules. */
export function findTextFiles (root) {
  const found = []
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue
    const path = join(root, entry.name)
    if (entry.isDirectory()) found.push(...findTextFiles(path))
    else if (TEXT_EXTENSIONS.includes(extname(entry.name).toLowerCase())) found.push(path)
  }
  return found.sort()
}

/**
 * Split one file into passages, remembering the line each one starts on.
 *
 * Paragraphs (blocks separated by blank lines) are the unit, because that is
 * how people group related sentences. Short neighbouring paragraphs within
 * one section are joined until they reach TARGET_CHARS, so a heading is never
 * indexed alone, cut off from the text it introduces.
 *
 * @returns {Array<{text: string, line: number}>}
 */
export function splitIntoPassages (content) {
  const paragraphs = []
  let current = null

  content.split('\n').forEach((raw, index) => {
    const line = raw.trimEnd()
    if (line.trim() === '') {
      current = null
    } else if (current) {
      current.text += `\n${line}`
    } else {
      current = { text: line, line: index + 1 }
      paragraphs.push(current)
    }
  })

  const passages = []
  for (const paragraph of paragraphs) {
    const last = passages[passages.length - 1]
    // A heading always opens a new passage: the text under "Sick leave" should
    // not be searched as part of the holiday section above it.
    const isHeading = paragraph.text.startsWith('#')
    if (last && !isHeading && last.text.length + paragraph.text.length < TARGET_CHARS) {
      last.text += `\n\n${paragraph.text}`
    } else {
      passages.push({ ...paragraph })
    }
  }
  return passages
}

/**
 * All passages in a folder, each tagged with the file it came from.
 *
 * @returns {Array<{file: string, line: number, text: string}>}
 */
export function readFolder (root) {
  return findTextFiles(root).flatMap((path) =>
    splitIntoPassages(readFileSync(path, 'utf8'))
      .map((passage) => ({ file: relative(root, path), ...passage }))
  )
}
