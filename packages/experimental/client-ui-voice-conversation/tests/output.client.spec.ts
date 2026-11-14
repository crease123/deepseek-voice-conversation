/** Voice response ownership, live/durable deduplication and content filtering. */
import { expect, it, vi } from 'vitest'
import type { SessionEventLikeEntry } from '@deepseek-ai/dsh-api-session-controller/client'
import type { SessionRequestId } from '@deepseek-ai/dsh-api-session-controller/types'
import { VoiceOutput } from '../src/client/output.ts'

const receipt = 'voice-receipt' as SessionRequestId
type InputSource = { kind: 'user'; rpcId: SessionRequestId } | { kind: 'schedule' }
function row(type: string, data: object): SessionEventLikeEntry {
  return { type: type === 'assistant/live-chunk' ? 'transient' : 'event', event: { type, data, time: 0, seq: 1 } } as SessionEventLikeEntry
}
function start(output: VoiceOutput, source: InputSource = { kind: 'user', rpcId: receipt }, content: object[] = []): void {
  if (source.kind === 'user') output.expect(receipt)
  output.accept([row('turn/start', { turn: 1 }), row('user/message', { source, content })])
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

it.each(['[SCHEDULE REMINDER]', '[SCHEDULE REMINDER BATCH]'])('speaks assistant output for a delivered scheduled reminder (%s)', (prefix) => {
  const speak = vi.fn(), output = new VoiceOutput(100, speak, vi.fn())
  start(output, { kind: 'schedule' }, [{ type: 'text', text: `${prefix}\nThis is a scheduled message from the user` }])
  output.accept([delta('定时任务已完成。'), settlement('定时任务已完成。')])
  expect(speak).toHaveBeenCalledWith('定时任务已完成。')
})

it('does not speak task-change notifications that share the schedule source', () => {
  const speak = vi.fn(), output = new VoiceOutput(100, speak, vi.fn())
  start(output, { kind: 'schedule' }, [{ type: 'text', text: '[SCHEDULE CHANGE]\nThis notice is not a delivery of the task.' }])
  output.accept([delta('任务配置已更新。'), settlement('任务配置已更新。')])
  expect(speak).not.toHaveBeenCalled()
})

it('keeps tool steps out and handles failure finish without reading a partial suffix', () => {
  const speak = vi.fn(), stop = vi.fn(), output = new VoiceOutput(100, speak, stop)
  start(output); output.accept([delta('执行前'), row('tool/result', { text: '工具结果' }),
    row('assistant/live-chunk', { turn: 1, step: 1, chunk: { type: 'finish', reason: { kind: 'aborted' } } })])
  expect(speak).not.toHaveBeenCalled(); expect(stop).toHaveBeenCalledOnce()
})

it('does not synthesize symbol-only fragments from streamed Markdown and repeated punctuation', () => {
  const speak = vi.fn(), output = new VoiceOutput(100, speak, vi.fn())
  start(output)
  output.accept([delta('你好！'), delta('！\n\n**河北怎么样？'), delta('**\n我觉得不错。**')])
  output.accept([settlement('你好！！\n\n**河北怎么样？**\n我觉得不错。**')])
  expect(speak.mock.calls).toMatchInlineSnapshot(`
    [
      [
        "你好！",
      ],
      [
        "**河北怎么样？",
      ],
      [
        "我觉得不错。",
      ],
    ]
  `)
})

it.each([false, true])('preserves first reply ownership across runtime context (streamed=%s)', (streamed) => {
  const speak = vi.fn(), output = new VoiceOutput(100, speak, vi.fn())
  start(output)
  output.accept([row('user/message', { source: { kind: 'runtime-context' },
    content: [{ type: 'text', text: '当前交流方式：实时语音通话。' }] })])
  if (streamed) output.accept([delta('第一句。')])
  output.accept([settlement('第一句。')])
  expect(speak.mock.calls).toEqual([['第一句。']])
  output.accept([row('user/message', { source: { kind: 'runtime-context' }, content: [] }),
    delta('第二步。', 'text-delta', 1, 2), settlement('第二步。', 2)])
  expect(speak.mock.calls).toEqual([['第一句。'], ['第二步。']])
})

it('does not acquire response ownership from runtime context alone', () => {
  const speak = vi.fn(), output = new VoiceOutput(100, speak, vi.fn())
  output.accept([row('turn/start', { turn: 1 }),
    row('user/message', { source: { kind: 'runtime-context' }, content: [] }),
    delta('不应朗读。'), settlement('不应朗读。')])
  expect(speak).not.toHaveBeenCalled()
})
