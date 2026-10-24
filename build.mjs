// Build one client plugin into the loader envelope dsh expects:
// window.__ModuleLoader__.load({ id, factory: (require) => { ... } })
import { build } from 'esbuild'
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const pkg = JSON.parse(await readFile(join(here, 'package.json'), 'utf8'))

const result = await build({
  entryPoints: [join(here, 'src/client.jsx')],
  bundle: true,
  write: false,
  format: 'cjs',
  platform: 'browser',
  target: 'es2022',
  jsx: 'automatic',
  external: ['react', 'react/jsx-runtime', '@deepseek-ai/dsh-client-ui-primitives'],
  legalComments: 'none',
})

const code = result.outputFiles[0].text.trimEnd()
const bundle = `window.__ModuleLoader__.load({
	id: ${JSON.stringify(pkg.name)},
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
${code}
		return module.exports;
	}
});
`
await writeFile(join(here, 'client.js'), bundle)
console.log(`built ${pkg.name} -> client.js (${bundle.length} bytes)`)
