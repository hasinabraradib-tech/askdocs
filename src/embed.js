// Embedding passages into a workspace, remembering the id each one got.
import { ragIngest } from '@qvac/sdk'

/**
 * Embed passages and return the ones that made it in, each with its store id.
 *
 * The ids are what let watch mode remove one file's passages later without
 * rebuilding the whole index. Results come back in the order the passages
 * were sent; a rejected one has no id and is left out.
 */
export async function embedPassages ({ modelId, workspace, passages, onProgress }) {
  if (passages.length === 0) return []

  const result = await ragIngest({
    modelId,
    workspace,
    documents: passages.map((p) => p.text),
    // Already split along paragraph lines; letting the SDK re-chunk would cut
    // passages at arbitrary points and break the map back to files.
    chunk: false,
    onProgress
  })

  return passages
    .map((passage, i) => ({ ...passage, id: result.processed[i]?.id }))
    .filter((passage) => passage.id)
}
