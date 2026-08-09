import { copyFile, mkdir, writeFile } from 'node:fs/promises';

const worker = `export default {
  async fetch(request, env) {
    let response = await env.ASSETS.fetch(request);
    const url = new URL(request.url);
    if (response.status === 404 && request.method === 'GET' && !url.pathname.split('/').pop().includes('.')) {
      url.pathname = '/index.html';
      response = await env.ASSETS.fetch(new Request(url, request));
    }
    return response;
  }
};
`;

await mkdir(new URL('../dist/server/', import.meta.url), { recursive: true });
await mkdir(new URL('../dist/.openai/', import.meta.url), { recursive: true });
await writeFile(new URL('../dist/server/index.js', import.meta.url), worker, 'utf8');
await copyFile(new URL('../.openai/hosting.json', import.meta.url), new URL('../dist/.openai/hosting.json', import.meta.url));
