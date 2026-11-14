/** Sample-counted VAD, portable recordings and Unicode-safe speech segmentation. */
import { describe, expect, it, vi } from 'vitest'
import { base64, encodeUtterance, SpeechSentences, UtteranceDetector } from '../src/client/utterance.ts'

describe('utterance capture', () => {
  it('retains idle audio without triggering and emits once after measured trailing silence', () => {
    const start = vi.fn(), utterance = vi.fn<(samples: Float32Array) => void>()
    const vad = new UtteranceDetector({ threshold: 0.1, minSpeechMs: 0, silenceMs: 20, maxUtteranceMs: 100 }, start, utterance)
    const quiet = new Float32Array(160), voice = new Float32Array(160).fill(0.5)
    vad.push(quiet); vad.push(new Float32Array()); expect(start).not.toHaveBeenCalled()
    vad.push(voice); vad.push(quiet); expect(utterance).not.toHaveBeenCalled()
    vad.push(quiet)
    expect(start).toHaveBeenCalledTimes(1); expect(utterance).toHaveBeenCalledTimes(1)
    expect(utterance.mock.calls[0]![0]).toHaveLength(640)
    vad.push(quiet); expect(utterance).toHaveBeenCalledTimes(1)
  })

  it('bounds sustained speech to the configured maximum and starts the next utterance', () => {
    const utterance = vi.fn(), start = vi.fn()
    const vad = new UtteranceDetector({ threshold: 0.1, minSpeechMs: 0, silenceMs: 20, maxUtteranceMs: 15 }, start, utterance)
    vad.push(new Float32Array(500).fill(0.8))
    expect(utterance.mock.calls[0]![0]).toHaveLength(240)
    vad.push(new Float32Array(160).fill(0.8)); expect(start).toHaveBeenCalledTimes(2)
  })

  it('encodes clipped little-endian PCM16 with a canonical WAV header and base64', () => {
    const wav = encodeUtterance(Float32Array.of(-2, -0.5, 0, 0.5, 2)), view = new DataView(wav.buffer)
    expect(new TextDecoder().decode(wav.subarray(0, 4))).toBe('RIFF')
    expect(view.getUint32(24, true)).toBe(16000)
    expect(view.getUint32(40, true)).toBe(10)
    expect([44, 46, 48, 50, 52].map(offset => view.getInt16(offset, true))).toEqual([-32768, -16384, 0, 16384, 32767])
    expect(atob(base64(wav)).length).toBe(wav.length)
    expect(base64(new Uint8Array(10000))).toHaveLength(13336)
  })

  it('ignores short pulses for interruption while retaining them in the recording', () => {
    const start = vi.fn(), utterance = vi.fn<(samples: Float32Array) => void>()
    const vad = new UtteranceDetector({ threshold: 0.1, minSpeechMs: 200, silenceMs: 20, maxUtteranceMs: 1000 }, start, utterance)
    const frame = new Float32Array(160).fill(0.3), quiet = new Float32Array(160)
    for (let i = 0; i < 8; i++) vad.push(frame)
    vad.push(quiet); expect(start).not.toHaveBeenCalled()
    for (let i = 0; i < 19; i++) vad.push(frame)
    expect(start).not.toHaveBeenCalled()
    vad.push(frame); expect(start).toHaveBeenCalledOnce()
    vad.push(quiet); vad.push(quiet)
    expect(utterance.mock.calls[0]![0]).toHaveLength(4960)
    expect(utterance.mock.calls[0]![0][0]).toBeCloseTo(0.3)
  })

  it('adopts saved sensitivity without truncating an active utterance and supports immediate onset', () => {
    const start = vi.fn(), utterance = vi.fn<(samples: Float32Array) => void>()
    const vad = new UtteranceDetector({ threshold: 0.1, minSpeechMs: 200, silenceMs: 20, maxUtteranceMs: 1000 }, start, utterance)
    const frame = new Float32Array(160).fill(0.3), quiet = new Float32Array(160)
    vad.configure({ threshold: 0.4, minSpeechMs: 0 }); vad.push(frame)
    expect(start).not.toHaveBeenCalled()
    vad.configure({ threshold: 0.2, minSpeechMs: 0 }); vad.push(frame)
    expect(start).toHaveBeenCalledOnce()
    vad.configure({ threshold: 0.4, minSpeechMs: 200 }); vad.push(frame)
    expect(utterance).not.toHaveBeenCalled()
    vad.push(quiet)
    expect(utterance.mock.calls[0]![0]).toHaveLength(640)
  })

  it('keeps exactly the latest second before onset, including weak audio and brief gaps', () => {
    const start = vi.fn(), utterance = vi.fn<(samples: Float32Array) => void>()
    const vad = new UtteranceDetector({ threshold: 0.1, minSpeechMs: 200, silenceMs: 20, maxUtteranceMs: 15000 }, start, utterance)
    const expired = new Float32Array(8000).fill(0.01)
    const prefix = new Float32Array(16000).fill(0.02)
    prefix.set(new Float32Array(1536).fill(0.3), 12800)
    prefix.fill(0, 14336, 14464)
    vad.push(expired)
    for (let i = 0; i < prefix.length; i += 128) vad.push(prefix.subarray(i, i + 128))
    expect(start).not.toHaveBeenCalled()
    const voice = new Float32Array(128).fill(0.5)
    for (let i = 0; i < 24; i++) vad.push(voice)
    expect(start).not.toHaveBeenCalled()
    vad.push(voice)
    expect(start).toHaveBeenCalledOnce()
    vad.push(new Float32Array(320))
    const recording = utterance.mock.calls[0]![0]
    expect(recording).toHaveLength(16000 + 3200 + 320)
    expect(recording.subarray(0, 16000)).toEqual(prefix)
    expect(recording.subarray(16000, 19200)).toEqual(new Float32Array(3200).fill(0.5))
  })

  it('discards buffered audio and onset confirmation when capture is reset', () => {
    const start = vi.fn(), utterance = vi.fn<(samples: Float32Array) => void>()
    const vad = new UtteranceDetector({ threshold: 0.1, minSpeechMs: 200, silenceMs: 20, maxUtteranceMs: 15000 }, start, utterance)
    vad.push(new Float32Array(16000).fill(0.01))
    vad.push(new Float32Array(1600).fill(0.3))
    vad.reset()
    vad.push(new Float32Array(1600).fill(0.5))
    expect(start).not.toHaveBeenCalled()
    vad.push(new Float32Array(1600).fill(0.5))
    vad.push(new Float32Array(320))
    expect(utterance.mock.calls[0]![0]).toEqual(Float32Array.from([...new Float32Array(3200).fill(0.5), ...new Float32Array(320)]))
    vad.configure({ threshold: 0.1, minSpeechMs: 0 })
    vad.push(new Float32Array(160).fill(0.7))
    vad.push(new Float32Array(320))
    expect(utterance.mock.calls[1]![0]).toHaveLength(480)
    expect(utterance.mock.calls[1]![0][0]).toBeCloseTo(0.7)
  })

  it('shortens pre-roll for a small total recording limit without losing confirmed speech', () => {
    const start = vi.fn(), utterance = vi.fn<(samples: Float32Array) => void>()
    const vad = new UtteranceDetector({ threshold: 0.1, minSpeechMs: 200, silenceMs: 20, maxUtteranceMs: 300 }, start, utterance)
    vad.push(new Float32Array(32000).fill(0.01))
    vad.push(new Float32Array(3200).fill(0.5))
    expect(start).toHaveBeenCalledOnce()
    expect(utterance).not.toHaveBeenCalled()
    vad.push(new Float32Array(320))
    const recording = utterance.mock.calls[0]![0]
    expect(recording).toHaveLength(4800)
    expect(recording.subarray(1280, 4480)).toEqual(new Float32Array(3200).fill(0.5))
  })
})

