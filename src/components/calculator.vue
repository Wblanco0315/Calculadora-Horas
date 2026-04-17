<template>
  <!-- Full Screen Transparent Wrapper -->
  <div
    class="h-screen w-screen bg-transparent p-0 overflow-hidden flex flex-col"
  >
    <!-- Main Compact Container -->
    <div
      class="w-full h-full bg-slate-50 dark:bg-slate-900 rounded-[12px] md:rounded-[18px] border border-slate-300 dark:border-slate-700/60 overflow-hidden flex flex-col shadow-2xl relative transition-colors duration-300"
    >
      <!-- Loading screen -->
      <transition
        enter-active-class="transition-opacity duration-200"
        leave-active-class="transition-opacity duration-300"
        enter-from-class="opacity-0"
        leave-to-class="opacity-0"
      >
        <div
          v-if="isLoading"
          class="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900 rounded-[12px] md:rounded-[18px]"
        >
          <div
            class="w-8 h-8 border-[3px] border-indigo-500 border-t-transparent rounded-full animate-spin mb-3"
          />
          <span class="text-xs text-slate-400 dark:text-slate-500 font-medium"
            >Cargando...</span
          >
        </div>
      </transition>

      <Titlebar @open-settings="showSetupModal = true" />

      <InitialSetup
        v-if="!userConfig.isConfigured || showSetupModal"
        :user-config="userConfig"
        :is-modal="userConfig.isConfigured"
        @save="
          (config) => {
            updateUserConfig(config);
            showSetupModal = false;
          }
        "
        @close="showSetupModal = false"
      />

      <template v-else>
        <!-- Stats Area -->
        <div
          class="p-4 bg-linear-to-b from-indigo-500 to-indigo-600 dark:from-indigo-900 dark:to-slate-900 text-white shadow-inner shrink-0"
        >
          <div class="flex justify-between items-baseline mb-1">
            <span
              class="text-blue-100 text-xs font-medium uppercase tracking-wider"
              >Total Registrado</span
            >
            <transition name="fade" mode="out-in">
              <span :key="timeFormat" class="text-blue-100/80 text-xs"
                >Meta:
                {{
                  timeFormat === "HH:MM"
                    ? formatTime(maxDailyMinutes)
                    : formatDecimal(maxDailyMinutes) + "h"
                }}</span
              >
            </transition>
          </div>
          <div class="flex justify-between items-end gap-2 mb-1">
            <transition name="pop" mode="out-in">
              <span
                :key="timeFormat"
                class="text-4xl font-bold font-mono tracking-tight flex items-baseline min-w-[120px]"
              >
                {{
                  timeFormat === "HH:MM"
                    ? formatTime(totalMinutes)
                    : formatDecimal(totalMinutes)
                }}<span
                  v-if="timeFormat === 'decimal'"
                  class="text-2xl text-blue-100/80 ml-1 font-medium"
                  >h</span
                >
              </span>
            </transition>
            <BaseButton
              @click="resetActivities"
              variant="danger-ghost"
              size="sm"
              class="mb-1 !px-2 !py-1"
              title="Borrar todas las actividades"
              label="Reiniciar"
            >
              <template #left-icon>
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
              </template>
            </BaseButton>
          </div>
          <div class="flex items-center justify-between gap-3 mb-4 mt-2">
            <div class="flex items-center gap-3">
              <span
                class="text-blue-100/90 text-xs font-medium tracking-wide uppercase"
                >Formato:</span
              >
              <div
                class="flex bg-black/20 p-1 rounded-full relative w-40 items-center"
              >
                <!-- Sliding background -->
                <div
                  class="absolute top-1 bottom-1 w-[calc(50%-4px)] bg-white rounded-full transition-all duration-300 ease-out z-0 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.3)]"
                  :class="
                    timeFormat === 'HH:MM' ? 'left-1' : 'left-[calc(50%+2px)]'
                  "
                ></div>

                <button
                  @click="timeFormat = 'HH:MM'"
                  class="relative z-10 flex-1 py-1 rounded-full text-xs tracking-wider font-bold transition-all duration-300 text-center cursor-pointer"
                  :class="
                    timeFormat === 'HH:MM'
                      ? 'text-indigo-700 dark:text-indigo-900 transform scale-105'
                      : 'text-blue-100/70 hover:text-white'
                  "
                >
                  HH:MM
                </button>
                <button
                  @click="timeFormat = 'decimal'"
                  class="relative z-10 flex-1 py-1 rounded-full text-xs tracking-wider font-bold transition-all duration-300 text-center cursor-pointer"
                  :class="
                    timeFormat === 'decimal'
                      ? 'text-indigo-700 dark:text-indigo-900 transform scale-105'
                      : 'text-blue-100/70 hover:text-white'
                  "
                >
                  DECIMAL
                </button>
              </div>
            </div>
          </div>
          <!-- Progress Mini Bar -->
          <div class="w-full bg-black/20 rounded-full h-1.5 overflow-hidden">
            <div
              class="bg-white rounded-full h-1.5 transition-all duration-500"
              :style="{ width: progressPercentage + '%' }"
            ></div>
          </div>
        </div>

        <!-- Greeting bar -->
        <div
          class="flex items-center justify-between px-4 py-2.5 border-b border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-800/60 shrink-0"
        >
          <div>
            <p
              class="text-[10px] uppercase tracking-widest text-slate-400 dark:text-slate-500 font-semibold"
            >
              Registro del día
            </p>
            <h2
              class="text-sm font-display font-semibold text-slate-700 dark:text-slate-200 leading-tight"
            >
              Hola, {{ currentUserName || "Usuario" }} 👋
            </h2>
          </div>
          <div class="flex gap-2 items-center">
            <div class="relative gap-2 flex items-center">
              <!--Favorite Activities-->
              <BaseButton
                @click="openFavorites"
                variant="ghost"
                size="sm"
                class="scale-105 mr-1 text-slate-700 dark:text-slate-200"
                label="Favoritos"
              >
                <template #left-icon>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="w-5 h-5 text-yellow-500"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    stroke="none"
                  >
                    <path
                      d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.175 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                    />
                  </svg>
                </template>
              </BaseButton>

              <!--Add Activity-->
              <BaseButton
                @click="openAdd"
                variant="primary"
                size="sm"
                class="scale-105 mr-1"
                label="Añadir"
              >
                <template #left-icon>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="w-3.5 h-3.5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </template>
              </BaseButton>
            </div>
          </div>
        </div>

        <!-- Add activity modal -->
        <HoursForm
          :show="showAddModal"
          :initial-view="addModalInitialView"
          :projects="projects"
          :addProject="addProject"
          :hasProjectToken="!!userConfig.openProjectToken"
          :fetchTicketSubject="fetchTicketSubject"
          @add="addActivity"
          @close="showAddModal = false"
        />

        <!-- Activity list Filter-->
        <div
          class="px-4 py-2 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700/60 flex flex-col gap-2 shrink-0 transition-all duration-300"
        >
          <div class="flex items-center justify-between gap-3">
            <div class="relative flex-1 min-w-0">
              <input
                type="text"
                v-model="searchQuery"
                placeholder="Filtrar por ticket o descripción..."
                class="w-full pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none dark:text-slate-100 placeholder-slate-400"
              />
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>

            <button
              @click="showFilters = !showFilters"
              class="cursor-pointer p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
              :class="{
                'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-200':
                  showFilters,
              }"
              title="Filtros avanzados"
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
                <polygon
                  points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"
                ></polygon>
              </svg>
            </button>

            <!-- Sync Controls -->
            <div
              v-if="
                unsyncedActivities.length > 0 && userConfig.openProjectToken
              "
              class="flex flex-col gap-2"
            >
              <span
                class="text-xs font-semibold text-slate-500 dark:text-slate-400"
                >Subir a OpenProject</span
              >
              <div v-if="!isSelectionMode" class="flex gap-2">
                <!-- Sync All Icon Button -->
                <button
                  @click="syncAll"
                  :disabled="isSyncingAll"
                  class="cursor-pointer p-1.5 rounded-lg transition-all shrink-0 border flex items-center gap-1"
                  :class="[
                    syncSuccessAll
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-500 dark:bg-emerald-500/10 dark:border-emerald-500/30 dark:text-emerald-400'
                      : syncErrorAll
                        ? 'bg-rose-50 border-rose-200 text-rose-500 dark:bg-rose-500/10 dark:border-rose-500/30 dark:text-rose-400'
                        : 'bg-white border-slate-200 text-slate-500 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400 hover:text-indigo-500 dark:hover:text-indigo-400',
                    isSyncingAll ? 'opacity-50 cursor-not-allowed' : '',
                  ]"
                  :title="'Sincronizar todos pendientes'"
                >
                  <span
                    v-if="isSyncingAll"
                    class="block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"
                  />
                  <svg
                    v-else-if="syncSuccessAll"
                    xmlns="http://www.w3.org/2000/svg"
                    class="w-4 h-4"
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
                    v-else-if="syncErrorAll"
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
                  <svg
                    v-else
                    xmlns="http://www.w3.org/2000/svg"
                    class="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <polyline points="16 16 12 12 8 16" />
                    <line x1="12" y1="12" x2="12" y2="21" />
                    <path
                      d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"
                    />
                  </svg>

                  <span
                    v-if="!isSyncingAll && !syncSuccessAll && !syncErrorAll"
                    class="text-xs font-semibold text-slate-500 dark:text-slate-300"
                    >Todos</span
                  >
                </button>

                <!-- Seleccionar Mode Button -->
                <button
                  @click="isSelectionMode = true"
                  class="flex items-center gap-1 shrink-0 cursor-pointer px-2 py-1 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition"
                  title="Modo selección múltiple"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="w-4 h-4"
                    viewBox="0 0 24 24"
                  >
                    <g fill="none">
                      <path
                        fill="currentColor"
                        fill-opacity=".16"
                        d="m11 11l10 4.4l-4.437 1.163L15.4 21z"
                      />
                      <path
                        stroke="currentColor"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-miterlimit="10"
                        stroke-width="1.5"
                        d="M12 2v3m-6.995 6.995h-3m2.926-7.063l2.12 2.122m12.022-2.129L16.95 7.047m-9.9 9.9l-2.12 2.12M11 11l10 4.4l-4.437 1.163L15.4 21z"
                      />
                    </g>
                  </svg>
                  Seleccionar
                </button>
              </div>

              <!-- Selection Mode Active -->
              <div v-else class="flex gap-2">
                <button
                  @click="cancelSelection"
                  class="cursor-pointer shrink-0 px-2.5 py-1 text-xs font-semibold rounded-lg bg-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-300 transition"
                >
                  Cancelar
                </button>
                <button
                  @click="syncAll"
                  :disabled="
                    manuallySelectedActivities.length === 0 || isSyncingAll
                  "
                  class="cursor-pointer shrink-0 flex items-center justify-center gap-1.5 px-3 py-1 text-xs font-bold rounded-lg transition-colors border"
                  :class="[
                    manuallySelectedActivities.length === 0
                      ? 'bg-slate-100 border-slate-200 text-slate-400 dark:bg-slate-800/50 dark:border-slate-700 dark:text-slate-500 cursor-not-allowed'
                      : syncSuccessAll
                        ? 'bg-emerald-500 border-emerald-600 text-white dark:bg-emerald-500 dark:border-emerald-500'
                        : syncErrorAll
                          ? 'bg-rose-500 border-rose-600 text-white dark:bg-rose-500 dark:border-rose-500'
                          : 'bg-indigo-600 border-indigo-700 text-white hover:bg-indigo-700 dark:bg-indigo-500 dark:border-indigo-500 dark:hover:bg-indigo-400',
                    isSyncingAll ? 'opacity-50 cursor-wait' : '',
                  ]"
                >
                  <span
                    v-if="isSyncingAll"
                    class="block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"
                  />
                  <svg
                    v-else-if="syncSuccessAll"
                    xmlns="http://www.w3.org/2000/svg"
                    class="w-3.5 h-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    stroke-width="3"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <svg
                    v-else-if="syncErrorAll"
                    xmlns="http://www.w3.org/2000/svg"
                    class="w-3.5 h-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                  <span
                    >Enviar
                    {{
                      manuallySelectedActivities.length
                        ? manuallySelectedActivities.length
                        : ""
                    }}</span
                  >
                </button>
              </div>
            </div>
          </div>

          <!-- Extended Filters -->
          <div
            v-show="showFilters"
            class="flex gap-2 items-center flex-wrap mt-1"
          >
            <select
              v-model="filterProject"
              class="px-2 py-1.5 text-[11px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none dark:text-slate-100 min-w-[70px] flex-1"
            >
              <option value="">Proyectos (Todos)</option>
              <option v-for="p in projects" :key="p.id" :value="p.id">
                {{ p.name }}
              </option>
            </select>

            <select
              v-model="sortBy"
              class="px-2 py-1.5 text-[11px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none dark:text-slate-100 min-w-[70px] flex-1"
            >
              <option value="none">Orden (Por defecto)</option>
              <option value="time-desc">Horas (Mayor a menor)</option>
              <option value="time-asc">Horas (Menor a mayor)</option>
            </select>

            <select
              v-model="filterStatus"
              class="px-2 py-1.5 text-[11px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none dark:text-slate-100 min-w-[70px] flex-1"
            >
              <option value="all">Estado (Todos)</option>
              <option value="synced">Sincronizados</option>
              <option value="unsynced">Pendientes</option>
            </select>

            <button
              v-if="
                filterProject ||
                sortBy !== 'none' ||
                filterStatus !== 'all' ||
                searchQuery
              "
              @click="clearFilters"
              class="cursor-pointer px-2 py-1.5 text-[11px] font-medium text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded transition-colors shrink-0"
            >
              Limpiar
            </button>
          </div>
        </div>

        <!-- Scrollable Activity List -->
        <div
          class="flex-1 overflow-y-auto w-full bg-slate-50 dark:bg-slate-900/50"
        >
          <div
            v-if="filteredActivities.length === 0"
            class="flex flex-col items-center justify-center h-full gap-3 select-none"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-10 w-10 text-slate-700 dark:text-slate-700"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <circle cx="12" cy="12" r="10" stroke-width="1.5" />
              <polyline
                points="12 6 12 12 16 14"
                stroke-width="1.5"
                stroke-linecap="round"
              />
            </svg>
            <p
              class="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-600 text-center"
            >
              No hay más registros<br />por hoy
            </p>
          </div>

          <TransitionGroup
            name="list"
            tag="div"
            class="bg-white dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 divide-y divide-slate-100 dark:divide-slate-700/60 shadow-sm relative overflow-hidden"
          >
            <Row
              v-for="act in filteredActivities"
              :key="act.id"
              :activity="act"
              :projects="projects"
              :statuses="statuses"
              :log-time-entry="logTimeEntry"
              :has-token="!!userConfig.openProjectToken"
              :is-selection-mode="isSelectionMode"
              :timeFormat="timeFormat"
              @update="editActivity"
              @delete="removeActivity"
            />
          </TransitionGroup>
        </div>

        <!-- Bottom navigation -->
        <nav
          class="shrink-0 flex items-center justify-around px-4 py-2 border-t border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-900"
        >
          <!-- Calculator (active) -->
          <button
            class="cursor-pointer flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-xl text-slate-900 dark:text-white"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="w-5 h-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
          </button>

          <!-- History (inactive) -->
          <button
            class="cursor-not-allowed flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-xl text-slate-400 dark:text-slate-600 opacity-40"
            disabled
            title="Próximamente"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="w-5 h-5"
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
          </button>

          <!-- Settings -->
          <button
            @click="showSetupModal = true"
            class="cursor-pointer flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-xl text-slate-400 dark:text-slate-600 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="w-5 h-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <circle cx="12" cy="12" r="3" />
              <path
                d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
              />
            </svg>
          </button>
        </nav>
      </template>

      <!-- Custom Confirm Modal -->
      <ConfirmModal
        :show="showConfirmReset"
        title="Reiniciar Actividades"
        message="¿Seguro que deseas reiniciar el registro? Esta acción no se puede deshacer."
        confirmText="Sí, borrar"
        cancelText="Cancelar"
        @confirm="confirmReset"
        @cancel="showConfirmReset = false"
      />

      <!-- Sync All Modal -->
      <TimeEntryModal
        v-if="showSyncAllModal"
        :show="showSyncAllModal"
        :timeEntryActivities="timeEntryActivities ?? []"
        @confirm="onSyncAllConfirm"
        @cancel="showSyncAllModal = false"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useActivities } from "../composables/useActivities";
