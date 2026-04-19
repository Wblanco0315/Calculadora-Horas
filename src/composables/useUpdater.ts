import { ref } from 'vue';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

export function useUpdater() {
  const isChecking = ref(false);
  const updateAvailable = ref(false);
  const version = ref('');
  const isUpdating = ref(false);
  // Guardamos el objeto entero de la actualización para instalarlo después.
  const updateInfo = ref<any>(null);

  /**
   * Revisa si hay una actualización disponible.
   * @param silent si es true, no hace ruido cuando no hay actualizaciones (útil al iniciar)
   */
  async function checkForUpdates(silent: boolean = true) {
    if (isChecking.value) return;
    try {
      isChecking.value = true;
      console.log('Checking for updates...');
      const update = await check();
      if (update) {
        console.log(`Update ${update.version} found!`);
        updateAvailable.value = true;
        version.value = update.version;
        updateInfo.value = update;
      } else {
        updateAvailable.value = false;
        if (!silent) {
          console.log('No update available');
        }
      }
    } catch (e) {
      console.error('Failed to check for updates:', e);
    } finally {
      isChecking.value = false;
    }
  }

  /**
   * Descarga la actualización e instala, luego reinicia la app.
   */
  async function installUpdate() {
    if (!updateInfo.value) return;
    try {
      isUpdating.value = true;
      let downloaded = 0;
      let contentLength = 0;
      
      await updateInfo.value.downloadAndInstall((event: any) => {
        switch (event.event) {
          case 'Started':
            contentLength = event.data?.contentLength || 0;
            console.log(`Started downloading ${contentLength} bytes`);
            break;
          case 'Progress':
            downloaded += event.data?.chunkLength || 0;
            console.log(`Downloaded ${downloaded} of ${contentLength}`);
            break;
          case 'Finished':
            console.log('Download finished');
            break;
        }
      });

      console.log('Update installed, restarting...');
      await relaunch();
    } catch (e) {
      console.error('Failed to install update:', e);
    } finally {
      isUpdating.value = false;
    }
  }

  return {
    isChecking,
    updateAvailable,
    version,
    isUpdating,
    checkForUpdates,
    installUpdate
  };
}
