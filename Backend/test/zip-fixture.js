const zlib = require('node:zlib');
const crc32 = zlib.crc32 || require('yauzl/crc32');
module.exports = entries => {
    const local = [], central = []; let offset = 0;
    for (const entry of entries) {
        const name = Buffer.from(entry.name), data = entry.data || Buffer.alloc(0);
        let compressed = entry.deflate ? zlib.deflateRawSync(data) : data;
        // Traditional ZIP encryption carries a 12-byte header even for stored entries.
        if (entry.flags & 1) compressed = Buffer.concat([Buffer.alloc(12), compressed]);
        const checksum = entry.badCrc ? 0 : crc32(data);
        const header = Buffer.alloc(30);
        header.writeUInt32LE(0x04034b50); header.writeUInt16LE(20, 4); header.writeUInt16LE(entry.flags || 0, 6);
        header.writeUInt16LE(entry.deflate ? 8 : 0, 8); header.writeUInt32LE(checksum, 14);
        header.writeUInt32LE(compressed.length, 18); header.writeUInt32LE(data.length, 22); header.writeUInt16LE(name.length, 26);
        local.push(header, name, compressed);
        const record = Buffer.alloc(46); record.writeUInt32LE(0x02014b50); record.writeUInt16LE(0x0314, 4); record.writeUInt16LE(20, 6);
        record.writeUInt16LE(entry.flags || 0, 8); record.writeUInt16LE(entry.deflate ? 8 : 0, 10); record.writeUInt32LE(checksum, 16);
        record.writeUInt32LE(compressed.length, 20); record.writeUInt32LE(data.length, 24); record.writeUInt16LE(name.length, 28);
        record.writeUInt32LE(entry.attributes || 0, 38); record.writeUInt32LE(offset, 42);
        central.push(record, name); offset += header.length + name.length + compressed.length;
    }
    const directory = Buffer.concat(central), end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
    end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
    return Buffer.concat([...local, directory, end]);
};
