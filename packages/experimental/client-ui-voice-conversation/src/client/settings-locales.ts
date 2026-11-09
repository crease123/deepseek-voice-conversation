/** Locale-owned voice settings, preview controls and recovery advice. */
import type {} from '@deepseek-ai/dsh-client-ui-slots'

/** Settings dictionary namespace. */
export const SETTINGS_NS = 'voice-conversation.settings'
/** English settings copy and key source. */
export const settingsEn = {
  rms: 'RMS', milliseconds: 'ms',
  title: 'Voice conversation', open: 'Voice settings', description: 'Choose how the agent sounds and when speech interrupts it.',
  speaker: 'Voice', xiaohe: 'Xiaohe 2.0', xiaoheDescription: 'Clear, warm female voice', vivi: 'Vivi 2.0', viviDescription: 'Bright, expressive female voice',
  yunzhou: 'Yunzhou 2.0', yunzhouDescription: 'Steady, relaxed male voice', xiaotian: 'Xiaotian 2.0', xiaotianDescription: 'Clear, youthful male voice', customDescription: 'Custom voice configured by your speech service',
  speechRate: 'Speech rate', volume: 'Playback volume', volumeHint: 'Saved in this client only. This does not change system volume.',
  example: 'Preview text', exampleDefault: 'Hello! I am ready to help. Let us explore your next idea together.', preview: 'Preview voice', stop: 'Stop preview', previewing: 'Playing preview…',
  previewHint: 'Preview uses these draft settings. During a call, microphone input and automatic replies pause until preview ends.',
  more: 'More options', pitch: 'Pitch', style: 'Delivery', natural: 'Natural', gentle: 'Gentle', lively: 'Lively',
  detection: 'Speech detection', threshold: 'Interruption sensitivity', thresholdHint: 'Lower sensitivity needs louder speech. The RMS threshold also controls when recording starts.',
  lower: 'Lower', higher: 'Higher', minSpeech: 'Continuous speech before triggering', minSpeechHint: 'Shorter sounds are ignored. This delay applies to both interruption and automatic recording.',
  defaults: 'Restore defaults', cancel: 'Cancel', apply: 'Apply', applying: 'Applying…', close: 'Close voice settings',
  loading: 'Loading voice settings…', loadError: 'Voice settings could not be loaded. Close and reopen to retry.',
  previewError: 'The preview failed. Check the speech service and audio output, then retry.',
  saveError: 'Settings were not saved. Reopen the panel to load current values and try again.',
  readonly: 'Voice preferences are read-only in this profile.', changed: 'Changes apply to the next spoken sentence.',
} as const
/** Chinese settings copy checked against the English keys. */
export const settingsZh = {
  rms: 'RMS', milliseconds: '毫秒',
  title: '语音通话', open: '语音设置', description: '选择 Agent 的声音，以及说话触发打断的条件',
  speaker: '音色', xiaohe: '小何 2.0', xiaoheDescription: '清晰温暖的女声', vivi: 'Vivi 2.0', viviDescription: '明亮富有表现力的女声',
  yunzhou: '云舟 2.0', yunzhouDescription: '沉稳放松的男声', xiaotian: '小天 2.0', xiaotianDescription: '清晰年轻的男声', customDescription: '语音服务配置的自定义音色',
  speechRate: '语速', volume: '播放音量', volumeHint: '仅保存在当前客户端，不改变系统音量',
  example: '试听文本', exampleDefault: '你好！我准备好了，让我们一起探索你的下一个想法。', preview: '试听声音', stop: '停止试听', previewing: '正在试听…',
  previewHint: '试听使用当前草稿；通话中试听时暂停收音和自动播报，结束后恢复',
  more: '更多选项', pitch: '音高', style: '语气', natural: '自然', gentle: '温柔', lively: '活泼',
  detection: '说话检测', threshold: '打断灵敏度', thresholdHint: '灵敏度越低，需要更大声音才会触发；RMS 阈值也影响自动开始录音',
  lower: '低', higher: '高', minSpeech: '持续说话多久才触发', minSpeechHint: '未达到时长的短音会被忽略；此延迟同时作用于打断和自动起录',
  defaults: '恢复默认', cancel: '取消', apply: '应用', applying: '正在应用…', close: '关闭语音设置',
  loading: '正在加载语音设置…', loadError: '无法加载语音设置，请关闭后重新打开重试',
  previewError: '试听失败，请检查语音服务和音频输出后重试',
  saveError: '设置未保存，请重新打开面板加载当前值后重试', readonly: '当前配置中的语音参数为只读', changed: '更改从下一段播报开始生效',
} satisfies Record<keyof typeof settingsEn, string>

