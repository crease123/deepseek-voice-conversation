/** Typed locale-owned call controls and recovery advice. */
import type {} from '@deepseek-ai/dsh-client-ui-slots'

/** Dictionary namespace for voice conversation controls. */
export const NS = 'voice-conversation'
/** English dictionary and key source. */
export const en = {
  start: 'Start voice call', hangup: 'Hang up voice call', retry: 'Retry voice call',
  paused: 'Paused for preview', connecting: 'Connecting…', listening: 'Listening', recognizing: 'Recognizing…', thinking: 'Thinking…', speaking: 'Speaking…', stopping: 'Ending call…',
  unavailable: 'Voice calls need a browser with AudioWorklet and microphone access. Try a supported browser.',
  permission: 'Microphone access is blocked. Allow it in browser and system settings, then retry.',
  microphone: 'The microphone stopped. Check your input device, then retry the call.',
  playback: 'Audio playback failed. Check the audio output, then retry the call.',
  connection: 'The speech connection failed. Check the voice plugin settings and connection, then retry.',
  recognition: 'Speech recognition failed. Check the speech service settings, then retry the call.',
  synthesis: 'Voice playback stopped because synthesis failed. Check the speech service settings, then retry.',
  submission: 'The voice message could not be confirmed. Check the conversation before retrying.',
  cancellation: 'The running response could not be stopped. Use Stop in the conversation before retrying the call.',
  backlog: 'Speech recognition could not keep up. The call stopped; retry with shorter phrases.',
}
/** Chinese call controls, checked against the English keys. */
export const zh = {
  start: '开始语音通话', hangup: '挂断语音通话', retry: '重试语音通话',
  paused: '试听暂停中', connecting: '连接中…', listening: '正在聆听', recognizing: '识别中…', thinking: '思考中…', speaking: '正在播报…', stopping: '正在挂断…',
  unavailable: '语音通话需要支持 AudioWorklet 和麦克风的浏览器，请更换浏览器后重试',
  permission: '麦克风权限已关闭，请在浏览器和系统设置中允许访问后重试',
  microphone: '麦克风已中断，请检查输入设备后重试通话',
  playback: '音频播放失败，请检查输出设备后重试通话',
  connection: '语音服务连接失败，请检查语音插件设置和网络后重试',
  recognition: '语音识别失败，请检查语音服务配置后重试通话',
  synthesis: '语音合成失败，播报已停止，请检查语音服务配置后重试',
  submission: '无法确认语音消息是否已发送，请先检查会话再重试',
  cancellation: '无法停止当前回复，请先在会话中停止任务，再重试通话',
  backlog: '语音识别未能及时完成，通话已停止，请重试并缩短每次发言',
} satisfies Record<keyof typeof en, string>

/** Japanese call controls and recovery advice. */
export const ja = {
  paused: '試聴のため一時停止中',
  start: '音声通話を開始',
  hangup: '音声通話を終了',
  retry: '音声通話を再試行',
  connecting: '接続中…',
  listening: '聞き取り中',
  recognizing: '認識中…',
  thinking: '思考中…',
  speaking: '読み上げ中…',
  stopping: '通話を終了中…',
  unavailable: '音声通話には AudioWorklet とマイクに対応したブラウザーが必要です。対応するブラウザーで再試行してください。',
  permission: 'マイクへのアクセスがブロックされています。ブラウザーとシステムの設定で許可してから再試行してください。',
  microphone: 'マイクが停止しました。入力デバイスを確認してから通話を再試行してください。',
  playback: '音声を再生できませんでした。出力デバイスを確認してから通話を再試行してください。',
  connection: '音声サービスに接続できませんでした。音声プラグインの設定と接続を確認してから再試行してください。',
  recognition: '音声を認識できませんでした。音声サービスの設定を確認してから通話を再試行してください。',
  synthesis: '音声合成に失敗したため再生が停止しました。音声サービスの設定を確認してから再試行してください。',
  submission: '音声メッセージの送信を確認できませんでした。再試行する前に会話を確認してください。',
  cancellation: '実行中の応答を停止できませんでした。会話の停止操作でタスクを止めてから通話を再試行してください。',
  backlog: '音声認識が追いつかず通話が停止しました。発言を短くして再試行してください。',
} satisfies Record<keyof typeof en, string>