import { useUserConfig } from "../composables/useUserConfig";
import { useAppStorage } from "../composables/useAppStorage";
import { useTheme } from "../composables/useTheme";
import { useSystemNotifications } from "../composables/useSystemNotifications";
import HoursForm from "./hoursForm.vue";
import Row from "./row.vue";
import Titlebar from "./Titlebar.vue";
import ConfirmModal from "./confirmModal.vue";
import InitialSetup from "./InitialSetup.vue";
import BaseButton from "./shared/baseButton.vue";
import TimeEntryModal from "./TimeEntryModal.vue";
import { formatDecimal, formatTime } from "../utils/timeUtils";
import { computed } from "vue";

const showConfirmReset = ref(false);
const showSetupModal = ref(false);
const showAddModal = ref(false);
const addModalInitialView = ref<"form" | "favorites">("form");
const isLoading = ref(true);

const {
  activities,
  projects,
  statuses,
  totalMinutes,
  progressPercentage,
  addActivity,
  editActivity,
  addProject,
  removeActivity,
  fetchTicketSubject,
  logTimeEntry,
  currentUserName,
  timeEntryActivities,
  fetchTimeEntryActivities,
  fetchCurrentUser,
  fetchStatuses,
} = useActivities();

const { maxDailyMinutes, userConfig, updateUserConfig } = useUserConfig();

