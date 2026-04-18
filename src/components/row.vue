<template>
  <div
    class="relative transition-all duration-200 group"
    :class="
      isOpen && !isEditing
        ? 'bg-slate-50 dark:bg-slate-700/20'
        : 'hover:bg-slate-50/50 dark:hover:bg-slate-800/50'
    "
  >
    <!-- ── View Mode ─────────────────────────────────────────── -->
    <div class="flex items-center gap-3 py-3 pl-2">
      <!-- Checkbox (Only for unsynced activities with ticket) -->
      <div
        v-if="
          isSelectionMode && !activity.synced && activity.ticket && hasToken
        "
        class="shrink-0 flex items-center pr-1"
      >
        <button
          @click.stop="
            $emit('update', activity.id, { selected: !activity.selected })
          "
          class="w-4 h-4 rounded flex items-center justify-center transition-colors cursor-pointer border"
          :class="
            activity.selected
              ? 'bg-indigo-500 border-indigo-500 text-white'
              : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 hover:border-indigo-400 dark:hover:border-indigo-500'
          "
        >
          <svg
            v-if="activity.selected"
            class="w-3 h-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="3"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </button>
      </div>

      <!-- Accent bar -->
      <div
        class="shrink-0 w-[3px] h-9 bg-indigo-500 dark:bg-indigo-400"
        :class="{
          'ml-1': !(
            isSelectionMode &&
            !activity.synced &&
            activity.ticket &&
            hasToken
          ),
        }"
      />

      <!-- Body -->
      <div class="grow min-w-0">
        <!-- Status badge -->
        <div
          v-if="activity.ticket && activity.statusName"
          class="flex items-center gap-1 mb-2 bg-slate-50 dark:bg-slate-900 border rounded-lg overflow-hidden transition-colors"
          :class="
            statusUpdateSuccess
              ? 'border-emerald-400/60 dark:border-emerald-500/40'
              : statusUpdateError
                ? 'border-rose-400/60 dark:border-rose-500/40'
                : 'border-slate-200 dark:border-slate-700'
          "
        >
          <!-- Color dot / spinner / result icon -->
          <div class="shrink-0 w-6 flex items-center justify-center ml-1">
            <span
              v-if="isUpdatingStatus"
              class="block w-3 h-3 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"
            />
            <svg
              v-else-if="statusUpdateSuccess"
              class="w-3 h-3 text-emerald-500"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="3"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <svg
              v-else-if="statusUpdateError"
              class="w-3 h-3 text-rose-500"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
            <span
              v-else
              class="w-2 h-2 rounded-full"
              :style="{ backgroundColor: currentStatusColor || '#94a3b8' }"
            />
          </div>

          <select
            v-if="ticketStatuses.length"
            v-model="localStatusId"
            @change.stop="onStatusChange"
            @click.stop
            :disabled="isUpdatingStatus"
            class="flex-1 min-w-0 pr-2 py-1.5 text-[11px] ring-0 focus:ring-0 bg-slate-50 dark:bg-slate-900 dark:text-slate-100 outline-none disabled:opacity-50 cursor-pointer"
          >
            <option v-for="s in ticketStatuses" :key="s.id" :value="s.id">
              {{ s.name }}
            </option>
          </select>
          <span
            v-else
            class="px-2 py-1.5 text-[11px] text-slate-400 dark:text-slate-500 font-medium uppercase tracking-wide"
          >
            {{ activity.statusName }}
          </span>
        </div>
        <div class="flex items-center gap-2 mb-0.5">
          <span
            v-if="activity.ticket"
            class="shrink-0 text-xs font-mono text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-black/30 px-1.5 py-0.5 rounded border border-slate-700/50 dark:border-slate-800"
          >
            #{{ activity.ticket }}
          </span>
          <h3
            class="text-[11px] font-bold uppercase tracking-wider truncate text-indigo-400 dark:text-indigo-400"
            :title="displayTitle"
          >
            {{ displayTitle }}
          </h3>
        </div>
        <div v-if="projectName" class="flex items-center gap-1.5">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="w-3 h-3 text-indigo-400/60 shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
          </svg>
          <span
            class="text-[11px] text-slate-400 dark:text-slate-500 font-medium truncate uppercase tracking-wide"
            >{{ projectName }}</span
          >
        </div>
      </div>

      <!-- Time -->
      <div
        class="flex-shrink-0 flex items-center gap-1.5 font-mono font-bold text-sm text-slate-700 dark:text-slate-200"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="w-3.5 h-3.5 text-slate-400 dark:text-slate-500"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
        <div v-if="timeFormat === 'HH:MM'">
          {{ formatTime(activity.minutes) }}
        </div>
        <div v-else>{{ formatDecimal(activity.minutes) }}h</div>
      </div>

      <!-- Actions always visible -->
      <div class="flex items-center gap-0.5 shrink-0">
        <!-- Copy -->
        <button
          @click="copyTaskName"
          class="cursor-pointer p-1.5 rounded-lg transition-all text-slate-500 dark:text-slate-600 hover:text-slate-300 dark:hover:text-slate-300 hover:bg-white/5"
          :title="isCopied ? '¡Copiado!' : 'Copiar'"
        >
          <svg
            v-if="isCopied"
            xmlns="http://www.w3.org/2000/svg"
            class="w-3.5 h-3.5 text-emerald-400"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <svg
            v-else
            xmlns="http://www.w3.org/2000/svg"
            class="w-3.5 h-3.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
        </button>

        <!-- Edit -->
        <button
          @click="startEdit"
          class="cursor-pointer p-1.5 rounded-lg transition-all text-slate-500 dark:text-slate-600 hover:text-indigo-400 hover:bg-white/5"
          title="Editar"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="w-3.5 h-3.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path
              d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"
            />
          </svg>
        </button>

        <!-- Delete -->
        <button
          @click="$emit('delete', activity.id)"
          class="cursor-pointer p-1.5 rounded-lg transition-all text-slate-500 dark:text-slate-600 hover:text-rose-400 hover:bg-white/5"
          title="Eliminar"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="w-3.5 h-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
        </button>

        <!-- Sync: Synced badge (permanent state) -->
        <template v-if="activity.ticket && hasToken && logTimeEntry">
          <!-- Already synced: show distinct badge -->
          <button
            v-if="activity.synced && !isSyncing && !syncSuccess && !syncError"
            @click="syncTimeEntry"
            title="Sincronizado — click para reenviar"
            class="cursor-pointer flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25 hover:border-emerald-400/50 transition-all duration-200"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="w-3 h-3 shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </button>

          <!-- Not yet synced / transient states: action button -->
          <button
            v-else
            @click="syncTimeEntry"
            :disabled="isSyncing"
            class="cursor-pointer p-1.5 rounded-lg transition-all relative"
            :class="[
              syncSuccess
                ? 'text-emerald-400 hover:bg-white/5'
                : syncError
                  ? 'text-rose-400 hover:bg-white/5'
                  : 'text-slate-500 dark:text-slate-600 hover:text-cyan-400 hover:bg-white/5',
              isSyncing ? 'opacity-50 cursor-not-allowed' : '',
            ]"
            :title="
              syncSuccess
                ? '¡Enviado!'
                : syncError
                  ? 'Error al enviar'
                  : 'Enviar a OpenProject'
            "
          >
            <span
              v-if="isSyncing"
              class="block w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin"
            />
            <svg
              v-else-if="syncSuccess"
              xmlns="http://www.w3.org/2000/svg"
              class="w-3.5 h-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <svg
              v-else-if="syncError"
              xmlns="http://www.w3.org/2000/svg"
              class="w-3.5 h-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
            <!-- Upload to OpenProject icon -->
            <svg
              v-else
              xmlns="http://www.w3.org/2000/svg"
              class="w-3.5 h-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <polyline points="16 16 12 12 8 16" />
              <line x1="12" y1="12" x2="12" y2="21" />
              <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
            </svg>
          </button>
        </template>

        <!-- Chevron toggle -->
        <button
          @click="isOpen = !isOpen"
          class="cursor-pointer p-1.5 rounded-lg transition-all ml-0.5"
          :class="
            isOpen
              ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/30'
              : 'text-slate-500 dark:text-slate-600 hover:text-slate-300 hover:bg-white/5'
          "
        >
          <svg
            v-if="isOpen"
            xmlns="http://www.w3.org/2000/svg"
            class="w-4 h-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M18 15l-6-6-6 6" />
          </svg>
          <svg
            v-else
            xmlns="http://www.w3.org/2000/svg"
            class="w-4 h-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
      </div>
    </div>

    <!-- Expanded panel -->
    <div
      class="overflow-hidden transition-all duration-300 ease-in-out"
      :class="isOpen ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'"
    >
      <div class="px-5 pb-4 pt-1">
        <div
          class="px-3 pt-3 border-t border-slate-200 dark:border-slate-700/50"
        >
          <p
            class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed italic"
          >
            {{ activity.name }}
          </p>
        </div>
      </div>
    </div>

    <!-- ── Edit Modal ──────────────────────────────────────────── -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition duration-150 ease-in"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div
          v-if="isEditing"
          class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-3 pb-3 sm:px-4 sm:pb-0"
          @click.self="cancelEdit"
        >
          <Transition
            enter-active-class="transition duration-200 ease-out"
            enter-from-class="translate-y-4 opacity-0 sm:translate-y-0 sm:scale-95"
            enter-to-class="translate-y-0 opacity-100 sm:scale-100"
            leave-active-class="transition duration-150 ease-in"
            leave-from-class="translate-y-0 opacity-100 sm:scale-100"
            leave-to-class="translate-y-4 opacity-0 sm:translate-y-0 sm:scale-95"
          >
            <div
              v-if="isEditing"
              class="w-full max-w-sm bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden"
            >
              <!-- Header -->
              <div
                class="flex items-center justify-between px-4 pt-4 pb-3 border-b border-slate-100 dark:border-slate-700"
              >
                <div class="flex items-center gap-2">
                  <div
                    class="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-500/20"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      class="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2.5"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <path
                        d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"
                      />
                    </svg>
                  </div>
                  <h3
                    class="text-sm font-semibold text-slate-800 dark:text-slate-100"
                  >
                    Editar Actividad
                  </h3>
                </div>
                <button
                  @click="cancelEdit"
                  class="cursor-pointer p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="w-4 h-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <!-- Form Body -->
              <div class="flex flex-col gap-3 p-4">
                <!-- Row 1: Project + Ticket -->
                <div class="flex items-center gap-2">
                  <!-- Project Selector -->
                  <div class="flex-1 min-w-0">
                    <select
                      v-model="editProjectId"
                      class="w-full px-2 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none dark:text-slate-100"
                    >
                      <option value="">Sin proyecto</option>
                      <option v-for="p in projects" :key="p.id" :value="p.id">
                        {{ p.name }}
                      </option>
                    </select>
                  </div>
                  <!-- Ticket Input -->
                  <div class="relative shrink-0 flex items-center gap-1 w-32">
                    <input
                      type="text"
                      v-model="editTicket"
                      @input="editTicket = editTicket.replace(/\D/g, '')"
                      placeholder="#Ticket"
                      class="flex-1 w-full px-2 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none dark:text-slate-100 placeholder-slate-400"
                    />
                    <button
                      v-if="editTicket"
                      type="button"
                      @click="
                        toggleFavorite(editTicket, displayTitle, editProjectId)
                      "
                      class="p-1.5 text-slate-400 hover:text-yellow-500 transition-colors"
                      :class="{ 'text-yellow-500': isFavorite(editTicket) }"
                      title="Guardar como favorito"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        class="w-4 h-4"
                        :fill="isFavorite(editTicket) ? 'currentColor' : 'none'"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        stroke-width="2"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.175 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                        />
                      </svg>
                    </button>
                  </div>
                </div>

                <!-- Row 2: Time + Date -->
                <div class="flex items-center gap-2">
                  <input
                    type="date"
                    v-model="editDate"
                    required
                    class="w-43 px-2 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none dark:text-slate-100 placeholder-slate-400"
                  />
                  <!-- Time Input -->
                  <div
                    class="flex justify-evenly gap-1 bg-slate-50 dark:bg-[#0f172b] border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500 flex-1 py-0.5"
                  >
                    <div class="flex items-center">
                      <input
                        type="number"
                        v-model="editHours"
                        min="0"
                        step="1"
                        class="w-10 text-xs text-center bg-transparent outline-none dark:text-slate-100 placeholder-slate-400 font-medium"
                        placeholder="0"
                      />
                      <span
                        class="text-[11px] font-bold text-slate-400 dark:text-slate-500 select-none"
                        >h</span
                      >
                    </div>

                    <span
                      class="text-slate-300 dark:text-slate-600 font-bold mx-1"
                      >:</span
                    >

                    <div class="flex items-center">
                      <input
                        type="number"
                        v-model="editMinutes"
                        min="0"
                        max="59"
                        step="1"
                        class="w-10 px-1 text-xs text-center outline-none bg-[#0f172b] dark:text-slate-100 placeholder-slate-400 font-medium"
                        placeholder="0"
                      />
                      <span
                        class="text-[11px] font-bold text-slate-400 dark:text-slate-500 select-none"
                        >m</span
                      >
                    </div>
                  </div>
                </div>

                <!-- Row 3: Description -->
                <div class="flex items-center gap-2">
                  <textarea
                    v-model="editName"
                    placeholder="Descripción de la tarea..."
                    required
                    rows="2"
                    class="flex-1 w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none dark:text-slate-100 placeholder-slate-400 resize-none"
                  ></textarea>
                </div>

                <!-- Row 4: Actions -->
                <div
                  class="flex items-center justify-between gap-2 mt-1 w-full"
                >
                  <div class="flex gap-2 pt-2 w-full">
                    <button
                      @click="saveEdit"
                      :disabled="!isValid"
                      class="cursor-pointer w-full flex-1 px-4 py-2 text-sm font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Guardar Cambios
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </Transition>
        </div>
      </Transition>
    </Teleport>

    <!-- Time Entry Modal -->
    <TimeEntryModal
      :show="showTimeEntryModal"
      :timeEntryActivities="timeEntryActivities ?? []"
      @confirm="onTimeEntryConfirm"
      @cancel="showTimeEntryModal = false"
    />

    <!-- Already synced confirmation modal -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="opacity-0 scale-95"
        enter-to-class="opacity-100 scale-100"
        leave-active-class="transition duration-150 ease-in"
        leave-from-class="opacity-100 scale-100"
        leave-to-class="opacity-0 scale-95"
      >
        <div
          v-if="showResyncModal"
          class="fixed inset-0 z-50 flex items-center justify-center"
          @click.self="showResyncModal = false"
        >
          <div
            class="absolute inset-0 bg-black/50 backdrop-blur-sm"
            @click="showResyncModal = false"
          />
          <div
            class="relative z-10 w-72 bg-slate-900 border border-slate-700/60 rounded-2xl shadow-2xl p-5 flex flex-col gap-4"
          >
            <!-- Icon + title -->
            <div class="flex items-start gap-3">
              <div
                class="shrink-0 w-9 h-9 rounded-full bg-amber-500/15 flex items-center justify-center"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="w-5 h-5 text-amber-400"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path
                    d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
                  />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>
              <div>
                <p class="text-sm font-semibold text-slate-100 leading-snug">
                  Tiempo ya subido
                </p>
                <p class="text-xs text-slate-400 mt-1 leading-relaxed">
                  Este registro ya fue enviado a OpenProject anteriormente.
                  ¿Deseas intentarlo de nuevo?
                </p>
              </div>
            </div>
            <!-- Actions -->
            <div class="flex gap-2 justify-end">
              <button
                @click="showResyncModal = false"
                class="cursor-pointer px-3 py-1.5 text-xs font-medium rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors"
              >
                Cancelar
              </button>
              <button
                @click="confirmResync"
                class="cursor-pointer px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-900 transition-colors"
              >
                Reenviar
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import type {
  Activity,
  Project,
  StatusOption,
  TimeEntryActivity,
} from "../composables/useActivities";
import { useActivities } from "../composables/useActivities";
import TimeEntryModal from "./TimeEntryModal.vue";
import { formatTime, formatDecimal } from "../utils/timeUtils";

