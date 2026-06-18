const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

const UPLOADS_ROOT = path.join(__dirname, '../../uploads');
const AVATARS_DIR = path.join(UPLOADS_ROOT, 'avatars');

function ensureUploadDirs() {
  fs.mkdirSync(AVATARS_DIR, { recursive: true });
}

function getAvatarDir(userId) {
  return path.join(AVATARS_DIR, String(userId));
}

function buildPublicPath(userId, filename) {
  return `/uploads/avatars/${userId}/${filename}`;
}

function getAbsolutePathFromPublic(caminho) {
  const relative = caminho.replace(/^\/uploads\//, '');
  return path.join(UPLOADS_ROOT, relative);
}

async function saveAvatarFiles(userId, mainBuffer, thumbBuffer) {
  ensureUploadDirs();
  const userDir = getAvatarDir(userId);
  fs.mkdirSync(userDir, { recursive: true });

  const id = randomUUID();
  const mainFilename = `${id}.webp`;
  const thumbFilename = `${id}_thumb.webp`;
  const mainPath = path.join(userDir, mainFilename);
  const thumbPath = path.join(userDir, thumbFilename);

  await fs.promises.writeFile(mainPath, mainBuffer);
  await fs.promises.writeFile(thumbPath, thumbBuffer);

  return {
    caminho: buildPublicPath(userId, mainFilename),
    thumbCaminho: buildPublicPath(userId, thumbFilename),
    mimeType: 'image/webp',
    tamanhoBytes: mainBuffer.length,
  };
}

function deleteFileAsync(caminho) {
  if (!caminho) return;

  const absolutePath = getAbsolutePathFromPublic(caminho);
  fs.unlink(absolutePath, (err) => {
    if (err && err.code !== 'ENOENT') {
      console.error('[Storage] Failed to delete file:', absolutePath, err.message);
    }
  });

  if (caminho.endsWith('.webp') && !caminho.includes('_thumb')) {
    const thumbCaminho = caminho.replace('.webp', '_thumb.webp');
    const thumbPath = getAbsolutePathFromPublic(thumbCaminho);
    fs.unlink(thumbPath, () => {});
  }
}

module.exports = {
  ensureUploadDirs,
  saveAvatarFiles,
  deleteFileAsync,
  buildPublicPath,
};
