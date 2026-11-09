/** Voice response ownership, live/durable deduplication and content filtering. */
import { expect, it, vi } from 'vitest'
import type { SessionEventLikeEntry } from '@deepseek-ai/dsh-api-session-controller/client'
import type { SessionRequestId } from '@deepseek-ai/dsh-api-session-controller/types'
import { VoiceOutput } from '../src/client/output.ts'

const receipt = 'voice-receipt' as SessionRequestId
function row(type: string, data: object): SessionEventLikeEntry {
  return { type: type === 'assistant/live-chunk' ? 'transient' : 'event', event: { type, data, time: 0, seq: 1 } } as SessionEventLikeEntry
}
function start(output: VoiceOutput): void {
  output.expect(receipt)
  output.accept([row('turn/start', { turn: 1 }), row('user/message', { source: { kind: 'user', rpcId: receipt } })])
}
function delta(text: string, chunkType = 'text-delta', turn = 1, step = 1): SessionEventLikeEntry {
  return row('assistant/live-chunk', { turn, step, chunk: { type: chunkType, text, index: 0 } })
}
function settlement(text: string, step = 1, interrupted = false): SessionEventLikeEntry {
  return row('assistant/message', { turn: 1, step, interrupted, message: { content: [
    { type: 'reasoning', text: 'private reasoning' }, { type: 'text', text }, { type: 'tool-call', name: 'bash', arguments: 'secret' },
  ] } })
}

it('speaks only owned live text and emits a durable suffix without repeating deltas', () => {
  const speak = vi.fn(), output = new VoiceOutput(100, speak, vi.fn())
  output.accept([delta('History!'), settlement('History!')]); expect(speak).not.toHaveBeenCalled()
  start(output)
  output.accept([delta('思考', 'reasoning-delta'), delta('工具', 'tool-call-delta'), delta('其他会话！', 'text-delta', 2), delta('你好！后半')])
  expect(speak.mock.calls).toEqual([['你好！']])
  output.accept([settlement('你好！后半句')]); output.accept([settlement('你好！后半句')])
  expect(speak.mock.calls).toEqual([['你好！'], ['后半句']])
})

it('drops interrupted output, old receipt ownership and retries uncommitted text', () => {
  const speak = vi.fn(), stop = vi.fn(), output = new VoiceOutput(100, speak, stop)
  start(output); output.accept([delta('未说完'), row('assistant/attempt', { turn: 1, step: 1 })])
  output.accept([delta('重试成功'), settlement('重试成功')]); expect(speak).toHaveBeenCalledWith('重试成功')
  output.accept([delta('被打断', 'text-delta', 1, 2), settlement('被打断', 2, true)])
  output.accept([delta('迟到的内容！', 'text-delta', 1, 3)])
  expect(speak).toHaveBeenCalledTimes(1); expect(stop).toHaveBeenCalledTimes(2)
})

it('stops reading after another user takes over the Session or after a replacement baseline', () => {
  const speak = vi.fn(), output = new VoiceOutput(100, speak, vi.fn())
  start(output); output.accept([row('user/message', { source: { kind: 'user', rpcId: 'other-client' } }), delta('别人的回复！')])
  expect(speak).not.toHaveBeenCalled()
  start(output); output.reset(); output.accept([delta('回放！')]); expect(speak).not.toHaveBeenCalled()
})

it('keeps tool steps out and handles failure finish without reading a partial suffix', () => {
  const speak = vi.fn(), stop = vi.fn(), output = new VoiceOutput(100, speak, stop)
  start(output); output.accept([delta('执行前'), row('tool/result', { text: '工具结果' }),
    row('assistant/live-chunk', { turn: 1, step: 1, chunk: { type: 'finish', reason: { kind: 'aborted' } } })])
  expect(speak).not.toHaveBeenCalled(); expect(stop).toHaveBeenCalledOnce()
})