const { toggleFavorite, isFavorite, updateWorkPackageStatus } = useActivities();

const props = defineProps<{
  activity: Activity;
  projects?: Project[];
  statuses?: StatusOption[];
  hasToken?: boolean;
  timeEntryActivities?: TimeEntryActivity[];
  logTimeEntry?: (
    activityId: string,
    activityTypeId: string,
  ) => Promise<{ ok: boolean; error?: string }>;
  isSelectionMode?: boolean;
  timeFormat?: string;
}>();

const emit = defineEmits<{
  (e: "delete", id: string): void;
  (e: "update", id: string, updates: Partial<Activity>): void;
}>();

// ── State ──────────────────────────────────────────────────────
const isOpen = ref(false);
const isEditing = ref(false);
const isCopied = ref(false);
const isSyncing = ref(false);
const syncSuccess = ref(false);
const syncError = ref(false);
const showTimeEntryModal = ref(false);
const showResyncModal = ref(false);

const editName = ref("");
const editDate = ref("");
const editHours = ref<number | "">("");
const editMinutes = ref<number | "">("");
const editProjectId = ref("");
const editTicket = ref("");
const localStatusId = ref(props.activity.statusId ?? "");
const isUpdatingStatus = ref(false);
const statusUpdateSuccess = ref(false);
const statusUpdateError = ref(false);

