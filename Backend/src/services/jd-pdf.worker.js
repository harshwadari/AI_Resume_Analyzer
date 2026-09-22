const { parentPort, workerData } = require('node:worker_threads');
const pdfParse = require('pdf-parse/lib/pdf-parse');

let pageFailed = false;
// Use a standalone typed array: the bundled parser mishandles pooled Buffer offsets.
pdfParse(Uint8Array.from(workerData), {
    max: 50,
    pagerender: async page => {
        try {
            const content = await page.getTextContent();
            let lastY;
            return content.items.map(item => {
                const separator = lastY === undefined ? '' : lastY === item.transform[5] ? ' ' : '\n';
                lastY = item.transform[5];
                return separator + item.str;
            }).join('');
        } catch (error) { pageFailed = true; throw error; }
    },
}).then(result => parentPort.postMessage(result.numpages > 50 || pageFailed ? { error: true } : { text: result.text }))
    .catch(() => parentPort.postMessage({ error: true }));