describe('spoken sentences', () => {
  it('retains partial sentences and emits the final unpunctuated suffix once', () => {
    const sentences = new SpeechSentences(20)
    expect(sentences.push('你好')).toEqual([])
    expect(sentences.push('！继续')).toEqual(['你好！'])
    expect(sentences.finish()).toEqual(['继续']); expect(sentences.finish()).toEqual([])
  })

  it('preserves Unicode code points while bounding each synthesis request', () => {
    const sentences = new SpeechSentences(3)
    expect(sentences.push('𠮷野家你好。')).toEqual(['𠮷野家', '你好。'])
    expect(sentences.push('Hi. Next?')).toEqual(['Hi.', 'Nex', 't?'])
  })

  it('skips punctuation, formatting and emoji fragments, including an unfinished suffix', () => {
    const sentences = new SpeechSentences(100)
    expect(sentences.push('你好！！\n\n**河北怎么样？**\n我觉得不错。')).toEqual(['你好！', '**河北怎么样？', '我觉得不错。'])
    expect(sentences.push('**😀')).toEqual([])
    expect(sentences.finish()).toEqual([])
    expect(sentences.finish()).toEqual([])
  })

  it('keeps numbers and multilingual words while discarding bounded symbol-only chunks', () => {
    const sentences = new SpeechSentences(3)
    expect(sentences.push('😀😀😀😀。')).toEqual([])
    expect(sentences.push('1. 中文！')).toEqual(['1.', '中文！'])
    expect(sentences.push('عربي')).toEqual(['عرب'])
    expect(sentences.finish()).toEqual(['ي'])
  })
})
