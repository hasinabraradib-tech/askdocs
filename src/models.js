// The two models askdocs needs, and one place to load them from.
//
// Both run on this machine. The first load fetches the weights from the QVAC
// registry into ~/.qvac; every load after that reads them from disk.
import { loadModel, GTE_LARGE_FP16, LLAMA_3_2_1B_INST_Q4_0 } from '@qvac/sdk'

// Turns a passage (or a question) into a vector, so that "when do we get
// paid back" can find a paragraph that only ever says "reimbursed".
export const EMBED_MODEL = GTE_LARGE_FP16

// Reads the retrieved passages and writes the answer.
export const LLM_MODEL = LLAMA_3_2_1B_INST_Q4_0

// Every index and question goes through this one named store, so indexing a
// new folder replaces the old one instead of mixing the two.
export const WORKSPACE = 'askdocs'

/**
 * Load a model and show how far along the download is.
 *
 * Written to stderr, so `npm run ask -- "..." > answer.txt` captures only
 * the answer.
 *
 * @param {object} modelSrc       A QVAC model constant.
 * @param {string} label          What to call it on screen.
 * @param {object} [modelConfig]  Engine settings, e.g. { ctx_size, temp }.
 * @returns {Promise<string>}     The loaded model's id.
 */
export async function load (modelSrc, label, modelConfig) {
  const tty = process.stderr.isTTY
  let shown = -1

  const modelId = await loadModel({
    modelSrc,
    ...(modelConfig ? { modelConfig } : {}),
    onProgress: ({ percentage }) => {
      const percent = Math.floor(percentage)
      if (percent === shown) return
      shown = percent
      process.stderr.write(`${tty ? '\r' : ''}  loading ${label} ${percent}%${tty ? '' : '\n'}`)
    }
  })

  // A cached model may report nothing at all, so the line is finished here
  // rather than inside the callback.
  if (tty && shown >= 0) process.stderr.write('\n')
  return modelId
}
