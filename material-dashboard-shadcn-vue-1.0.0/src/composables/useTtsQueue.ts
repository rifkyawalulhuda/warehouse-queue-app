import { onUnmounted, ref, watch, type Ref } from 'vue'

type TtsQueueOptions = {
  enabled: Ref<boolean>
  lang?: string
  gapMs?: number
  preferredGender?: 'female' | 'male' | 'neutral'
  preferGoogle?: boolean
  strictLang?: boolean
  rate?: number
  pitch?: number
  volume?: number
}

type QueueItem = {
  text: string
  gapAfter?: number
}

const FEMALE_HINTS = [
  'female',
  'woman',
  'girl',
  'perempuan',
  'wanita',
  'putri',
  'gadis',
  'siti',
  'zira',
  'jenny',
  'aria',
]
const MALE_HINTS = ['male', 'man', 'boy', 'pria', 'laki', 'ardi', 'david', 'mark']
const INDONESIAN_HINTS = ['indonesia', 'indonesian', 'bahasa indonesia', 'id-id']
const NATURAL_HINTS = ['natural', 'neural', 'wavenet', 'online', 'enhanced']
const FEMALE_PRIORITY_NAMES = ['zira', 'gadis', 'putri', 'jenny', 'aria', 'siti']

const normalizeLang = (value: string) => value.trim().toLowerCase()
const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

const getBaseLang = (value: string) => {
  const normalized = normalizeLang(value)
  return normalized.split('-')[0] || normalized
}

const isLanguageMatch = (voiceLang: string, preferredLang: string, baseLang: string) => {
  if (!voiceLang) return false
  const normalizedVoiceLang = normalizeLang(voiceLang)
  if (normalizedVoiceLang === preferredLang) return true
  if (normalizedVoiceLang === baseLang) return true
  return normalizedVoiceLang.startsWith(`${baseLang}-`)
}

const inferVoiceGender = (voice: SpeechSynthesisVoice) => {
  const voiceName = voice.name?.toLowerCase() || ''
  if (FEMALE_HINTS.some((hint) => voiceName.includes(hint))) return 'female'
  if (MALE_HINTS.some((hint) => voiceName.includes(hint))) return 'male'
  return 'unknown'
}

const isGoogleVoice = (voice: SpeechSynthesisVoice) => {
  const voiceName = voice.name?.toLowerCase() || ''
  return voiceName.includes('google')
}

const scoreVoice = (
  voice: SpeechSynthesisVoice,
  preferredLang: string,
  baseLang: string,
  preferredGender: 'female' | 'male' | 'neutral',
  preferGoogle: boolean
) => {
  const voiceName = voice.name?.toLowerCase() || ''
  const voiceLang = voice.lang?.toLowerCase() || ''
  let score = 0

  if (voiceLang === preferredLang) score += 200
  else if (voiceLang.startsWith(`${baseLang}-`) || voiceLang === baseLang) score += 120

  if (FEMALE_PRIORITY_NAMES.some((hint) => voiceName.includes(hint))) score += 120
  if (INDONESIAN_HINTS.some((hint) => voiceName.includes(hint))) score += 80
  if (NATURAL_HINTS.some((hint) => voiceName.includes(hint))) score += 40
  if (preferGoogle && isGoogleVoice(voice)) score += 90

  const voiceGender = inferVoiceGender(voice)
  if (preferredGender === 'female') {
    if (voiceGender === 'female') score += 140
    if (voiceGender === 'male') score -= 140
    if (voiceGender === 'unknown') score += 20
  }
  if (preferredGender === 'male') {
    if (voiceGender === 'male') score += 140
    if (voiceGender === 'female') score -= 140
    if (voiceGender === 'unknown') score += 20
  }
  if (voice.default) score += 5

  return score
}

