// Runs before the side panel's first paint (a blocking script in <head>): apply the
// theme remembered from the last open (written by src/ui/theme.ts), so a chosen theme
// does not flash the browser's scheme while the settings load.
try {
  var theme = localStorage.getItem('theme');
  if (theme === 'auto' || theme === 'light' || theme === 'dark') document.documentElement.dataset.theme = theme;
} catch {
  // Without storage the panel follows the browser until the settings load.
}
