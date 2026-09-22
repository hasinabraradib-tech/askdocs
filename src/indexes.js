// List what has been indexed. `npm run indexes`
//
// Read from the source maps alone, so it answers instantly without loading
// a model or opening a vector store.
import { listIndexes, plural } from './store.js'

const indexes = listIndexes()

if (indexes.length === 0) {
  console.log('Nothing is indexed yet. Run: npm run index -- <folder> [--index name]')
} else {
  const width = Math.max(...indexes.map((i) => i.name.length))
  for (const { name, folder, files, passages, indexedAt } of indexes) {
    const when = new Date(indexedAt).toLocaleString()
    console.log(`${name.padEnd(width)}  ${plural(files, 'file')}, ${plural(passages, 'passage')} from ${folder}  (${when})`)
  }
}
