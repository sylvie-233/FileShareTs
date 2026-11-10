import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import * as fileService from '../src/services/file.service.js';
import { HttpError } from '../src/utils/http.js';

describe('FileService', () => {
  let uploadDir: string;

  beforeEach(async () => {
    uploadDir = await mkdtemp(join(tmpdir(), 'fileshare-service-'));
    await fileService.initFileService(uploadDir);
  });

  afterEach(async () => {
    await rm(uploadDir, { recursive: true, force: true });
  });

  it('lists an empty directory', async () => {
    await expect(fileService.listFiles()).resolves.toEqual([]);
  });

  it('rejects deleting a nonexistent file with 404', async () => {
    await expect(fileService.deleteFile('nonexistent.txt')).rejects.toMatchObject({
      status: 404,
      message: '文件不存在',
    });
  });

  it('clears all files and reports the count', async () => {
    await writeFile(join(uploadDir, 'test1.txt'), 'test1');
    await writeFile(join(uploadDir, 'test2.txt'), 'test2');

    await expect(fileService.clearAllFiles()).resolves.toBe(2);
    await expect(fileService.listFiles()).resolves.toEqual([]);
  });

  it('saves a stream and refuses duplicate filenames', async () => {
    await expect(fileService.saveFile('hello.txt', Readable.from('hello'))).resolves.toBe(
      'hello.txt',
    );

    const files = await fileService.listFiles();
    expect(files).toHaveLength(1);
    expect(files[0]).toMatchObject({ name: 'hello.txt', size: 5 });
    // mtime 使用 Unix 秒而不是毫秒
    expect(files[0]?.modified).toBeLessThan(Date.now() / 1000 + 60);

    await expect(fileService.saveFile('hello.txt', Readable.from('world'))).rejects.toMatchObject({
      status: 400,
      message: '文件已存在',
    });
  });

  it('strips directory components from uploaded names', () => {
    expect(fileService.safeFilename('../../etc/passwd')).toBe('passwd');
    expect(fileService.safeFilename('C:\\fakepath\\report.pdf')).toBe('report.pdf');
    expect(() => fileService.safeFilename('..')).toThrow(HttpError);
  });
});
