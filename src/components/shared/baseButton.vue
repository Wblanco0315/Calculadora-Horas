
<template>
  <button
    :class="[
      'inline-flex items-center justify-center gap-2 font-medium transition-all duration-200 outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-slate-900 overflow-hidden relative cursor-pointer',
      sizeClasses[size],
      variantClasses[variant],
      { 'opacity-60 cursor-not-allowed': disabled, 'pointer-events-none': loading }
    ]"
    :disabled="disabled || loading"
    @click="onClick"
  >
    <!-- Loading Spinner Overlay -->
    <transition
      enter-active-class="transition-opacity duration-200"
      leave-active-class="transition-opacity duration-200"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <div v-if="loading" class="absolute inset-0 flex items-center justify-center bg-inherit rounded-md z-10">
        <svg class="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </div>
    </transition>

    <!-- Contenido del Botón (Oculto cuando carga si queremos que no se vea doble, o simplemente atenuado) -->
    <div :class="['flex items-center gap-2', { 'opacity-0': loading }]" class="transition-opacity w-full justify-center">
      <slot name="left-icon"></slot>
      <span v-if="$slots.default || label"><slot>{{ label }}</slot></span>
      <slot name="right-icon"></slot>
    </div>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  label?: string
  loading?: boolean
  disabled?: boolean
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'danger-ghost'
  size?: 'sm' | 'md' | 'lg'
}>(), {
  label: '',
  loading: false,
  disabled: false,
  variant: 'primary',
  size: 'md'
})

const emit = defineEmits<{
  (e: 'click', event: MouseEvent): void
}>()

const onClick = (e: MouseEvent) => {
  if (!props.disabled && !props.loading) {
    emit('click', e)
  }
}

// Clases de tamaño
const sizeClasses = {
  sm: 'px-3 py-1.5 text-xs rounded-lg',
  md: 'px-4 py-2 text-sm rounded-xl',
  lg: 'px-6 py-3 text-base rounded-2xl'
}

// Clases de variante (colores uniformes para la app)
const variantClasses = {
  primary: 'bg-primary-600 hover:bg-primary-700 text-white focus:ring-primary-500 shadow-sm shadow-primary-500/20 active:scale-95',
  secondary: 'bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 focus:ring-slate-500 active:scale-95',
  danger: 'bg-rose-500 hover:bg-rose-600 text-white focus:ring-rose-500 shadow-sm shadow-rose-500/20 active:scale-95',
  ghost: 'bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 active:scale-95',
  'danger-ghost': 'bg-white/10 hover:bg-rose-500 text-indigo-100 hover:text-white focus:ring-rose-500 active:scale-95'
}
</script>
