/** Personal Agent settings own their Remote mount, editor lifetime and settings navigation. */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import contribution from '@deepseek-ai/dsh-personal-agent/remote'
import type { PersonalAgentPreferences } from '@deepseek-ai/dsh-personal-agent/types'
import { PersonalSettingsController } from './personal-settings-controller.ts'
import { PersonalAgentSettings, type PersonalAgentSettingsInjected } from './PersonalAgentSettings.tsx'
import { PERSONAL_NS, personalEn, personalZh, personalJa, personalEs, personalFr, personalDe, personalRu, personalPt } from './personal-locales.ts'

function registerSettings(ctx: Context): void {
  const settings = new PersonalSettingsController({
    catalog: signal => ctx.remote.personalAgent.catalog(signal),
    ensure: () => ctx.configForms.describe().ensure(),
    form: namespace => ctx.configForms.get<PersonalAgentPreferences>(namespace),
  })
  const actions: PersonalAgentSettingsInjected = {
    hooks: { personalSettings: settings.state }, open: () => { settings.open() }, close: () => { settings.close() },
    edit: (field, value) => { settings.edit(field, value) }, cancel: () => { settings.cancel() }, apply: () => settings.apply(),
  }
  ctx.effect(() => ctx.locale.register(PERSONAL_NS, {
    en: personalEn, zh: personalZh, ja: personalJa, es: personalEs, fr: personalFr, de: personalDe, ru: personalRu, pt: personalPt,
  }))
  ctx.effect(() => () => settings.dispose())
  const t = ctx.locale.bind(PERSONAL_NS)
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section', id: 'personal-agent', order: 15, label: () => t('title'), locale: PERSONAL_NS, inject: () => actions,
  }, PersonalAgentSettings))
}

/**
 * Mount generated personal Agent methods and their independent settings section.
 * @param ctx - Client plugin owner; voice calls must be disposed before this mount.
 * @returns disposer that joins editor writes before withdrawing its Remote methods.
 */
export async function mountPersonalAgentSettings(ctx: Context): Promise<() => Promise<void>> {
  const remote = await ctx.remote.$mount(contribution)
  const ui = ctx.inject(['remote', 'remote.personalAgent', 'slots', 'locale', 'configForms'], registerSettings)
  try { await ui } catch (error) { await ui.dispose(); await remote(); throw error }
  return async () => { await ui.dispose(); await remote() }
}
