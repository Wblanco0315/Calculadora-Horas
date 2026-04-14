import { useUserConfig } from "./useUserConfig";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";

export function useSystemNotifications() {
  const { userConfig } = useUserConfig();
  let intervalId: number | null = null;
  let hasPermission = false;

  async function checkPermission() {
    try {
      let granted = await isPermissionGranted();
      if (!granted) {
        const permission = await requestPermission();
        granted = permission === "granted";
      }
      hasPermission = granted;
      return granted;
    } catch (err) {
      return false;
    }
  }

  async function checkWorkdayEnd() {
    if (!userConfig.value.isConfigured || !userConfig.value.exitTime) {
      return;
    }

    if (!hasPermission) {
      const granted = await checkPermission();
      if (!granted) {
        return;
      }
    }

    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

    if (userConfig.value.lastNotifiedDate === todayStr) {
      return;
    }

    const currentH = now.getHours();
    const currentM = now.getMinutes();
    const currentTotalMins = currentH * 60 + currentM;

    const [exitH, exitM] = userConfig.value.exitTime.split(":").map(Number);
    let exitTotalMins = exitH * 60 + exitM;

    // Handle wrap around if exit time is very early (e.g. 1 AM)
    if (exitTotalMins < currentTotalMins && exitTotalMins < 12 * 60) {
      exitTotalMins += 24 * 60;
    }

    const diffMins = exitTotalMins - currentTotalMins;

    if (diffMins <= 15 && diffMins >= 0) {
      sendNotification({
        title: "Calculadora de Horas",
        body: "¡Atención! Faltan 15 minutos o menos para finalizar tu jornada laboral.",
      });
      userConfig.value.lastNotifiedDate = todayStr;
    }
  }

  async function startNotificationWatcher() {
    if (intervalId === null) {
      await checkPermission();
      intervalId = window.setInterval(checkWorkdayEnd, 60000);
      checkWorkdayEnd();
    }
  }

  function stopNotificationWatcher() {
    if (intervalId !== null) {
      window.clearInterval(intervalId);
      intervalId = null;
    }
  }

  return {
    checkWorkdayEnd,
    startNotificationWatcher,
    stopNotificationWatcher,
  };
}
