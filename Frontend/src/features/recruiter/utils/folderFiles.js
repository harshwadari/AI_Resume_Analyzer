export const PDF_LIMIT = 5 * 1024 * 1024;
const read = blob => typeof blob.arrayBuffer === 'function' ? blob.arrayBuffer() : new Promise((resolve, reject) => {
  const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(new Error('Unreadable file')); reader.readAsArrayBuffer(blob);
});
export async function discoverFolder(files, signal) {
  const valid = [], rejected = [];
  for (const file of files) {
    signal?.throwIfAborted();
    let reason = '';
    if (!/\.pdf$/i.test(file.name) || (file.type && file.type !== 'application/pdf')) reason = 'Not a PDF.';
    else if (file.size > PDF_LIMIT) reason = 'Exceeds 5 MB.';
    else {
      try {
        const header = new Uint8Array(await read(file.slice(0, 5)));
        const tail = new Uint8Array(await read(file.slice(Math.max(0, file.size - 1024))));
        if (String.fromCharCode(...header) !== '%PDF-' || !String.fromCharCode(...tail).includes('%%EOF')) reason = 'Invalid PDF header or end marker.';
      } catch { reason = 'Unreadable file.'; }
    }
    if (reason) rejected.push({ name: file.webkitRelativePath || file.name, reason });
    else valid.push(file);
  }
  signal?.throwIfAborted();
  return { totalFiles: files.length, validPDFs: valid.length, rejected, valid };
}

export async function uploadFolderBatches(files, upload, onBatch, signal) {
  for (let offset = 0; offset < files.length; offset += 10) {
    signal?.throwIfAborted();
    const batch = files.slice(offset, offset + 10);
    const records = await upload(batch);
    signal?.throwIfAborted();
    await onBatch(records, batch.length);
  }
}