// ── Computed ───────────────────────────────────────────────────
const displayTitle = computed(
  () => props.activity.ticketTitle || props.activity.name,
);

const projectName = computed(() => {
  if (!props.activity.projectId || !props.projects) return "";
  return (
    props.projects.find((p) => p.id === props.activity.projectId)?.name ?? ""
  );
});

const isValid = computed(() => {
  if (!editName.value.trim() || !editDate.value) return false;
  const h = typeof editHours.value === "number" ? editHours.value : 0;
  const m = typeof editMinutes.value === "number" ? editMinutes.value : 0;
  return h > 0 || m > 0;
});

// Statuses specific to this ticket (stored when ticket was fetched),
// falling back to the global list passed from the parent.
const ticketStatuses = computed(
  () => props.activity.availableStatuses ?? props.statuses ?? [],
);

const currentStatusColor = computed(() => {
  const matched = ticketStatuses.value.find(
    (s) => s.id === localStatusId.value,
  );
  return matched?.color ?? props.activity.statusColor ?? "";
});

watch(
  () => props.activity.statusId,
  (val) => {
    localStatusId.value = val ?? "";
  },
);

async function onStatusChange() {
  const found = ticketStatuses.value.find((s) => s.id === localStatusId.value);
  if (!found || isUpdatingStatus.value) return;

  isUpdatingStatus.value = true;
  statusUpdateSuccess.value = false;
  statusUpdateError.value = false;

  const result = await updateWorkPackageStatus(props.activity.id, found.id);

  isUpdatingStatus.value = false;

  if (result.ok) {
    // Persist locally only after confirmed success
    emit("update", props.activity.id, {
      statusId: found.id,
      statusName: found.name,
      statusColor: found.color ?? undefined,
    });
    statusUpdateSuccess.value = true;
    setTimeout(() => {
      statusUpdateSuccess.value = false;
    }, 2000);
  } else {
    // Revert dropdown to previous value
    localStatusId.value = props.activity.statusId ?? "";
    statusUpdateError.value = true;
    setTimeout(() => {
      statusUpdateError.value = false;
    }, 2000);
  }
}

