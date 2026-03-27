import { useUserConfig } from "./useUserConfig";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";

export function useSystemNotifications() {
  const { userConfig } = useUserConfig();
  let intervalId: number | null = null;

  async function checkWorkdayEnd() {
    if (!userConfig.value.isConfigured || !userConfig.value.exitTime) return;

    const now = new Date();
    const todayStr = now.toISOString().split("T")[0]; // "YYYY-MM-DD"

    if (userConfig.value.lastNotifiedDate === todayStr) {
      return; // Already notified today
    }

    const currentH = now.getHours();
    const currentM = now.getMinutes();
    const currentTotalMins = currentH * 60 + currentM;

    const [exitH, exitM] = userConfig.value.exitTime.split(":").map(Number);
    let exitTotalMins = exitH * 60 + exitM;

    if (exitTotalMins < currentTotalMins && exitTotalMins < 12 * 60) {
      exitTotalMins += 24 * 60;
    }

    const diffMins = exitTotalMins - currentTotalMins;

    if (diffMins <= 15 && diffMins >= 0) {
      try {
        let permissionGranted = await isPermissionGranted();
        if (!permissionGranted) {
          const permission = await requestPermission();
          permissionGranted = permission === "granted";
        }

        if (permissionGranted) {
          sendNotification({
            title: "Calculadora de Horas",
            body: "¡Atención! Faltan 15 minutos o menos para finalizar tu jornada laboral.",
          });
          userConfig.value.lastNotifiedDate = todayStr;
        }
      } catch (err) {
        console.error("Error sending native notification", err);
      }
    }
  }

  function startNotificationWatcher() {
    if (intervalId === null) {
      intervalId = window.setInterval(checkWorkdayEnd, 60000);
      checkWorkdayEnd(); // run once immediately
    }
  }

  function stopNotificationWatcher() {
    if (intervalId !== null) {
      window.clearInterval(intervalId);
      intervalId = null;
    }
  }

  return { checkWorkdayEnd, startNotificationWatcher, stopNotificationWatcher };
}
