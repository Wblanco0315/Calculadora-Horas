import { createApp } from "vue";
import App from "./App.vue";
import { attachConsole } from "@tauri-apps/plugin-log";

attachConsole().catch(console.error);

createApp(App).mount("#app");