const pickBestVoice = (
  voices: SpeechSynthesisVoice[],
  lang: string,
  preferredGender: 'female' | 'male' | 'neutral',
  preferGoogle: boolean,
  strictLang: boolean
) => {
  if (!voices.length) return null
  const preferredLang = normalizeLang(lang)
  const baseLang = getBaseLang(preferredLang)
  const byLang = voices.filter((voice) => isLanguageMatch(voice.lang || '', preferredLang, baseLang))
  const hasLangPool = byLang.length > 0
  const fallbackPool = hasLangPool && strictLang ? byLang : voices
  const femaleByLang = byLang.filter((voice) => inferVoiceGender(voice) === 'female')
  const nonMaleByLang = byLang.filter((voice) => inferVoiceGender(voice) !== 'male')
  const femaleAll = voices.filter((voice) => inferVoiceGender(voice) === 'female')
  const nonMaleAll = voices.filter((voice) => inferVoiceGender(voice) !== 'male')
  const basePool = hasLangPool ? byLang : voices
  let pool = basePool

  if (preferredGender === 'female') {
    const googleFemaleByLang = femaleByLang.filter((voice) => isGoogleVoice(voice))
    const googleNonMaleByLang = nonMaleByLang.filter((voice) => isGoogleVoice(voice))
    const googleFemaleAll = femaleAll.filter((voice) => isGoogleVoice(voice))
    const googleNonMaleAll = nonMaleAll.filter((voice) => isGoogleVoice(voice))

    if (preferGoogle && googleFemaleByLang.length) {
      pool = googleFemaleByLang
    } else if (femaleByLang.length) {
      pool = femaleByLang
    } else if (preferGoogle && googleNonMaleByLang.length) {
      pool = googleNonMaleByLang
    } else if (nonMaleByLang.length) {
      pool = nonMaleByLang
    } else if (preferGoogle && googleFemaleAll.length && !hasLangPool) {
      pool = googleFemaleAll
    } else if (femaleAll.length && !hasLangPool) {
      pool = femaleAll
    } else if (preferGoogle && googleNonMaleAll.length && !hasLangPool) {
      pool = googleNonMaleAll
    } else if (nonMaleAll.length && !hasLangPool) {
      pool = nonMaleAll
    } else if (femaleAll.length && (!hasLangPool || !strictLang)) {
      pool = femaleAll
    } else if (nonMaleAll.length && (!hasLangPool || !strictLang)) {
      pool = nonMaleAll
    } else if (fallbackPool.length) {
      pool = fallbackPool
    }
  }

  if (preferredGender === 'male') {
    const maleOnly = basePool.filter((voice) => inferVoiceGender(voice) === 'male')
    if (maleOnly.length) {
      pool = maleOnly
    } else {
      const nonFemale = basePool.filter((voice) => inferVoiceGender(voice) !== 'female')
      if (nonFemale.length) pool = nonFemale
    }
  }

  const ranked = [...pool].sort(
    (a, b) =>
      scoreVoice(b, preferredLang, baseLang, preferredGender, preferGoogle) -
      scoreVoice(a, preferredLang, baseLang, preferredGender, preferGoogle)
  )

  return ranked[0] || null
}

export const useTtsQueue = ({
  enabled,
  lang = 'id-ID',
  gapMs = 0,
  preferredGender = 'female',
  preferGoogle = true,
  strictLang = true,
  rate = 0.95,
  pitch = 1.08,
  volume = 1,
}: TtsQueueOptions) => {
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window
  const blocked = ref(false)
  const speaking = ref(false)
  const queue: QueueItem[] = []
  let cachedVoice: SpeechSynthesisVoice | null = null
  let onVoicesChanged: (() => void) | null = null

  const refreshVoices = () => {
    if (!supported) return
    const voices = window.speechSynthesis.getVoices()
    cachedVoice = pickBestVoice(voices, lang, preferredGender, preferGoogle, strictLang)
    if (cachedVoice) {
      // Keep it visible in browser console for easier troubleshooting per device.
      console.info('[TTS] selected voice:', cachedVoice.name, `(${cachedVoice.lang})`)
    }
  }

  const playNext = () => {
    if (!supported || speaking.value || blocked.value || !enabled.value) return
    const nextItem = queue.shift()
    if (!nextItem) return
    const gapAfter = nextItem.gapAfter ?? gapMs
    speak(nextItem.text, gapAfter)
  }

  const speak = (text: string, gapAfter: number) => {
    if (!supported || blocked.value || !enabled.value) return
    try {
      refreshVoices()
      const utter = new SpeechSynthesisUtterance(text)
      if (cachedVoice) utter.voice = cachedVoice
      utter.lang = lang
      utter.rate = clamp(rate, 0.75, 1.15)
      utter.pitch = clamp(pitch, 0.8, 1.4)
      utter.volume = clamp(volume, 0, 1)
      utter.onstart = () => {
        blocked.value = false
      }
      utter.onend = () => {
        speaking.value = false
        if (gapAfter > 0) {
          window.setTimeout(() => playNext(), gapAfter)
        } else {
          playNext()
        }
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

  const enqueue = (text: string, gapAfter?: number) => {
    if (!supported || !enabled.value) return
    queue.push({ text, gapAfter })
    playNext()
  }

  const resume = () => {
    if (!supported) return
    blocked.value = false
    if (window.speechSynthesis.paused) window.speechSynthesis.resume()
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
    onVoicesChanged = () => refreshVoices()
    window.speechSynthesis.addEventListener('voiceschanged', onVoicesChanged)
  }

  watch(enabled, (value) => {
    if (!value) {
      stop()
    } else {
      playNext()
    }
  })

  onUnmounted(() => {
    if (!supported) return
    if (onVoicesChanged) {
      window.speechSynthesis.removeEventListener('voiceschanged', onVoicesChanged)
    }
    stop()
  })

  return {
    enqueue,
    blocked,
    resume,
    stop,
    supported,
  }
}
