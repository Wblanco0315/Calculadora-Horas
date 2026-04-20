import { ref, shallowRef } from "vue";
import { check } from "@tauri-apps/plugin-updater";
import { exit } from "@tauri-apps/plugin-process";
import { info, error } from "@tauri-apps/plugin-log";

// Global state para el actualizador para que todos los componentes (App y InitialSetup) compartan la misma instancia reactiva
const isChecking = ref(false);
const updateAvailable = ref(false);
const version = ref("");
const isUpdating = ref(false);
const downloadProgress = ref(0);
const updateInfo = shallowRef<any>(null);

export function useUpdater() {
  async function checkForUpdates(silent: boolean = true) {
    if (isChecking.value) return;
    try {
      isChecking.value = true;
      info("Checking for updates...");
      const update = await check();
      if (update) {
        info(`Update ${update.version} found!`);
        updateAvailable.value = true;
        version.value = update.version;
        updateInfo.value = update;
      } else {
        updateAvailable.value = false;
        if (!silent) {
          info("No update available");
        }
      }
    } catch (e) {
      error(`Failed to check for updates: ${e}`);
    } finally {
      isChecking.value = false;
    }
  }

  async function installUpdate() {
    if (!updateInfo.value) return;
    try {
      downloadProgress.value = 0;
      isUpdating.value = true;
      let downloaded = 0;
      let contentLength = 0;

      await updateInfo.value.downloadAndInstall((event: any) => {
        switch (event.event) {
          case "Started":
            contentLength = event.data?.contentLength || 0;
            downloadProgress.value = 0;
            info(`Started downloading ${contentLength} bytes`);
            break;
          case "Progress":
            downloaded += event.data?.chunkLength || 0;
            if (contentLength > 0) {
              downloadProgress.value = Math.round(
                (downloaded / contentLength) * 100,
              );
            }
            // Evitamos saturar el log si descargamos muy rápido, pero está disponible
            // info(`Downloaded ${downloaded} of ${contentLength}`);
            break;
          case "Finished":
            downloadProgress.value = 100;
            info("Download finished");
            break;
        }
      });

      info("Update installed, closing app to apply changes...");
      await exit(0);
    } catch (e) {
      error(`Failed to install update: ${e}`);
    } finally {
      isUpdating.value = false;
    }
  }

  return {
    isChecking,
    updateAvailable,
    version,
    isUpdating,
    downloadProgress,
    checkForUpdates,
    installUpdate,
  };
}
