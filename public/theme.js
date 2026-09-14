(() => {
  const updateTheme = () => {
    let preference;
    try {
      preference = localStorage.getItem("conclave:theme");
    } catch {
      // Time-based defaults also work when browser storage is unavailable.
    }
    const hour = new Date().getHours();
    const theme = preference === "dark" || preference === "light"
      ? preference
      : hour >= 19 || hour < 7 ? "dark" : "light";
    if (document.documentElement.dataset.theme !== theme) {
      document.documentElement.dataset.theme = theme;
      window.dispatchEvent(new Event("conclave:theme-change"));
    }
    document.querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", theme === "dark" ? "#1b1b1b" : "#ffffff");
  };

  updateTheme();
  window.setInterval(updateTheme, 60_000);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) updateTheme();
  });
  window.addEventListener("storage", updateTheme);
})();
