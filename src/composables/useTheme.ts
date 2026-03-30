import { ref } from "vue";

const THEME_KEY = "calculadora_horas_theme";
const isDark = ref<boolean>(false);

export function useTheme() {
  function toggleDarkMode() {
    isDark.value = !isDark.value;
    if (isDark.value) {
      document.documentElement.classList.add("dark");
      localStorage.setItem(THEME_KEY, "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem(THEME_KEY, "light");
    }
  }

  function initTheme() {
    const storedTheme = localStorage.getItem(THEME_KEY);
    if (
      storedTheme === "dark" ||
      (!storedTheme && window.matchMedia("(prefers-color-scheme: dark)").matches)
    ) {
      isDark.value = true;
      document.documentElement.classList.add("dark");
    } else {
      isDark.value = false;
      document.documentElement.classList.remove("dark");
    }
  }

  return { isDark, toggleDarkMode, initTheme };
}
