/** Editable personal-agent guidance and transient voice-call acknowledgement. */
import type { SettingsNamespace } from '@deepseek-ai/dsh-settings/types'
import type { SessionId } from '@deepseek-ai/dsh-session/types'

/** Saved guidance shared by personal-mode Sessions. */
export interface PersonalAgentPreferences {
  /** Persona text used for ordinary conversation and task execution. */
  basePrompt: string
  /** Additional response guidance while the Session has a connected voice call. */
  callPrompt: string
}

/** Saved preferences and their writable Host configuration entry, when available. */
export interface PersonalAgentCatalog extends PersonalAgentPreferences {
  /** Omitted when the service was mounted without a Loader entry. */
  settingsNamespace?: SettingsNamespace
}

/** First stream frame confirms that the Session's voice context is installed. */
export interface PersonalAgentCallState { active: true }

declare module '@deepseek-ai/dsh-typert-protocol' {
  interface RemoteErrorDetailsMap {
    /** A call cannot annotate a Session that is not live on this Host. */
    'personal-agent/session-unavailable': { sessionId: SessionId }
  }
}
