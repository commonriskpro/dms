const STORAGE_KEY = "dealer-ui-theme";

export function getThemeInitScript() {
  return `
  (function() {
    try {
      var key = "${STORAGE_KEY}";
      var stored = localStorage.getItem(key);
      var theme = (stored === "light" || stored === "dark")
        ? stored
        : (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
      var root = document.documentElement;
      root.classList.remove("light", "dark");
      root.classList.add(theme);
      root.setAttribute("data-theme", theme);
      root.style.colorScheme = theme;
    } catch (e) {}
  })();
  `;
}
