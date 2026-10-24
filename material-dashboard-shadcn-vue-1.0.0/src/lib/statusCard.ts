export type StatusCardKey =
  | 'ALL'
  | 'DRAFT'
  | 'PROSES'
  | 'BERJALAN'
  | 'SELESAI'
  | 'BATAL'
  | 'KOSONG'

type StatusTone = {
  card: string
  bubble: string
}

const TONES: Record<StatusCardKey, StatusTone> = {
  ALL: {
    card: 'border-border/70 bg-card/60 text-foreground',
    bubble: 'border-border/70 bg-muted text-foreground'
  },
  DRAFT: {
    card: 'border-border/70 bg-muted/40 text-muted-foreground',
    bubble: 'border-border/70 bg-background text-muted-foreground'
  },
  PROSES: {
    card: 'border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-400/30 dark:bg-blue-500/10 dark:text-blue-100',
    bubble: 'border-blue-300/70 bg-blue-100/80 text-blue-800 dark:border-blue-400/30 dark:bg-blue-500/20 dark:text-blue-100'
  },
  BERJALAN: {
    card: 'border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-400/30 dark:bg-blue-500/10 dark:text-blue-100',
    bubble: 'border-blue-300/70 bg-blue-100/80 text-blue-800 dark:border-blue-400/30 dark:bg-blue-500/20 dark:text-blue-100'
  },
  SELESAI: {
    card: 'border-green-200 bg-green-50 text-green-900 dark:border-green-400/30 dark:bg-green-500/10 dark:text-green-100',
    bubble: 'border-green-300/70 bg-green-100/80 text-green-800 dark:border-green-400/30 dark:bg-green-500/20 dark:text-green-100'
  },
  BATAL: {
    card: 'border-red-200 bg-red-50 text-red-900 dark:border-red-400/30 dark:bg-red-500/10 dark:text-red-100',
    bubble: 'border-red-300/70 bg-red-100/80 text-red-800 dark:border-red-400/30 dark:bg-red-500/20 dark:text-red-100'
  },
  KOSONG: {
    card: 'border-border/70 bg-muted/40 text-muted-foreground',
    bubble: 'border-border/70 bg-background text-muted-foreground'
  }
}

export const statusCardClass = (status: StatusCardKey) => (TONES[status] ?? TONES.ALL).card

export const statusBubbleClass = (status: StatusCardKey) => (TONES[status] ?? TONES.ALL).bubble
