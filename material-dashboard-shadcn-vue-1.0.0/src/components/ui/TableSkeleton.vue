<script setup lang="ts">
withDefaults(
  defineProps<{
    rows?: number
    columns?: number
  }>(),
  {
    rows: 6,
    columns: 4
  }
)
</script>

<template>
  <tbody aria-hidden="true">
    <tr v-for="row in rows" :key="row" class="border-t border-border/50">
      <td v-for="col in columns" :key="col" class="px-4 py-3">
        <div
          class="h-3.5 animate-pulse rounded-full bg-muted"
          :style="{ width: `${45 + ((row * 7 + col * 13) % 45)}%` }"
        />
      </td>
    </tr>
  </tbody>
</template>
