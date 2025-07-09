// import { defineConfig } from 'vite';

// export default defineConfig({
//   define: {
//     'process.env': process.env
//   }
// });

// vite.config.js
import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.config.js';

export default defineConfig({
  plugins: [crx({ manifest })],
});