const { initStorage } = useAppStorage();
const { initTheme } = useTheme();
const { startNotificationWatcher } = useSystemNotifications();

const timeFormat = ref("HH:MM");

initStorage();
initTheme();
startNotificationWatcher();

onMounted(async () => {
  await Promise.all([fetchTimeEntryActivities(), fetchCurrentUser(), fetchStatuses()]);
  isLoading.value = false;
});

function resetActivities() {
  showConfirmReset.value = true;
}

function openAdd() {
  addModalInitialView.value = "form";
  showAddModal.value = true;
}

function openFavorites() {
  addModalInitialView.value = "favorites";
  showAddModal.value = true;
}

function confirmReset() {
  activities.value = [];
  showConfirmReset.value = false;
}

const searchQuery = ref("");
const showFilters = ref(false);
const filterProject = ref("");
const filterStatus = ref<"all" | "synced" | "unsynced">("all");
const sortBy = ref<"none" | "time-desc" | "time-asc">("none");

function clearFilters() {
  searchQuery.value = "";
  filterProject.value = "";
  filterStatus.value = "all";
  sortBy.value = "none";
}

const filteredActivities = computed(() => {
  let result = [...activities.value];

  // 1. Text Search
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase();
    result = result.filter((a) => {
      return (
        a.name.toLowerCase().includes(q) ||
        (a.ticket && a.ticket.toLowerCase().includes(q))
      );
    });
  }

  // 2. Project Filter
  if (filterProject.value) {
    result = result.filter((a) => a.projectId === filterProject.value);
  }

  // 3. Status Filter
  if (filterStatus.value === "synced") {
    result = result.filter((a) => a.synced);
  } else if (filterStatus.value === "unsynced") {
    result = result.filter((a) => !a.synced);
  }

  // 4. Sorting
  if (sortBy.value === "time-desc") {
    result.sort((a, b) => b.minutes - a.minutes);
  } else if (sortBy.value === "time-asc") {
    result.sort((a, b) => a.minutes - b.minutes);
  }

  return result;
});