/** Japanese voice preferences and preview controls. */
export const settingsJa = {
  rms: 'RMS', milliseconds: 'ミリ秒',
  title: '音声通話', open: '音声設定', description: 'エージェントの声と、発話で応答を中断する条件を設定します。',
  speaker: '声', xiaohe: 'Xiaohe 2.0', xiaoheDescription: '明瞭で温かい女性の声', vivi: 'Vivi 2.0', viviDescription: '明るく表情豊かな女性の声',
  yunzhou: 'Yunzhou 2.0', yunzhouDescription: '落ち着いた穏やかな男性の声', xiaotian: 'Xiaotian 2.0', xiaotianDescription: '明瞭で若々しい男性の声', customDescription: '音声サービスに設定されたカスタム音声',
  speechRate: '話す速さ', volume: '再生音量', volumeHint: 'このクライアントにのみ保存されます。システムの音量は変わりません。',
  example: '試聴テキスト', exampleDefault: 'こんにちは！お手伝いする準備ができました。次のアイデアを一緒に考えましょう。', preview: '声を試聴', stop: '試聴を停止', previewing: '試聴中…',
  previewHint: '試聴には編集中の設定を使います。通話中は、試聴が終わるまでマイク入力と自動読み上げを一時停止します。',
  more: 'その他の設定', pitch: '声の高さ', style: '話し方', natural: '自然', gentle: '優しい', lively: '活発',
  detection: '発話検出', threshold: '中断の感度', thresholdHint: '感度が低いほど大きな声が必要です。RMS しきい値は録音の開始にも使われます。',
  lower: '低い', higher: '高い', minSpeech: '検出までに必要な連続発話', minSpeechHint: '短い音は無視されます。この待ち時間は中断と自動録音の両方に適用されます。',
  defaults: '既定値に戻す', cancel: 'キャンセル', apply: '適用', applying: '適用中…', close: '音声設定を閉じる',
  loading: '音声設定を読み込み中…', loadError: '音声設定を読み込めませんでした。閉じてから開き直してください。',
  previewError: '試聴できませんでした。音声サービスと音声出力を確認して再試行してください。',
  saveError: '設定を保存できませんでした。パネルを開き直して現在の値を読み込み、再試行してください。',
  readonly: 'このプロファイルの音声設定は読み取り専用です。', changed: '変更は次の読み上げから適用されます。',
} satisfies Record<keyof typeof settingsEn, string>

/** Spanish voice preferences and preview controls. */
export const settingsEs = {
  rms: 'RMS', milliseconds: 'ms',
  title: 'Conversación de voz', open: 'Ajustes de voz', description: 'Elige la voz del agente y cuándo el habla interrumpe su respuesta.',
  speaker: 'Voz', xiaohe: 'Xiaohe 2.0', xiaoheDescription: 'Voz femenina clara y cálida', vivi: 'Vivi 2.0', viviDescription: 'Voz femenina alegre y expresiva',
  yunzhou: 'Yunzhou 2.0', yunzhouDescription: 'Voz masculina firme y relajada', xiaotian: 'Xiaotian 2.0', xiaotianDescription: 'Voz masculina clara y juvenil', customDescription: 'Voz personalizada configurada por el servicio de voz',
  speechRate: 'Velocidad del habla', volume: 'Volumen de reproducción', volumeHint: 'Se guarda solo en este cliente. No cambia el volumen del sistema.',
  example: 'Texto de prueba', exampleDefault: '¡Hola! Estoy listo para ayudarte. Exploremos juntos tu próxima idea.', preview: 'Probar voz', stop: 'Detener prueba', previewing: 'Reproduciendo prueba…',
  previewHint: 'La prueba usa estos ajustes sin guardar. Durante una llamada, el micrófono y las respuestas de voz se pausan hasta que termine.',
  more: 'Más opciones', pitch: 'Tono', style: 'Expresión', natural: 'Natural', gentle: 'Suave', lively: 'Animada',
  detection: 'Detección del habla', threshold: 'Sensibilidad de interrupción', thresholdHint: 'Una sensibilidad menor requiere hablar más fuerte. El umbral RMS también determina cuándo comienza la grabación.',
  lower: 'Menor', higher: 'Mayor', minSpeech: 'Habla continua antes de activarse', minSpeechHint: 'Se ignoran los sonidos más cortos. Este tiempo se aplica tanto a la interrupción como a la grabación automática.',
  defaults: 'Restaurar valores predeterminados', cancel: 'Cancelar', apply: 'Aplicar', applying: 'Aplicando…', close: 'Cerrar ajustes de voz',
  loading: 'Cargando ajustes de voz…', loadError: 'No se pudieron cargar los ajustes de voz. Cierra y vuelve a abrir para reintentar.',
  previewError: 'La prueba falló. Comprueba el servicio de voz y la salida de audio y vuelve a intentarlo.',
  saveError: 'No se guardaron los ajustes. Vuelve a abrir el panel para cargar los valores actuales y reintentar.',
  readonly: 'Las preferencias de voz son de solo lectura en este perfil.', changed: 'Los cambios se aplican a la siguiente frase hablada.',
} satisfies Record<keyof typeof settingsEn, string>

