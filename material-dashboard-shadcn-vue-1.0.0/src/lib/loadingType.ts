export const LOADING_TYPE_OPTIONS = [
  { value: 'PALETIZE', label: 'Paletize' },
  { value: 'COMBINE', label: 'Combine' },
  { value: 'LOOSE', label: 'Loose (Curah)' },
]

export const LOADING_TYPE_LABELS: Record<string, string> = {
  PALETIZE: 'Paletize',
  COMBINE: 'Combine',
  LOOSE: 'Loose (Curah)',
  SYSTEM: 'Sistem',
}

export function formatLoadingTypeLabel(value?: string | null): string {
  if (!value) return '-'
  return LOADING_TYPE_LABELS[value] || value
}
