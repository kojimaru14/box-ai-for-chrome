// manifest.config.js
export default {
  manifest_version: 3,
  name: 'Box AI for Chrome',
  version: '1.0',
  description: 'A Chrome Extension that talks to Box API',
  action: {
    default_popup: 'src/popup/popup.html',
    default_icon: 'icon.png',
  },
  background: {
    service_worker: 'src/background.js',
    type: 'module'
  },
  options_ui: {
      page:'src/settings/options.html',
      open_in_tab: true
   },
  content_scripts: [
    {
      matches: ['<all_urls>'],
      js: [
        'src/content.js',
        'src/box.js',
      ]
    }
  ],
  web_accessible_resources: [
    {
      resources: ['config.json'],
      matches: ['<all_urls>']
    }
  ],
  permissions: ['storage', 'identity', 'scripting', 'activeTab'],
  host_permissions: ['https://*.zendesk.com/*']
};