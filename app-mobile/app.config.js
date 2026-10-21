// Configuração dinâmica: usa o app.json como está e, só ao gerar o site,
// define a subpasta onde ele será publicado (ex.: GitHub Pages em /nome-do-repositorio).
// Uso: SITE_BASE_PATH=/app-teste-agenda npx expo export --platform web
module.exports = ({ config }) => {
  const base = process.env.SITE_BASE_PATH;
  if (!base) return config;
  return { ...config, experiments: { ...config.experiments, baseUrl: base } };
};
