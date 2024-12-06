const esbuild = require('esbuild');

const { NodeModulesPolyfillPlugin } = require("@esbuild-plugins/node-modules-polyfill");
const { NodeGlobalsPolyfillPlugin } = require("@esbuild-plugins/node-globals-polyfill");

const path = require('path');
const fs = require('fs');


function copydynload() {
  const srcDir = path.resolve('./src/dynload');
  const destDir = path.resolve('./lib/dynload');

  if (fs.existsSync(destDir)) {
    fs.rmSync(destDir, { recursive: true });
  }
  fs.mkdirSync(destDir, { recursive: true });

  fs.readdirSync(srcDir).forEach(file => {
    fs.copyFileSync(path.join(srcDir, file), path.join(destDir, file));
  });
}
(async () => {
  try {
    await esbuild
  .build({
    entryPoints: ['./src/index.ts'],
    bundle: true,                   
    outdir: './lib',
    sourcemap: true,                
    minify: true,                  
    loader: {
      '.ts': 'ts',                 
      '.wasm': 'base64',
      '.js': 'js',
      '.json': 'json',
    },
    plugins: [
      NodeModulesPolyfillPlugin(),
      NodeGlobalsPolyfillPlugin({
        buffer: true,
        process: true,
      }),
    ],
  });
  console.log('Build succeeded!');
    copydynload();
} catch (err) {
  console.error('Build failed:', err.message);
}
})();
