// Service worker: guarda os arquivos do app no aparelho para que ele abra
// mesmo sem internet (os dados vêm do armazenamento do próprio app).
// Chamadas ao servidor (Supabase) nunca passam por aqui: vão direto para a rede.
const CACHE = 'agenda-compartilhada-v1';
const SHELL = new URL('./', self.location).href;

// Na instalação guarda a página e todos os arquivos JavaScript do app
// (lista gerada na publicação em precache.json). Assim o app abre sem internet
// já depois do primeiro acesso, mesmo em telas que ainda não foram abertas.
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await cache.add(SHELL);
      let lista = [];
      try {
        const resposta = await fetch(new URL('precache.json', SHELL), { cache: 'no-cache' });
        if (resposta.ok) lista = await resposta.json();
      } catch {
        // Sem a lista, os arquivos são guardados conforme o app os usa.
      }
      await Promise.allSettled(lista.map((arquivo) => cache.add(new URL(arquivo, SHELL).href)));
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Páginas: tenta a rede (versão mais nova); sem internet, usa a cópia guardada.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok && url.href === SHELL) {
            const copy = response.clone();
            event.waitUntil(caches.open(CACHE).then((cache) => cache.put(SHELL, copy)));
          }
          return response;
        })
        .catch(() => caches.match(SHELL)),
    );
    return;
  }

  // Arquivos do app (nomes mudam a cada versão): cópia guardada primeiro.
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            event.waitUntil(caches.open(CACHE).then((cache) => cache.put(request, copy)));
          }
          return response;
        }),
    ),
  );
});
