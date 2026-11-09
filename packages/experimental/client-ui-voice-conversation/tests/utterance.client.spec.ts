/** Sample-counted VAD, portable recordings and Unicode-safe speech segmentation. */
import { describe, expect, it, vi } from 'vitest'
import { base64, encodeUtterance, SpeechSentences, UtteranceDetector } from '../src/client/utterance.ts'

describe('utterance capture', () => {
  it('ignores idle silence and emits once after measured trailing silence', () => {
    const start = vi.fn(), utterance = vi.fn<(samples: Float32Array) => void>()
    const vad = new UtteranceDetector({ threshold: 0.1, minSpeechMs: 0, silenceMs: 20, maxUtteranceMs: 100 }, start, utterance)
    const quiet = new Float32Array(160), voice = new Float32Array(160).fill(0.5)
    vad.push(quiet); vad.push(new Float32Array()); expect(start).not.toHaveBeenCalled()
    vad.push(voice); vad.push(quiet); expect(utterance).not.toHaveBeenCalled()
    vad.push(quiet)
    expect(start).toHaveBeenCalledTimes(1); expect(utterance).toHaveBeenCalledTimes(1)
    expect(utterance.mock.calls[0]![0]).toHaveLength(480)
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

  it('ignores short pulses and preserves the full beginning after 200 ms of continuous speech', () => {
    const start = vi.fn(), utterance = vi.fn<(samples: Float32Array) => void>()
    const vad = new UtteranceDetector({ threshold: 0.1, minSpeechMs: 200, silenceMs: 20, maxUtteranceMs: 1000 }, start, utterance)
    const frame = new Float32Array(160).fill(0.3), quiet = new Float32Array(160)
    for (let i = 0; i < 8; i++) vad.push(frame)
    vad.push(quiet); expect(start).not.toHaveBeenCalled()
    for (let i = 0; i < 19; i++) vad.push(frame)
    expect(start).not.toHaveBeenCalled()
    vad.push(frame); expect(start).toHaveBeenCalledOnce()
    vad.push(quiet); vad.push(quiet)
    expect(utterance.mock.calls[0]![0]).toHaveLength(3520)
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
    expect(utterance.mock.calls[0]![0]).toHaveLength(480)
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
    expect(sentences.push('😀😀😀😀。')).toEqual(['😀😀😀', '😀。'])
    expect(sentences.push('Hi. Next?')).toEqual(['Hi.', 'Nex', 't?'])
  })
})
