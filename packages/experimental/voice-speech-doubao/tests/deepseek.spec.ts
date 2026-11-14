/** DeepSeek multipart upload, PCM framing, completion, and cancellation on local servers. */
import { createServer } from 'node:http'
import { once } from 'node:events'
import { WebSocketServer } from 'ws'
import { afterEach, expect, it } from 'vitest'
import { deepseekRecognize, deepseekSynthesize } from '../src/deepseek.ts'
import VoiceSpeech from '../src/index.ts'
const cleanups: Array<() => Promise<void>> = []
afterEach(async () => { for (const cleanup of cleanups.splice(0).reverse()) await cleanup() })
async function server() {
  const http = createServer(async (req, res) => {
    expect(req.headers.authorization).toBe('Bearer test-key')
    expect(req.headers['content-type']).toContain('multipart/form-data; boundary=')
    const parts: Buffer[] = []
    for await (const data of req) parts.push(data)
    expect(Buffer.concat(parts).toString()).toContain('name="file"; filename="speech.wav"')
    res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ text: '你好' }))
  })
  const ws = new WebSocketServer({ server: http })
  http.listen(0, '127.0.0.1'); await once(http, 'listening')
  const address = http.address()
  if (!address || typeof address === 'string') throw new Error('Missing test port')
  cleanups.push(async () => {
    for (const client of ws.clients) client.terminate()
    await new Promise<void>(resolve => ws.close(() => resolve()))
    http.closeAllConnections(); await new Promise<void>(resolve => http.close(() => resolve()))
  })
  return { ws, url: `127.0.0.1:${address.port}` }
}
const headers = { Authorization: 'Bearer test-key' }
it('defaults to DeepSeek and the existing Harness credential reference', () => {
  const config = VoiceSpeech.Config({})
  expect(config.asrProvider.get()).toBe('deepseek')
  expect(config.ttsProvider.get()).toBe('deepseek')
  expect(config.deepseekApiKeyEnv).toBe('DEEPSEEK_API_KEY')
})
it('uploads WAV as multipart and bounds the transcript', async () => {
  const { url } = await server()
  expect(await deepseekRecognize(Buffer.from('RIFF'), `http://${url}`, headers, 1024, 20, new AbortController().signal)).toBe('你好')
  await expect(deepseekRecognize(Buffer.from('RIFF'), `http://${url}`, headers, 1024, 1, new AbortController().signal)).rejects.toThrow()
})
it.each([true, false])('requires explicit completion (%s) and aligns PCM chunks', async success => {
  const { ws, url } = await server()
  ws.on('connection', (socket, req) => {
    expect(req.headers.authorization).toBe('Bearer test-key')
    expect(req.url).toContain('voice_id=tide')
    socket.on('message', data => {
      if (JSON.parse(data.toString()).event !== 'finish_text') return
      socket.send(Buffer.from([1, 2, 3])); socket.send(Buffer.from([4]))
      if (success) socket.send(JSON.stringify({ event: 'finish', code: 'success' }))
      else socket.close()
    })
  })
  const chunks: Buffer[] = []
  const task = deepseekSynthesize('你好', 'tide', `ws://${url}`, headers, 1024, new AbortController().signal, chunk => chunks.push(chunk))
  if (success) await task
  else await expect(task).rejects.toThrow()
  expect(Buffer.concat(chunks)).toEqual(Buffer.from([1, 2, 3, 4]))
  expect(chunks.every(chunk => chunk.length % 2 === 0)).toBe(true)
})
it('cancels a synthesis waiting for audio', async () => {
  const { ws, url } = await server(), abort = new AbortController()
  ws.on('connection', () => abort.abort(new Error('cancelled')))
  await expect(deepseekSynthesize('你好', 'stella', `ws://${url}`, headers, 1024, abort.signal, () => {})).rejects.toThrow('cancelled')
})
