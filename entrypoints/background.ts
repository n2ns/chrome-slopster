export default defineBackground(() => {
  // Clicking the toolbar icon opens the side panel instead of a popup.
  browser.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error: unknown) => console.error('Failed to set side panel behavior.', error));
});
