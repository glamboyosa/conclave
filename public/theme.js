try {
  document.documentElement.dataset.theme =
    localStorage.getItem("conclave:theme") === "dark" ? "dark" : "light";
} catch {
  document.documentElement.dataset.theme = "light";
}
