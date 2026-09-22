import { expect, test, vi } from 'vitest';
import { discoverFolder, uploadFolderBatches } from '../src/features/recruiter/utils/folderFiles';

test('folder discovers 100 PDFs, reports rejected files, and reads only bounded slices', async () => {
  const ranges = [];
  const files = Array.from({ length: 100 }, (_, index) => ({ name: `${index}.pdf`, type: 'application/pdf', size: 20000,
    slice(start, end = 20000) {
      ranges.push(end - start);
      return { arrayBuffer: async () => Uint8Array.from([...start ? 'data %%EOF' : '%PDF-'].map(c => c.charCodeAt(0))).buffer };
    },
  }));
  files.push({ name: 'notes.txt', size: 1 }, { name: 'huge.pdf', size: 6 * 1024 * 1024 },
    { name: 'fake.pdf', size: 4, slice: () => ({ arrayBuffer: async () => new Uint8Array(4).buffer }) });
  const result = await discoverFolder(files);
  expect(result.totalFiles).toBe(103); expect(result.valid).toHaveLength(100); expect(result.rejected).toHaveLength(3);
  expect(Math.max(...ranges)).toBeLessThanOrEqual(1024);
  const calls = [], done = vi.fn();
  await uploadFolderBatches(result.valid, async batch => { calls.push(batch.length); return batch; }, done);
  expect(calls).toEqual(Array(10).fill(10)); expect(done).toHaveBeenCalledTimes(10);
});

test('folder batches stop on failure, retaining progress from confirmed batches only', async () => {
  const upload = vi.fn().mockResolvedValueOnce(['saved']).mockRejectedValueOnce(new Error('network'));
  const done = vi.fn();
  await expect(uploadFolderBatches(Array(100).fill({}), upload, done)).rejects.toThrow('network');
  expect(upload).toHaveBeenCalledTimes(2); expect(done).toHaveBeenCalledTimes(1);
  const controller = new AbortController(); controller.abort();
  await expect(discoverFolder([{}], controller.signal)).rejects.toThrow();
});
