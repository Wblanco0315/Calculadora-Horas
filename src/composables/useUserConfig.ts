import { ref } from "vue";

export interface UserConfig {
  isConfigured: boolean;
  entryTime: string;
  exitTime: string;
  lunchMinutes: number;
  lastNotifiedDate?: string;
}

export const defaultUserConfig: UserConfig = {
  isConfigured: false,
  entryTime: "08:00",
  exitTime: "17:00",
  lunchMinutes: 60,
};

// Global state outside the composable to act as a singleton
const userConfig = ref<UserConfig>({ ...defaultUserConfig });
const maxDailyMinutes = ref<number>(480);

export function useUserConfig() {
  function setMaxDailyMinutes(minutes: number) {
    maxDailyMinutes.value = minutes;
  }

  function updateUserConfig(config: Partial<UserConfig>) {
    userConfig.value = { ...userConfig.value, ...config };

    if (userConfig.value.entryTime && userConfig.value.exitTime) {
      const [entryH, entryM] = userConfig.value.entryTime.split(":").map(Number);
      const [exitH, exitM] = userConfig.value.exitTime.split(":").map(Number);

      let entryTotal = entryH * 60 + entryM;
      let exitTotal = exitH * 60 + exitM;

      let diffMins = exitTotal - entryTotal;
      if (diffMins < 0) {
        diffMins += 24 * 60; // Handle overnight shifts
      }

      diffMins -= userConfig.value.lunchMinutes || 0;
      maxDailyMinutes.value = Math.max(0, diffMins);
    }
  }

  return { userConfig, maxDailyMinutes, setMaxDailyMinutes, updateUserConfig };
}
