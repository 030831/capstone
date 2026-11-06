import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * file:// 로 dist/index.html 을 열어도 동작하도록 한다.
 * Chrome 은 file:// 에서 type="module" 스크립트와 crossorigin 속성이 붙은 리소스를 CORS 로 막는다.
 * 그래서 번들을 IIFE 단일 파일로 내보내고, 빌드된 HTML 에서 module/crossorigin 을 제거한 뒤
 * 스크립트를 body 끝으로 옮긴다.
 */
function fileProtocolFriendly(): Plugin {
  return {
    name: 'file-protocol-friendly',
    apply: 'build',
    enforce: 'post',
    transformIndexHtml(html) {
      let script = '';
      const stripped = html
        .replace(/<script type="module"[^>]*><\/script>/g, (m) => {
          script = m.replace(' type="module"', '').replace(' crossorigin', '');
          return '';
        })
        .replace(/ crossorigin/g, '');
      return stripped.replace('</body>', `${script}\n  </body>`);
    },
  };
}

// base './' : 상대 경로 자산.
export default defineConfig({
  base: './',
  plugins: [react(), fileProtocolFriendly()],
  build: {
    target: 'es2020',
    cssCodeSplit: false,
    rollupOptions: { output: { format: 'iife', inlineDynamicImports: true } },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
