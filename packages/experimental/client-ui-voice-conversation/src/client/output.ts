/** Live-only Assistant text admission; history replacement never triggers playback. */
import type { SessionEventLikeEntry } from '@deepseek-ai/dsh-api-session-controller/client'
import type { SessionRequestId } from '@deepseek-ai/dsh-api-session-controller/types'
import { SpeechSentences } from './utterance.ts'

/** Admit text from this call's submissions and delivered Host reminders. */
export class VoiceOutput {
  private readonly requests = new Set<SessionRequestId>()
  private turn = 0
  private ownedTurn: number | undefined
  private step = 0
  private text = ''
  private sentences: SpeechSentences
  private readonly settled = new Set<string>()

  constructor(private readonly limit: number, private readonly speak: (sentence: string) => void,
    private readonly stop: () => void) { this.sentences = new SpeechSentences(limit) }

  /**
   * Admit a future response only after the identified prompt reaches the Session log.
   * @param id - ordinary prompt receipt id created by this call.
   */
  expect(id: SessionRequestId): void { this.requests.add(id) }

  /** Invalidate response ownership after interruption or history replacement. */
  reset(): void {
    this.requests.clear(); this.ownedTurn = undefined; this.step = 0; this.text = ''
    this.sentences = new SpeechSentences(this.limit)
    this.stop()
  }

  /**
   * Consume live response events without reading reasoning or tool results.
   * @param entries - newly appended or settled events, never a history baseline.
   */
  accept(entries: readonly SessionEventLikeEntry[]): void {
    for (const { event } of entries) {
      if (event.type === 'turn/start') { this.turn = event.data.turn; continue }
      if (event.type === 'user/message') {
        const source = event.data.source
        // The optional Schedule package extends MessageSourceMap outside this Client package.
        if (String(source.kind) === 'schedule') {
          const text = event.data.content.filter(block => block.type === 'text').map(block => block.text).join('')
          this.ownedTurn = text.startsWith('[SCHEDULE REMINDER]') || text.startsWith('[SCHEDULE REMINDER BATCH]')
            ? this.turn
            : undefined
        } else if (source.kind === 'user') {
          if ('rpcId' in source && typeof source.rpcId === 'string' && this.requests.has(source.rpcId)) {
            this.requests.delete(source.rpcId); this.ownedTurn = this.turn
          } else { this.ownedTurn = undefined }
        } else {
          this.ownedTurn = undefined
        }
        continue
      }
      if (event.type === 'assistant/live-chunk' && event.data.turn === this.ownedTurn) {
        this.selectStep(event.data.step)
        const chunk = event.data.chunk
        if (chunk.type === 'text-delta') this.append(chunk.text)
        if (chunk.type === 'finish' && (chunk.reason.kind === 'aborted' || chunk.reason.kind === 'error')) this.reset()
        continue
      }
      if (event.type === 'assistant/attempt' && event.data.turn === this.ownedTurn) {
        this.selectStep(event.data.step); this.text = ''; this.sentences = new SpeechSentences(this.limit); this.stop()
        continue
      }
      if (event.type !== 'assistant/message' || event.data.turn !== this.ownedTurn) continue
      const key = `${event.data.turn}:${event.data.step}`
      if (this.settled.has(key)) continue
      this.settled.add(key)
      this.selectStep(event.data.step)
      if (event.data.interrupted) { this.reset(); continue }
      const text = event.data.message.content.filter(block => block.type === 'text').map(block => block.text).join('')
      if (text.startsWith(this.text)) this.append(text.slice(this.text.length))
      for (const sentence of this.sentences.finish()) this.speak(sentence)
    }
  }

  private selectStep(step: number): void {
    if (this.step === step) return
    this.step = step; this.text = ''; this.sentences = new SpeechSentences(this.limit)
  }

  private append(text: string): void {
    this.text += text
    for (const sentence of this.sentences.push(text)) this.speak(sentence)
  }
}
