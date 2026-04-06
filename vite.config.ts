import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";
import { fileURLToPath } from "url";

// ES Module 中获取 __dirname 的等效方式
const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, "..");

export default defineConfig({
  plugins: [react()],
  base: "./",
  root: "src/renderer",
  publicDir: "../../public",
  build: {
    outDir: "../../dist/renderer",
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
      "@/renderer": resolve(__dirname, "src/renderer"),
      "@/shared": resolve(__dirname, "src/shared"),
      "@ant-design/icons": resolve(__dirname, "node_modules/@ant-design/icons"),
      "@/components/Settings": resolve(__dirname, "src/renderer/src/components/Settings"),
    },
  },
  server: {
    port: 3000,
    strictPort: true,
    fs: {
      // 允许访问上级目录
      allow: [".."],
    },
  },
  optimizeDeps: {
    // 排除 Electron 相关依赖
    exclude: ["electron"],
  },
});
