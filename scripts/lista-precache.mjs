// Lista os arquivos do site gerado em <pasta>/precache.json: JavaScript, fontes,
// logo e ícones.
// O service worker (app-mobile/public/sw.js) baixa todos eles ao ser instalado,
// para o app abrir sem internet já depois do primeiro acesso, inclusive telas
// que a pessoa ainda não abriu.
//
// Uso: node scripts/lista-precache.mjs app-mobile/dist-site
import { existsSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const pasta = process.argv[2];
if (!pasta) {
  console.error('Uso: node scripts/lista-precache.mjs <pasta do site>');
  process.exit(1);
}

const arquivos = [];
const percorrer = (dir, aceitar) => {
  if (!existsSync(dir)) return;
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) percorrer(caminho, aceitar);
    else if (aceitar(nome)) arquivos.push(relative(pasta, caminho).split(sep).join('/'));
  }
};
percorrer(join(pasta, '_expo'), (nome) => nome.endsWith('.js'));
// Fontes da marca e imagens do logo (sem elas o app abre sem a identidade offline).
percorrer(join(pasta, 'assets', 'assets'), (nome) => /\.(ttf|otf|png)$/.test(nome));
percorrer(join(pasta, 'icons'), (nome) => nome.endsWith('.png'));
arquivos.sort();

writeFileSync(join(pasta, 'precache.json'), JSON.stringify(arquivos) + '\n');
console.log(`precache.json: ${arquivos.length} arquivos`);