/** Spanish call controls and recovery advice. */
export const es = {
  paused: 'En pausa para la prueba',
  start: 'Iniciar llamada de voz',
  hangup: 'Colgar llamada de voz',
  retry: 'Reintentar llamada de voz',
  connecting: 'Conectando…',
  listening: 'Escuchando',
  recognizing: 'Reconociendo…',
  thinking: 'Pensando…',
  speaking: 'Hablando…',
  stopping: 'Finalizando llamada…',
  unavailable: 'Las llamadas de voz necesitan un navegador compatible con AudioWorklet y acceso al micrófono. Prueba un navegador compatible.',
  permission: 'El acceso al micrófono está bloqueado. Permítelo en los ajustes del navegador y del sistema y vuelve a intentarlo.',
  microphone: 'El micrófono se detuvo. Comprueba el dispositivo de entrada y vuelve a intentar la llamada.',
  playback: 'No se pudo reproducir el audio. Comprueba la salida de audio y vuelve a intentar la llamada.',
  connection: 'Falló la conexión de voz. Comprueba los ajustes del plugin de voz y la conexión y vuelve a intentarlo.',
  recognition: 'Falló el reconocimiento de voz. Comprueba los ajustes del servicio de voz y vuelve a intentar la llamada.',
  synthesis: 'La reproducción se detuvo porque falló la síntesis de voz. Comprueba los ajustes del servicio de voz y vuelve a intentarlo.',
  submission: 'No se pudo confirmar el mensaje de voz. Comprueba la conversación antes de volver a intentarlo.',
  cancellation: 'No se pudo detener la respuesta en curso. Usa Detener en la conversación antes de volver a intentar la llamada.',
  backlog: 'El reconocimiento de voz no pudo seguir el ritmo y la llamada se detuvo. Vuelve a intentarlo con frases más cortas.',
} satisfies Record<keyof typeof en, string>

/** French call controls and recovery advice. */
export const fr = {
  paused: 'En pause pour l’essai',
  start: 'Démarrer un appel vocal',
  hangup: 'Raccrocher l’appel vocal',
  retry: 'Réessayer l’appel vocal',
  connecting: 'Connexion…',
  listening: 'À l’écoute',
  recognizing: 'Reconnaissance…',
  thinking: 'Réflexion…',
  speaking: 'Lecture vocale…',
  stopping: 'Fin de l’appel…',
  unavailable: 'Les appels vocaux nécessitent un navigateur compatible avec AudioWorklet et l’accès au microphone. Essayez un navigateur compatible.',
  permission: 'L’accès au microphone est bloqué. Autorisez-le dans les paramètres du navigateur et du système, puis réessayez.',
  microphone: 'Le microphone s’est arrêté. Vérifiez le périphérique d’entrée, puis réessayez l’appel.',
  playback: 'La lecture audio a échoué. Vérifiez la sortie audio, puis réessayez l’appel.',
  connection: 'La connexion vocale a échoué. Vérifiez les paramètres du plugin vocal et la connexion, puis réessayez.',
  recognition: 'La reconnaissance vocale a échoué. Vérifiez les paramètres du service vocal, puis réessayez l’appel.',
  synthesis: 'La lecture s’est arrêtée après un échec de synthèse vocale. Vérifiez les paramètres du service vocal, puis réessayez.',
  submission: 'Le message vocal n’a pas pu être confirmé. Vérifiez la conversation avant de réessayer.',
  cancellation: 'La réponse en cours n’a pas pu être arrêtée. Utilisez Arrêter dans la conversation avant de réessayer l’appel.',
  backlog: 'La reconnaissance vocale n’a pas suivi le rythme et l’appel s’est arrêté. Réessayez avec des phrases plus courtes.',
} satisfies Record<keyof typeof en, string>

/** German call controls and recovery advice. */
export const de = {
  paused: 'Für die Vorschau pausiert',
  start: 'Sprachanruf starten',
  hangup: 'Sprachanruf beenden',
  retry: 'Sprachanruf erneut versuchen',
  connecting: 'Verbindung wird hergestellt…',
  listening: 'Hört zu',
  recognizing: 'Erkennung läuft…',
  thinking: 'Denkt nach…',
  speaking: 'Spricht…',
  stopping: 'Anruf wird beendet…',
  unavailable: 'Sprachanrufe erfordern einen Browser mit AudioWorklet und Mikrofonzugriff. Versuchen Sie einen unterstützten Browser.',
  permission: 'Der Mikrofonzugriff ist blockiert. Erlauben Sie ihn in den Browser- und Systemeinstellungen und versuchen Sie es erneut.',
  microphone: 'Das Mikrofon wurde unterbrochen. Prüfen Sie das Eingabegerät und versuchen Sie den Anruf erneut.',
  playback: 'Die Audiowiedergabe ist fehlgeschlagen. Prüfen Sie die Audioausgabe und versuchen Sie den Anruf erneut.',
  connection: 'Die Sprachverbindung ist fehlgeschlagen. Prüfen Sie die Einstellungen des Sprachplugins und die Verbindung und versuchen Sie es erneut.',
  recognition: 'Die Spracherkennung ist fehlgeschlagen. Prüfen Sie die Einstellungen des Sprachdienstes und versuchen Sie den Anruf erneut.',
  synthesis: 'Die Wiedergabe wurde wegen eines Fehlers bei der Sprachsynthese gestoppt. Prüfen Sie die Einstellungen des Sprachdienstes und versuchen Sie es erneut.',
  submission: 'Die Sprachnachricht konnte nicht bestätigt werden. Prüfen Sie das Gespräch vor einem erneuten Versuch.',
  cancellation: 'Die laufende Antwort konnte nicht gestoppt werden. Verwenden Sie zuerst Stopp im Gespräch und versuchen Sie dann den Anruf erneut.',
  backlog: 'Die Spracherkennung kam nicht nach und der Anruf wurde beendet. Versuchen Sie es mit kürzeren Sätzen erneut.',
} satisfies Record<keyof typeof en, string>

