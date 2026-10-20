// Configuração dos testes: substitui módulos nativos por versões de mentira
// (mocks), já que os testes rodam no Node e não num celular.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
