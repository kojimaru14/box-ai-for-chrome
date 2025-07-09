// manifest.config.js
export default {
  manifest_version: 3,
  name: 'Box AI for Chrome',
  version: '1.0',
  description: 'A Chrome Extension that talks to Box API',
  action: {
    default_popup: 'src/popup.html',
    default_icon: 'icon.png',
  },
  background: {
    service_worker: 'src/background.js',
    type: 'module'
  },
  content_scripts: [
    {
      matches: ['<all_urls>'],
      js: ['src/content.js']
    }
  ],
  permissions: ['storage', 'identity', 'scripting', 'activeTab'],
  host_permissions: ['https://*/*', 'http://*/*']
};