/** Russian call controls and recovery advice. */
export const ru = {
  paused: 'Приостановлено для прослушивания',
  start: 'Начать голосовой звонок',
  hangup: 'Завершить голосовой звонок',
  retry: 'Повторить голосовой звонок',
  connecting: 'Подключение…',
  listening: 'Слушаю',
  recognizing: 'Распознавание…',
  thinking: 'Обдумывание…',
  speaking: 'Озвучивание…',
  stopping: 'Завершение звонка…',
  unavailable: 'Для голосовых звонков нужен браузер с AudioWorklet и доступом к микрофону. Попробуйте поддерживаемый браузер.',
  permission: 'Доступ к микрофону заблокирован. Разрешите его в настройках браузера и системы и повторите попытку.',
  microphone: 'Микрофон отключился. Проверьте устройство ввода и повторите звонок.',
  playback: 'Не удалось воспроизвести звук. Проверьте устройство вывода и повторите звонок.',
  connection: 'Не удалось подключиться к голосовому сервису. Проверьте настройки голосового плагина и соединение и повторите попытку.',
  recognition: 'Не удалось распознать речь. Проверьте настройки голосового сервиса и повторите звонок.',
  synthesis: 'Воспроизведение остановлено из-за ошибки синтеза речи. Проверьте настройки голосового сервиса и повторите попытку.',
  submission: 'Не удалось подтвердить отправку голосового сообщения. Проверьте разговор перед повторной попыткой.',
  cancellation: 'Не удалось остановить текущий ответ. Нажмите «Остановить» в разговоре перед повторным звонком.',
  backlog: 'Распознавание речи не успевало за разговором, и звонок завершился. Повторите попытку с более короткими фразами.',
} satisfies Record<keyof typeof en, string>

/** Portuguese call controls and recovery advice. */
export const pt = {
  paused: 'Em pausa para o teste',
  start: 'Iniciar chamada de voz',
  hangup: 'Encerrar chamada de voz',
  retry: 'Tentar chamada de voz novamente',
  connecting: 'Conectando…',
  listening: 'Ouvindo',
  recognizing: 'Reconhecendo…',
  thinking: 'Pensando…',
  speaking: 'Falando…',
  stopping: 'Encerrando chamada…',
  unavailable: 'As chamadas de voz precisam de um navegador com AudioWorklet e acesso ao microfone. Tente um navegador compatível.',
  permission: 'O acesso ao microfone está bloqueado. Permita-o nas configurações do navegador e do sistema e tente novamente.',
  microphone: 'O microfone parou. Verifique o dispositivo de entrada e tente a chamada novamente.',
  playback: 'A reprodução de áudio falhou. Verifique a saída de áudio e tente a chamada novamente.',
  connection: 'A conexão de voz falhou. Verifique as configurações do plugin de voz e a conexão e tente novamente.',
  recognition: 'O reconhecimento de fala falhou. Verifique as configurações do serviço de voz e tente a chamada novamente.',
  synthesis: 'A reprodução parou porque a síntese de voz falhou. Verifique as configurações do serviço de voz e tente novamente.',
  submission: 'Não foi possível confirmar a mensagem de voz. Verifique a conversa antes de tentar novamente.',
  cancellation: 'Não foi possível interromper a resposta em andamento. Use Parar na conversa antes de tentar a chamada novamente.',
  backlog: 'O reconhecimento de fala não acompanhou o ritmo e a chamada foi encerrada. Tente novamente com frases mais curtas.',
} satisfies Record<keyof typeof en, string>

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Voice call controls and operation failures. */
    'voice-conversation': keyof typeof en
  }
}
