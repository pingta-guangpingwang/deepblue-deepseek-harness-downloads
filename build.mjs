import {build} from 'esbuild';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
const catalog = JSON.parse(await fs.readFile('catalog.json', 'utf8'));
const entries = {'character-knowledge':'plugins/character-knowledge/index.ts','qq-channel':'src/main/character-qq-plugin-entry.ts'};
const built = new Set();
await fs.mkdir('rebuilt', {recursive:true});
for (const release of catalog) {
  const filename = release.id + '-' + release.version + '.cjs';
  let bytes;
  if (!built.has(release.id)) {
    const result = await build({absWorkingDir:process.cwd()+'/sources',entryPoints:[entries[release.id]],bundle:true,platform:'node',format:'cjs',target:'node24',write:false,legalComments:'eof'});
    bytes = Buffer.from(result.outputFiles[0].contents);
    built.add(release.id);
  } else {
    // Historical artifacts remain exact published bytes; current sources are not their source revision.
    bytes = await fs.readFile('packages/' + filename);
  }
  if (bytes.length !== release.bytes || createHash('sha256').update(bytes).digest('hex') !== release.sha256) throw Error('Rebuild differs from catalog: ' + filename);
  await fs.writeFile('rebuilt/' + filename, bytes);
}
