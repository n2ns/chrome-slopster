import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: '__MSG_extName__',
    description: '__MSG_extDescription__',
    default_locale: 'en',
    permissions: ['storage', 'sidePanel'],
    host_permissions: [
      // Site access lets the background see tab URLs, so a reply target is cleared when the tab navigates.
      'https://www.reddit.com/*',
      'https://reddit.com/*',
      'https://translate.googleapis.com/*',
      'https://api.openai.com/*',
      'https://api.deepseek.com/*',
      'https://generativelanguage.googleapis.com/*',
      'https://api.anthropic.com/*',
    ],
    action: {
      default_title: '__MSG_extName__',
    },
  },
});
