const MOJIBAKE_PATTERN = /(?:Ã.|Â.|Ä.|Å.|Æ.|Ð.|á[º»].)/;

export const normalizeDisplayFileName = (fileName = '') => {
    if (!fileName || !MOJIBAKE_PATTERN.test(fileName)) return fileName;

    try {
        const bytes = Uint8Array.from(Array.from(fileName, (char) => char.charCodeAt(0) & 0xff));
        const decodedName = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
        return decodedName || fileName;
    } catch {
        return fileName;
    }
};