const unsyncedActivities = computed(() => {
  return activities.value.filter((a) => a.ticket && !a.synced);
});

const manuallySelectedActivities = computed(() => {
  return unsyncedActivities.value.filter((a) => a.selected);
});

const isSelectionMode = ref(false);

function cancelSelection() {
  isSelectionMode.value = false;
  unsyncedActivities.value.forEach((act) => {
    editActivity(act.id, { selected: false });
  });
}

const showSyncAllModal = ref(false);
const isSyncingAll = ref(false);
const syncSuccessAll = ref(false);
const syncErrorAll = ref(false);

function syncAll() {
  showSyncAllModal.value = true;
}

async function onSyncAllConfirm(activityTypeId: string) {
  showSyncAllModal.value = false;
  isSyncingAll.value = true;
  syncSuccessAll.value = false;
  syncErrorAll.value = false;

  const allUnsynced = [...unsyncedActivities.value];
  const toSync =
    manuallySelectedActivities.value.length > 0
      ? [...manuallySelectedActivities.value]
      : allUnsynced;

  let allOk = true;

  for (const act of toSync) {
    const res = await logTimeEntry(act.id, activityTypeId);
    if (res.ok) {
      if (act.selected) {
        editActivity(act.id, { selected: false });
      }
    } else {
      allOk = false;
    }
  }

  isSyncingAll.value = false;

  if (toSync.length > 0) {
    if (allOk) {
      syncSuccessAll.value = true;
      setTimeout(() => {
        syncSuccessAll.value = false;
        if (isSelectionMode.value) cancelSelection();
      }, 2000);
    } else {
      syncErrorAll.value = true;
      setTimeout(() => {
        syncErrorAll.value = false;
      }, 2000);
    }
  }
}
</script>

<style scoped>
.list-enter-active,
.list-leave-active {
  transition: all 0.3s ease;
}
.list-enter-from {
  opacity: 0;
  transform: scale(0.9) translateY(10px);
}
.list-leave-to {
  opacity: 0;
  transform: scale(0.9) translateX(20px);
}
.list-leave-active {
  position: absolute;
  width: 100%;
}

.fade-enter-active,
.fade-leave-active {
  transition:
    opacity 0.15s ease-out,
    transform 0.15s ease-out;
}
.fade-enter-from {
  opacity: 0;
  transform: translateY(-5px);
}
.fade-leave-to {
  opacity: 0;
  transform: translateY(5px);
}

.pop-enter-active,
.pop-leave-active {
  transition: all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}
.pop-enter-from {
  opacity: 0;
  transform: scale(0.9) translateY(10px);
}
.pop-leave-to {
  opacity: 0;
  transform: scale(0.9) translateY(-10px);
}
</style>
