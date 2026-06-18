const sharp = require('sharp');

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_AVATAR_SIZE = 512;
const THUMB_SIZE = 128;

async function processAvatar(buffer, mimetype) {
  if (!buffer || !buffer.length) {
    const err = new Error('Nenhuma imagem foi enviada.');
    err.status = 400;
    throw err;
  }

  if (mimetype && !ALLOWED_MIME_TYPES.has(mimetype)) {
    const err = new Error('Formato de imagem não suportado. Use JPEG, PNG ou WebP.');
    err.status = 400;
    throw err;
  }

  try {
    const image = sharp(buffer, { failOn: 'error' });
    const metadata = await image.metadata();

    if (!metadata.width || !metadata.height) {
      const err = new Error('Arquivo de imagem inválido.');
      err.status = 400;
      throw err;
    }

    const mainBuffer = await sharp(buffer)
      .rotate()
      .resize(MAX_AVATAR_SIZE, MAX_AVATAR_SIZE, { fit: 'cover', position: 'centre' })
      .webp({ quality: 80 })
      .toBuffer();

    const thumbBuffer = await sharp(buffer)
      .rotate()
      .resize(THUMB_SIZE, THUMB_SIZE, { fit: 'cover', position: 'centre' })
      .webp({ quality: 75 })
      .toBuffer();

    const mainMeta = await sharp(mainBuffer).metadata();

    return {
      mainBuffer,
      thumbBuffer,
      largura: mainMeta.width,
      altura: mainMeta.height,
    };
  } catch {
    const err = new Error('Não foi possível processar a imagem enviada.');
    err.status = 400;
    throw err;
  }
}

module.exports = {
  processAvatar,
};