/** French voice preferences and preview controls. */
export const settingsFr = {
  rms: 'RMS', milliseconds: 'ms',
  title: 'Conversation vocale', open: 'Paramètres vocaux', description: 'Choisissez la voix de l’agent et les conditions d’interruption par la parole.',
  speaker: 'Voix', xiaohe: 'Xiaohe 2.0', xiaoheDescription: 'Voix féminine claire et chaleureuse', vivi: 'Vivi 2.0', viviDescription: 'Voix féminine vive et expressive',
  yunzhou: 'Yunzhou 2.0', yunzhouDescription: 'Voix masculine posée et détendue', xiaotian: 'Xiaotian 2.0', xiaotianDescription: 'Voix masculine claire et jeune', customDescription: 'Voix personnalisée configurée par le service vocal',
  speechRate: 'Débit de parole', volume: 'Volume de lecture', volumeHint: 'Enregistré dans ce client uniquement. Le volume du système reste inchangé.',
  example: 'Texte d’essai', exampleDefault: 'Bonjour ! Je suis prêt à vous aider. Explorons ensemble votre prochaine idée.', preview: 'Écouter la voix', stop: 'Arrêter l’essai', previewing: 'Lecture de l’essai…',
  previewHint: 'L’essai utilise ces réglages non enregistrés. Pendant un appel, le microphone et les réponses vocales sont suspendus jusqu’à la fin de l’essai.',
  more: 'Plus d’options', pitch: 'Hauteur', style: 'Expression', natural: 'Naturelle', gentle: 'Douce', lively: 'Enjouée',
  detection: 'Détection de la parole', threshold: 'Sensibilité d’interruption', thresholdHint: 'Une sensibilité plus faible exige de parler plus fort. Le seuil RMS détermine aussi le début de l’enregistrement.',
  lower: 'Faible', higher: 'Élevée', minSpeech: 'Parole continue avant déclenchement', minSpeechHint: 'Les sons plus courts sont ignorés. Ce délai s’applique à l’interruption et à l’enregistrement automatique.',
  defaults: 'Rétablir les valeurs par défaut', cancel: 'Annuler', apply: 'Appliquer', applying: 'Application…', close: 'Fermer les paramètres vocaux',
  loading: 'Chargement des paramètres vocaux…', loadError: 'Impossible de charger les paramètres vocaux. Fermez puis rouvrez le panneau pour réessayer.',
  previewError: 'L’essai a échoué. Vérifiez le service vocal et la sortie audio, puis réessayez.',
  saveError: 'Les paramètres n’ont pas été enregistrés. Rouvrez le panneau pour charger les valeurs actuelles et réessayez.',
  readonly: 'Les préférences vocales sont en lecture seule dans ce profil.', changed: 'Les modifications s’appliquent à la prochaine phrase prononcée.',
} satisfies Record<keyof typeof settingsEn, string>

