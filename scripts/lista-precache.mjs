// Lista os arquivos JavaScript do site gerado em <pasta>/precache.json.
// O service worker (app-mobile/public/sw.js) baixa todos eles ao ser instalado,
// para o app abrir sem internet já depois do primeiro acesso, inclusive telas
// que a pessoa ainda não abriu.
//
// Uso: node scripts/lista-precache.mjs app-mobile/dist-site
import { readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const pasta = process.argv[2];
if (!pasta) {
  console.error('Uso: node scripts/lista-precache.mjs <pasta do site>');
  process.exit(1);
}

const arquivos = [];
const percorrer = (dir) => {
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) percorrer(caminho);
    else if (nome.endsWith('.js') && nome !== 'sw.js')
      arquivos.push(relative(pasta, caminho).split(sep).join('/'));
  }
};
percorrer(join(pasta, '_expo'));
arquivos.sort();

writeFileSync(join(pasta, 'precache.json'), JSON.stringify(arquivos) + '\n');
console.log(`precache.json: ${arquivos.length} arquivos`);
