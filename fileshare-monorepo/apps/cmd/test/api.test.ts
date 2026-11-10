import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../src/app.js';
import { initFileService } from '../src/services/file.service.js';

const staticDir = resolve(dirname(fileURLToPath(import.meta.url)), '../static');

describe('FileShare API', () => {
  let uploadDir: string;
  let app: ReturnType<typeof createApp>;

  beforeEach(async () => {
    uploadDir = await mkdtemp(join(tmpdir(), 'fileshare-api-'));
    await initFileService(uploadDir);

    app = createApp({ staticDir });
  });

  afterEach(async () => {
    await rm(uploadDir, { recursive: true, force: true });
  });

  it('serves the frontend page', async () => {
    const response = await app.fetch(new Request('http://localhost/'));

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');
    expect(await response.text()).toContain('局域网文件共享');
  });

  it('lists an empty file directory', async () => {
    const response = await app.fetch(new Request('http://localhost/api/v1/files'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ files: [] });
  });

  it('clears all files', async () => {
    const response = await app.fetch(
      new Request('http://localhost/api/v1/files', { method: 'DELETE' }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ status: 'success', count: 0 });
  });

  it('uploads, lists, downloads and deletes a file', async () => {
    const form = new FormData();
    form.append('file', new File(['hello world'], 'hello.txt', { type: 'text/plain' }));

    const uploadResponse = await app.fetch(
      new Request('http://localhost/api/v1/upload', { method: 'POST', body: form }),
    );
    expect(uploadResponse.status).toBe(200);
    await expect(uploadResponse.json()).resolves.toMatchObject({
      filename: 'hello.txt',
      status: 'success',
    });

    const listResponse = await app.fetch(new Request('http://localhost/api/v1/files'));
    const list = (await listResponse.json()) as { files: Array<{ name: string; size: number }> };
    expect(list.files).toHaveLength(1);
    expect(list.files[0]).toMatchObject({ name: 'hello.txt', size: 11 });

    const downloadResponse = await app.fetch(
      new Request('http://localhost/api/v1/download/hello.txt'),
    );
    expect(downloadResponse.status).toBe(200);
    expect(downloadResponse.headers.get('content-disposition')).toContain('attachment');
    await expect(downloadResponse.text()).resolves.toBe('hello world');

    const deleteResponse = await app.fetch(
      new Request('http://localhost/api/v1/files/hello.txt', { method: 'DELETE' }),
    );
    expect(deleteResponse.status).toBe(200);
    await expect(deleteResponse.json()).resolves.toMatchObject({
      status: 'success',
      filename: 'hello.txt',
    });
  });

  it('keeps UTF-8 filenames intact', async () => {
    const form = new FormData();
    form.append('file', new File(['中文内容'], '测试文件.txt'));

    const uploadResponse = await app.fetch(
      new Request('http://localhost/api/v1/upload', { method: 'POST', body: form }),
    );
    expect(uploadResponse.status).toBe(200);
    await expect(uploadResponse.json()).resolves.toMatchObject({
      filename: '测试文件.txt',
      status: 'success',
    });

    const listResponse = await app.fetch(new Request('http://localhost/api/v1/files'));
    const list = (await listResponse.json()) as { files: Array<{ name: string }> };
    expect(list.files.map((file) => file.name)).toEqual(['测试文件.txt']);
  });

  it('rejects duplicate uploads with 400', async () => {
    const form = new FormData();
    form.append('file', new File(['one'], 'same.txt'));

    const first = await app.fetch(
      new Request('http://localhost/api/v1/upload', { method: 'POST', body: form }),
    );
    expect(first.status).toBe(200);

    const duplicateForm = new FormData();
    duplicateForm.append('file', new File(['two'], 'same.txt'));
    const second = await app.fetch(
      new Request('http://localhost/api/v1/upload', { method: 'POST', body: duplicateForm }),
    );

    expect(second.status).toBe(400);
    await expect(second.json()).resolves.toMatchObject({ detail: '文件已存在' });
  });

  it('returns 404 for a missing file', async () => {
    const response = await app.fetch(new Request('http://localhost/api/v1/download/missing.txt'));

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ detail: '文件不存在' });
  });
});
