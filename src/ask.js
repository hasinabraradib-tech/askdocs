// Ask a question about the indexed folder. `npm run ask -- "question"`
import { ragSearch, ragCloseWorkspace, completion, unloadModel, close } from '@qvac/sdk'
import { EMBED_MODEL, LLM_MODEL, WORKSPACE, load } from './models.js'
import { loadSources } from './store.js'

// How many passages to search for, and how far below the best match one can
// score and still be shown to the model. A 1B model handed three passages
// tries to use all three, so an unrelated one ends up quoted in the answer.
// On the samples, the passages that answer a question score within a few
// hundredths of each other, and the unrelated ones fall 0.08 or more behind.
const TOP_K = 3
const MAX_GAP = 0.05

const DIM = '\x1b[2m'
const BOLD = '\x1b[1m'
const RESET = '\x1b[0m'
const style = (code, text) => (process.stdout.isTTY ? `${code}${text}${RESET}` : text)

// The model is not asked to cite anything. Numbered sources and "[1]" markers
// made a 1B model answer in numbered lists, one item per source, whether or
// not a source was relevant. Citations come from code instead: every passage
// the model was shown is listed under the answer, with its file and line.
const NOT_FOUND = 'I could not find that in your documents.'
const INSTRUCTIONS = `Answer the question in one or two sentences, using only the notes you are given.
If the notes do not answer the question, reply only: ${NOT_FOUND}`

const question = process.argv.slice(2).join(' ').trim()
const ids = []

try {
  if (!question) throw new Error('Usage: npm run ask -- "your question"')

  const sources = loadSources()
  if (!sources) throw new Error('Nothing is indexed yet. Run: npm run index -- <folder>')

  const embedId = await load(EMBED_MODEL, 'embedding model')
  ids.push(embedId)

  process.stderr.write('  searching your documents...\n')
  const hits = await ragSearch({ modelId: embedId, workspace: WORKSPACE, query: question, topK: TOP_K })
  if (hits.length === 0) throw new Error('The index is empty. Run: npm run index -- <folder>')

  // Trace every hit back to the file and line it was read from.
  const best = hits[0].score
  const found = hits
    .filter((hit) => best - hit.score <= MAX_GAP)
    .map((hit) => ({ ...hit, source: sources.byText.get(hit.content) }))

  const llmId = await load(LLM_MODEL, 'language model', { ctx_size: 4096, temp: 0 })
  ids.push(llmId)

  // Heading marks are dropped: the model otherwise copies "## Compensation"
  // into its answer as though it were part of the reply.
  const context = found
    .map((hit) => hit.content.replace(/^#+\s*/gm, ''))
    .join('\n\n---\n\n')

  console.log(`\n${style(BOLD, 'Q:')} ${question}\n`)
  process.stdout.write(`${style(BOLD, 'A:')} `)

  const run = completion({
    modelId: llmId,
    history: [
      { role: 'system', content: INSTRUCTIONS },
      { role: 'user', content: `Notes:\n\n${context}\n\nQuestion: ${question}` }
    ],
    stream: true
  })
  let answer = ''
  for await (const event of run.events) {
    if (event.type === 'contentDelta') {
      answer += event.text
      process.stdout.write(event.text)
    }
  }
  console.log()

  // Listing the passages under "not found" would suggest they back an answer.
  if (!answer.includes(NOT_FOUND)) {
    console.log(`\n${style(BOLD, 'Sources')}`)
    found.forEach((hit) => {
      const where = hit.source ? `${hit.source.file}:${hit.source.line}` : '(unknown file)'
      console.log(`  ${where} ${style(DIM, `score ${hit.score.toFixed(2)}`)}`)
    })
  }
} catch (error) {
  console.error(`\n  ${error?.message ?? error}`)
  process.exitCode = 1
} finally {
  await ragCloseWorkspace({ workspace: WORKSPACE }).catch(() => {})
  for (const modelId of ids) await unloadModel({ modelId }).catch(() => {})
  await close().catch(() => {})
}