// ── Actions ────────────────────────────────────────────────────
async function copyTaskName() {
  try {
    await navigator.clipboard.writeText(props.activity.name);
    isCopied.value = true;
    setTimeout(() => {
      isCopied.value = false;
    }, 2000);
  } catch (err) {
    console.error("Error al copiar:", err);
  }
}

function syncTimeEntry() {
  if (!props.logTimeEntry || isSyncing.value) return;
  if (props.activity.synced) {
    showResyncModal.value = true;
    return;
  }
  showTimeEntryModal.value = true;
}

function confirmResync() {
  showResyncModal.value = false;
  showTimeEntryModal.value = true;
}

async function onTimeEntryConfirm(activityTypeId: string) {
  showTimeEntryModal.value = false;
  if (!props.logTimeEntry) return;
  isSyncing.value = true;
  syncSuccess.value = false;
  syncError.value = false;
  const result = await props.logTimeEntry(props.activity.id, activityTypeId);
  isSyncing.value = false;
  if (result.ok) {
    syncSuccess.value = true;
    setTimeout(() => {
      syncSuccess.value = false;
    }, 2000);
  } else {
    syncError.value = true;
    setTimeout(() => {
      syncError.value = false;
    }, 2000);
  }
}

function startEdit() {
  editName.value = props.activity.name;

  if (props.activity.date) {
    editDate.value = props.activity.date;
  } else {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    editDate.value = `${yyyy}-${mm}-${dd}`;
  }

  editHours.value = Math.floor(props.activity.minutes / 60);
  editMinutes.value = props.activity.minutes % 60;
  editProjectId.value = props.activity.projectId || "";
  editTicket.value = props.activity.ticket || "";
  isEditing.value = true;
}

function cancelEdit() {
  isEditing.value = false;
  setTimeout(() => {
    editName.value = "";
    editDate.value = "";
    editHours.value = "";
    editMinutes.value = "";
    editProjectId.value = "";
    editTicket.value = "";
  }, 300);
}

function saveEdit() {
  if (!isValid.value) return;
  const h = typeof editHours.value === "number" ? editHours.value : 0;
  const m = typeof editMinutes.value === "number" ? editMinutes.value : 0;
  emit("update", props.activity.id, {
    name: editName.value.trim(),
    date: editDate.value,
    minutes: h * 60 + m,
    projectId: editProjectId.value || undefined,
    ticket: editTicket.value.trim() || undefined,
  });
  isEditing.value = false;
}
</script>
