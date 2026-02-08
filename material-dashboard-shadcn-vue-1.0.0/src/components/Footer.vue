<script setup lang="ts">
import { Heart } from 'lucide-vue-next'
</script>

<template>
  <footer class="bg-card border-t py-6 px-4 md:px-8">
    <div class="flex flex-col md:flex-row items-center justify-between gap-4">
      <div class="flex items-center gap-1 text-sm text-muted-foreground">
        <span>© 2026, copyright</span>
        <span>by</span>
        <a 
          href="https://sankyuidn.co.id"
          target="blank" 
          class="text-primary hover:underline"
        >
          Sankyu Indonesia
        </a>
        <span> • Distributed by</span>
        <a 
          href="https://themewagon.com"
          target="_blank" 
          rel="noopener noreferrer"
          class="text-primary hover:underline"
        >
          ThemeWagon
        </a>
      </div>

      <div class="flex items-center gap-6 text-sm">
        <a 
          href="#!" 
          rel="noopener noreferrer"
          class="text-muted-foreground hover:text-primary transition-colors"
        >
          Creative Tim
        </a>
        <a 
          href="#!" 
          rel="noopener noreferrer"
          class="text-muted-foreground hover:text-primary transition-colors"
        >
          About Us
        </a>
        <a 
          href="#!" 
          rel="noopener noreferrer"
          class="text-muted-foreground hover:text-primary transition-colors"
        >
          Blog
        </a>
        <a 
          href="#!" 
          rel="noopener noreferrer"
          class="text-muted-foreground hover:text-primary transition-colors"
        >
          License
        </a>
      </div>
    </div>
  </footer>
</template>
