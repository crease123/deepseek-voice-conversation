/** Locale-owned personal Agent prompt editing and conflict recovery. */
import type {} from '@deepseek-ai/dsh-client-ui-slots'

/** Personal settings dictionary namespace. */
export const PERSONAL_NS = 'voice-conversation.personal-agent'
/** English personal Agent page copy and key source. */
export const personalEn = {
  title: 'Voice call instructions', description: 'Set how the model speaks during voice calls.',
  usage: 'Start a voice call in any conversation. These rules apply only while the call is connected.',
  basePrompt: 'Base instructions', baseHint: 'Identity, communication style, and task handling. Active in both text and voice conversations.',
  callPrompt: 'Call instructions', callHint: 'Added during a voice call and removed after hanging up. Keep spoken answers brief and natural.',
  cancel: 'Cancel', save: 'Save', saving: 'Saving…',
  timing: 'Saved changes apply to the next model request. A response already in progress keeps its current instructions.',
  readonly: 'Voice call instructions are read-only in this profile.',
  loading: 'Loading instructions…', loadError: 'Instructions could not be loaded. Leave this page and reopen it to retry.',
  saveError: 'Instructions were not saved. Your draft is preserved; check the connection and retry.',
  conflict: 'Saved instructions changed elsewhere. Your draft is preserved; choose Cancel to load the latest version before editing again.',
  preview: 'View active rules', previewMode: 'Conversation type', textMode: 'Text', callMode: 'Voice call', savedRules: 'Saved rules',
  previewHint: 'Shows saved custom instructions only. DSH tool instructions and live call status are added separately. Unsaved edits do not affect this preview.',
} as const
/** Chinese personal Agent page copy. */
export const personalZh = {
  title: '通话提示词', description: '设置模型在语音通话期间的表达规则',
  usage: '在任意会话中开启语音通话；这些规则仅在通话期间生效',
  basePrompt: '基础提示词', baseHint: '定义身份、沟通习惯和任务处理方式，文字交流和语音通话时均生效',
  callPrompt: '通话补充规则', callHint: '通话时叠加，挂断后移除；可要求回答简短、自然口语表达',
  cancel: '取消', save: '保存', saving: '正在保存…',
  timing: '保存后从下一次模型请求生效，已经生成中的回答沿用当前规则', readonly: '当前配置中的语音通话 提示词为只读',
  loading: '正在加载提示词…', loadError: '无法加载提示词，请离开此页后重新打开重试',
  saveError: '提示词未保存，草稿已保留；请检查连接后重试',
  conflict: '已保存的提示词被其他位置修改，草稿已保留；请先点「取消」加载最新版本后重新编辑',
  preview: '查看当前生效规则', previewMode: '交流方式', textMode: '文字交流', callMode: '语音通话', savedRules: '已保存规则',
  previewHint: '仅展示已保存的自定义提示词，DSH 工具指令和实时通话状态另行加入；未保存的草稿不影响此预览',
} satisfies Record<keyof typeof personalEn, string>
/** Japanese personal Agent page copy. */
export const personalJa = {
  title: 'パーソナルエージェント', description: 'エージェントの作業方針と通話中の話し方を設定します。',
  usage: 'どの会話でも音声通話を開始できます。このルールは通話中だけ適用されます。',
  basePrompt: '基本指示', baseHint: '役割、話し方、作業方針。テキストと音声の両方で有効です。',
  callPrompt: '通話中の追加指示', callHint: '通話中に追加され、切断後に解除されます。短く自然な応答を指定できます。',
  cancel: 'キャンセル', save: '保存', saving: '保存中…',
  timing: '変更は次のモデル要求から適用されます。生成中の応答は現在の指示を使います。', readonly: 'このプロファイルの指示は読み取り専用です。',
  loading: '指示を読み込み中…', loadError: '指示を読み込めませんでした。このページを離れてから開き直してください。',
  saveError: '保存できませんでした。下書きは保持されています。接続を確認して再試行してください。',
  conflict: '保存済みの指示が別の場所で変更されました。下書きは保持されています。キャンセルで最新版を読み込んでから編集してください。',
  preview: '有効なルールを表示', previewMode: '会話の種類', textMode: 'テキスト', callMode: '音声通話', savedRules: '保存済みルール',
  previewHint: '保存済みのカスタム指示のみ表示します。DSHのツール指示と通話状態は別途追加されます。未保存の編集は反映されません。',
} satisfies Record<keyof typeof personalEn, string>
/** Spanish personal Agent page copy. */
export const personalEs = {
  title: 'Agente personal', description: 'Define cómo trabaja tu agente y cómo habla durante las llamadas.',
  usage: 'Inicia una llamada en cualquier conversación. Estas reglas solo se aplican durante la llamada.',
  basePrompt: 'Instrucciones base', baseHint: 'Identidad, comunicación y gestión de tareas. Se aplican tanto al texto como a la voz.',
  callPrompt: 'Instrucciones de llamada', callHint: 'Se añaden durante la llamada y se retiran al colgar. Pide respuestas breves y naturales.',
  cancel: 'Cancelar', save: 'Guardar', saving: 'Guardando…',
  timing: 'Los cambios se aplican a la próxima solicitud al modelo. Una respuesta en curso conserva sus instrucciones.', readonly: 'Las instrucciones son de solo lectura en este perfil.',
  loading: 'Cargando instrucciones…', loadError: 'No se pudieron cargar las instrucciones. Sal de esta página y vuelve a abrirla.',
  saveError: 'No se guardaron las instrucciones. Se conserva el borrador; comprueba la conexión y reintenta.',
  conflict: 'Las instrucciones guardadas cambiaron en otro lugar. Se conserva el borrador; pulsa Cancelar para cargar la última versión antes de editar.',
  preview: 'Ver reglas activas', previewMode: 'Tipo de conversación', textMode: 'Texto', callMode: 'Llamada de voz', savedRules: 'Reglas guardadas',
  previewHint: 'Solo muestra las instrucciones personalizadas guardadas. Las instrucciones de herramientas DSH y el estado de la llamada se añaden aparte. El borrador no afecta a esta vista.',
} satisfies Record<keyof typeof personalEn, string>
/** French personal Agent page copy. */
export const personalFr = {
  title: 'Agent personnel', description: 'Définissez le travail de votre agent et sa façon de parler pendant les appels.',
  usage: 'Démarrez un appel dans toute conversation. Ces règles s’appliquent uniquement pendant l’appel.',
  basePrompt: 'Instructions de base', baseHint: 'Identité, communication et gestion des tâches. Actives à l’écrit et à l’oral.',
  callPrompt: 'Instructions d’appel', callHint: 'Ajoutées pendant l’appel et retirées ensuite. Demandez des réponses brèves et naturelles.',
  cancel: 'Annuler', save: 'Enregistrer', saving: 'Enregistrement…',
  timing: 'Les changements s’appliquent à la prochaine requête au modèle. Une réponse en cours conserve ses instructions.', readonly: 'Les instructions sont en lecture seule dans ce profil.',
  loading: 'Chargement des instructions…', loadError: 'Impossible de charger les instructions. Quittez cette page puis rouvrez-la.',
  saveError: 'Les instructions n’ont pas été enregistrées. Le brouillon est conservé ; vérifiez la connexion et réessayez.',
  conflict: 'Les instructions enregistrées ont changé ailleurs. Le brouillon est conservé ; choisissez Annuler pour charger la dernière version avant de modifier.',
  preview: 'Voir les règles actives', previewMode: 'Type de conversation', textMode: 'Texte', callMode: 'Appel vocal', savedRules: 'Règles enregistrées',
  previewHint: 'Affiche uniquement les instructions personnalisées enregistrées. Les instructions des outils DSH et l’état de l’appel sont ajoutés séparément. Le brouillon ne modifie pas cet aperçu.',
} satisfies Record<keyof typeof personalEn, string>
/** German personal Agent page copy. */
export const personalDe = {
  title: 'Persönlicher Agent', description: 'Legen Sie Arbeitsweise und Sprechstil Ihres persönlichen Agenten fest.',
  usage: 'Starten Sie einen Sprachanruf in einem beliebigen Gespräch. Diese Regeln gelten nur während des Anrufs.',
  basePrompt: 'Grundlegende Anweisungen', baseHint: 'Identität, Kommunikation und Aufgabenbearbeitung. Für Text und Sprache aktiv.',
  callPrompt: 'Anweisungen für Anrufe', callHint: 'Während des Anrufs hinzugefügt und danach entfernt. Für kurze, natürliche Antworten.',
  cancel: 'Abbrechen', save: 'Speichern', saving: 'Wird gespeichert…',
  timing: 'Änderungen gelten ab der nächsten Modellanfrage. Eine laufende Antwort behält ihre bisherigen Anweisungen.', readonly: 'Die Anweisungen sind in diesem Profil schreibgeschützt.',
  loading: 'Anweisungen werden geladen…', loadError: 'Anweisungen konnten nicht geladen werden. Verlassen Sie die Seite und öffnen Sie sie erneut.',
  saveError: 'Die Anweisungen wurden nicht gespeichert. Der Entwurf bleibt erhalten; prüfen Sie die Verbindung und versuchen Sie es erneut.',
  conflict: 'Die gespeicherten Anweisungen wurden andernorts geändert. Der Entwurf bleibt erhalten; laden Sie mit Abbrechen die neueste Version vor der Bearbeitung.',
  preview: 'Aktive Regeln anzeigen', previewMode: 'Gesprächstyp', textMode: 'Text', callMode: 'Sprachanruf', savedRules: 'Gespeicherte Regeln',
  previewHint: 'Zeigt nur gespeicherte eigene Anweisungen. DSH-Werkzeuganweisungen und der Anrufstatus werden separat hinzugefügt. Ungespeicherte Änderungen erscheinen hier nicht.',
} satisfies Record<keyof typeof personalEn, string>
/** Russian personal Agent page copy. */
export const personalRu = {
  title: 'Личный агент', description: 'Настройте работу агента и его речь во время звонков.',
  usage: 'Выберите Voice call для нового разговора. Эти правила действуют только в этом режиме.',
  basePrompt: 'Основные инструкции', baseHint: 'Роль, стиль общения и работа с задачами. Действуют для текста и голоса.',
  callPrompt: 'Инструкции для звонка', callHint: 'Добавляются на время звонка и убираются после завершения. Задайте краткие естественные ответы.',
  cancel: 'Отмена', save: 'Сохранить', saving: 'Сохранение…',
  timing: 'Изменения действуют со следующего запроса к модели. Текущий ответ использует прежние инструкции.', readonly: 'В этом профиле инструкции доступны только для чтения.',
  loading: 'Загрузка инструкций…', loadError: 'Не удалось загрузить инструкции. Покиньте страницу и откройте её снова.',
  saveError: 'Инструкции не сохранены. Черновик оставлен; проверьте соединение и повторите попытку.',
  conflict: 'Сохранённые инструкции изменились в другом месте. Черновик оставлен; нажмите «Отмена», чтобы загрузить последнюю версию перед редактированием.',
  preview: 'Показать действующие правила', previewMode: 'Тип разговора', textMode: 'Текст', callMode: 'Голосовой звонок', savedRules: 'Сохранённые правила',
  previewHint: 'Показаны только сохранённые пользовательские инструкции. Инструкции инструментов DSH и состояние звонка добавляются отдельно. Несохранённые правки здесь не показаны.',
} satisfies Record<keyof typeof personalEn, string>
/** Portuguese personal Agent page copy. */
export const personalPt = {
  title: 'Agente pessoal', description: 'Defina como o agente trabalha e como fala durante chamadas.',
  usage: 'Escolha Voice call ao iniciar uma conversa. Estas regras só se aplicam a esse modo.',
  basePrompt: 'Instruções básicas', baseHint: 'Identidade, comunicação e execução de tarefas. Ativas em texto e voz.',
  callPrompt: 'Instruções de chamada', callHint: 'Adicionadas durante a chamada e removidas ao desligar. Peça respostas curtas e naturais.',
  cancel: 'Cancelar', save: 'Salvar', saving: 'Salvando…',
  timing: 'As alterações valem a partir da próxima solicitação ao modelo. Uma resposta em andamento mantém suas instruções.', readonly: 'As instruções são somente leitura neste perfil.',
  loading: 'Carregando instruções…', loadError: 'Não foi possível carregar as instruções. Saia desta página e abra-a novamente.',
  saveError: 'As instruções não foram salvas. O rascunho foi mantido; verifique a conexão e tente novamente.',
  conflict: 'As instruções salvas mudaram em outro lugar. O rascunho foi mantido; escolha Cancelar para carregar a versão mais recente antes de editar.',
  preview: 'Ver regras ativas', previewMode: 'Tipo de conversa', textMode: 'Texto', callMode: 'Chamada de voz', savedRules: 'Regras salvas',
  previewHint: 'Mostra apenas as instruções personalizadas salvas. As instruções de ferramentas DSH e o estado da chamada são adicionados à parte. Edições não salvas não afetam esta prévia.',
} satisfies Record<keyof typeof personalEn, string>

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Personal Agent prompts and settings recovery. */
    'voice-conversation.personal-agent': keyof typeof personalEn
  }
}
