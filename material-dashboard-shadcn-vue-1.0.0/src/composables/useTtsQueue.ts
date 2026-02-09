import { ref, watch, type Ref } from 'vue'

type TtsQueueOptions = {
  enabled: Ref<boolean>
  lang?: string
}

const FEMALE_HINTS = ['female', 'woman', 'perempuan', 'wanita', 'putri', 'siti']

const pickBestVoice = (voices: SpeechSynthesisVoice[], lang: string) => {
  if (!voices.length) return null
  const byLang = voices.filter((voice) => voice.lang?.toLowerCase().startsWith(lang.toLowerCase()))
  const pool = byLang.length ? byLang : voices
  const preferred = pool.find((voice) =>
    FEMALE_HINTS.some((hint) => voice.name?.toLowerCase().includes(hint))
  )
  return preferred || pool[0]
}

export const useTtsQueue = ({ enabled, lang = 'id-ID' }: TtsQueueOptions) => {
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window
  const blocked = ref(false)
  const speaking = ref(false)
  const queue: string[] = []
  let cachedVoice: SpeechSynthesisVoice | null = null

  const refreshVoices = () => {
    if (!supported) return
    const voices = window.speechSynthesis.getVoices()
    cachedVoice = pickBestVoice(voices, lang)
  }

  const playNext = () => {
    if (!supported || speaking.value || blocked.value || !enabled.value) return
    const nextText = queue.shift()
    if (!nextText) return
    speak(nextText)
  }

  const speak = (text: string) => {
    if (!supported || blocked.value || !enabled.value) return
    try {
      refreshVoices()
      const utter = new SpeechSynthesisUtterance(text)
      if (cachedVoice) utter.voice = cachedVoice
      utter.lang = cachedVoice?.lang || lang
      utter.onend = () => {
        speaking.value = false
        playNext()
      }
      utter.onerror = () => {
        // Autoplay / permission block -> show banner to unlock
        speaking.value = false
        blocked.value = true
      }
      speaking.value = true
      window.speechSynthesis.speak(utter)
    } catch {
      speaking.value = false
      blocked.value = true
    }
  }

  const enqueue = (text: string) => {
    if (!supported || !enabled.value) return
    queue.push(text)
    playNext()
  }

  const resume = () => {
    if (!supported) return
    blocked.value = false
    playNext()
  }

  const stop = () => {
    if (!supported) return
    queue.length = 0
    speaking.value = false
    window.speechSynthesis.cancel()
  }

  if (supported) {
    refreshVoices()
    window.speechSynthesis.addEventListener('voiceschanged', refreshVoices)
  }

  watch(enabled, (value) => {
    if (!value) {
      stop()
    } else {
      playNext()
    }
  })

  return {
    enqueue,
    blocked,
    resume,
    stop,
    supported,
  }
}
