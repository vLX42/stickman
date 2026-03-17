import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["components/StickMan.tsx"],
  format: ["esm", "cjs"],
  dts: false,
  external: ["react", "react-dom", "framer-motion"],
  clean: true,
  sourcemap: true,
  outDir: "dist",
});
