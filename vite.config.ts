import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base 用相对路径：既能挂在 GitHub Pages 的 /repo/ 子路径下，也能直接丢进任意目录打开
export default defineConfig({
  plugins: [react()],
  base: './',
});