/** German voice preferences and preview controls. */
export const settingsDe = {
  rms: 'RMS', milliseconds: 'ms',
  title: 'Sprachgespräch', open: 'Spracheinstellungen', description: 'Wählen Sie die Stimme des Agenten und wann Sprache seine Antwort unterbricht.',
  speaker: 'Stimme', xiaohe: 'Xiaohe 2.0', xiaoheDescription: 'Klare, warme weibliche Stimme', vivi: 'Vivi 2.0', viviDescription: 'Helle, ausdrucksstarke weibliche Stimme',
  yunzhou: 'Yunzhou 2.0', yunzhouDescription: 'Ruhige, entspannte männliche Stimme', xiaotian: 'Xiaotian 2.0', xiaotianDescription: 'Klare, jugendliche männliche Stimme', customDescription: 'Benutzerdefinierte Stimme des Sprachdienstes',
  speechRate: 'Sprechgeschwindigkeit', volume: 'Wiedergabelautstärke', volumeHint: 'Wird nur in diesem Client gespeichert. Die Systemlautstärke bleibt unverändert.',
  example: 'Vorschautext', exampleDefault: 'Hallo! Ich bin bereit zu helfen. Lassen Sie uns Ihre nächste Idee gemeinsam erkunden.', preview: 'Stimme anhören', stop: 'Vorschau stoppen', previewing: 'Vorschau wird abgespielt…',
  previewHint: 'Die Vorschau verwendet diese ungespeicherten Einstellungen. Während eines Anrufs pausieren Mikrofon und automatische Sprachausgabe bis zum Ende der Vorschau.',
  more: 'Weitere Optionen', pitch: 'Tonhöhe', style: 'Sprechweise', natural: 'Natürlich', gentle: 'Sanft', lively: 'Lebhaft',
  detection: 'Spracherkennung', threshold: 'Unterbrechungsempfindlichkeit', thresholdHint: 'Bei geringerer Empfindlichkeit müssen Sie lauter sprechen. Der RMS-Schwellenwert bestimmt auch den Aufnahmebeginn.',
  lower: 'Niedriger', higher: 'Höher', minSpeech: 'Durchgehende Sprache vor Auslösung', minSpeechHint: 'Kürzere Geräusche werden ignoriert. Diese Verzögerung gilt für Unterbrechung und automatische Aufnahme.',
  defaults: 'Standardwerte wiederherstellen', cancel: 'Abbrechen', apply: 'Anwenden', applying: 'Wird angewendet…', close: 'Spracheinstellungen schließen',
  loading: 'Spracheinstellungen werden geladen…', loadError: 'Spracheinstellungen konnten nicht geladen werden. Schließen und öffnen Sie das Fenster erneut.',
  previewError: 'Die Vorschau ist fehlgeschlagen. Prüfen Sie Sprachdienst und Audioausgabe und versuchen Sie es erneut.',
  saveError: 'Die Einstellungen wurden nicht gespeichert. Öffnen Sie das Fenster erneut, um die aktuellen Werte zu laden und es erneut zu versuchen.',
  readonly: 'Die Spracheinstellungen sind in diesem Profil schreibgeschützt.', changed: 'Änderungen gelten ab dem nächsten gesprochenen Satz.',
} satisfies Record<keyof typeof settingsEn, string>

