import { defineConfig } from '@hey-api/openapi-ts';

// Генерация клиентского SDK из OpenAPI-спецификации:
// контракт (TypeSpec) -> api/openapi/openapi.yaml -> frontend/src/sdk
export default defineConfig({
  input: '../api/openapi/openapi.yaml',
  output: 'src/sdk',
  plugins: ['@hey-api/typescript', '@hey-api/sdk', '@hey-api/client-fetch'],
});