/** Russian voice preferences and preview controls. */
export const settingsRu = {
  rms: 'RMS', milliseconds: 'мс',
  title: 'Голосовой разговор', open: 'Настройки голоса', description: 'Выберите голос агента и условия прерывания ответа речью.',
  speaker: 'Голос', xiaohe: 'Xiaohe 2.0', xiaoheDescription: 'Чёткий и тёплый женский голос', vivi: 'Vivi 2.0', viviDescription: 'Яркий и выразительный женский голос',
  yunzhou: 'Yunzhou 2.0', yunzhouDescription: 'Спокойный и расслабленный мужской голос', xiaotian: 'Xiaotian 2.0', xiaotianDescription: 'Чёткий и молодой мужской голос', customDescription: 'Пользовательский голос, настроенный в речевом сервисе',
  speechRate: 'Скорость речи', volume: 'Громкость воспроизведения', volumeHint: 'Сохраняется только в этом клиенте. Системная громкость не меняется.',
  example: 'Текст для прослушивания', exampleDefault: 'Здравствуйте! Я готов помочь. Давайте вместе рассмотрим вашу следующую идею.', preview: 'Прослушать голос', stop: 'Остановить прослушивание', previewing: 'Прослушивание…',
  previewHint: 'Прослушивание использует несохранённые настройки. Во время звонка микрофон и автоматическое озвучивание приостанавливаются до его завершения.',
  more: 'Дополнительные параметры', pitch: 'Высота голоса', style: 'Манера речи', natural: 'Естественная', gentle: 'Мягкая', lively: 'Оживлённая',
  detection: 'Обнаружение речи', threshold: 'Чувствительность прерывания', thresholdHint: 'При меньшей чувствительности нужно говорить громче. Порог RMS также определяет начало записи.',
  lower: 'Ниже', higher: 'Выше', minSpeech: 'Непрерывная речь до срабатывания', minSpeechHint: 'Более короткие звуки игнорируются. Эта задержка действует и для прерывания, и для автоматической записи.',
  defaults: 'Восстановить значения по умолчанию', cancel: 'Отмена', apply: 'Применить', applying: 'Применение…', close: 'Закрыть настройки голоса',
  loading: 'Загрузка настроек голоса…', loadError: 'Не удалось загрузить настройки голоса. Закройте и снова откройте панель.',
  previewError: 'Не удалось воспроизвести пример. Проверьте речевой сервис и устройство вывода и повторите попытку.',
  saveError: 'Настройки не сохранены. Снова откройте панель, чтобы загрузить текущие значения и повторить попытку.',
  readonly: 'В этом профиле настройки голоса доступны только для чтения.', changed: 'Изменения действуют со следующей озвучиваемой фразы.',
} satisfies Record<keyof typeof settingsEn, string>

/** Portuguese voice preferences and preview controls. */
export const settingsPt = {
  rms: 'RMS', milliseconds: 'ms',
  title: 'Conversa por voz', open: 'Configurações de voz', description: 'Escolha a voz do agente e quando a fala interrompe a resposta.',
  speaker: 'Voz', xiaohe: 'Xiaohe 2.0', xiaoheDescription: 'Voz feminina clara e acolhedora', vivi: 'Vivi 2.0', viviDescription: 'Voz feminina alegre e expressiva',
  yunzhou: 'Yunzhou 2.0', yunzhouDescription: 'Voz masculina firme e relaxada', xiaotian: 'Xiaotian 2.0', xiaotianDescription: 'Voz masculina clara e jovem', customDescription: 'Voz personalizada configurada no serviço de voz',
  speechRate: 'Velocidade da fala', volume: 'Volume de reprodução', volumeHint: 'Salvo apenas neste cliente. Não altera o volume do sistema.',
  example: 'Texto de teste', exampleDefault: 'Olá! Estou pronto para ajudar. Vamos explorar sua próxima ideia juntos.', preview: 'Testar voz', stop: 'Parar teste', previewing: 'Reproduzindo teste…',
  previewHint: 'O teste usa estas configurações ainda não salvas. Durante uma chamada, o microfone e as respostas de voz ficam pausados até o teste terminar.',
  more: 'Mais opções', pitch: 'Tom', style: 'Expressão', natural: 'Natural', gentle: 'Suave', lively: 'Animada',
  detection: 'Detecção de fala', threshold: 'Sensibilidade de interrupção', thresholdHint: 'Uma sensibilidade menor exige falar mais alto. O limite RMS também controla o início da gravação.',
  lower: 'Menor', higher: 'Maior', minSpeech: 'Fala contínua antes de acionar', minSpeechHint: 'Sons mais curtos são ignorados. Esse tempo vale para a interrupção e a gravação automática.',
  defaults: 'Restaurar padrões', cancel: 'Cancelar', apply: 'Aplicar', applying: 'Aplicando…', close: 'Fechar configurações de voz',
  loading: 'Carregando configurações de voz…', loadError: 'Não foi possível carregar as configurações de voz. Feche e abra novamente para tentar de novo.',
  previewError: 'O teste falhou. Verifique o serviço de voz e a saída de áudio e tente novamente.',
  saveError: 'As configurações não foram salvas. Abra o painel novamente para carregar os valores atuais e tentar de novo.',
  readonly: 'As preferências de voz são somente leitura neste perfil.', changed: 'As alterações valem a partir da próxima frase falada.',
} satisfies Record<keyof typeof settingsEn, string>

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Voice settings dialog and its General entry. */
    'voice-conversation.settings': keyof typeof settingsEn
  }
}
