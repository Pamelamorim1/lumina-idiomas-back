const multer = require('multer');

const MAX_FILE_SIZE = 5 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
      return;
    }
    cb(new Error('Formato de imagem não suportado. Use JPEG, PNG ou WebP.'));
  },
});

const uploadAvatarPhoto = upload.single('photo');

function handleUploadError(err, req, res, next) {
  if (!err) return next();

  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      success: false,
      message: 'A imagem deve ter no máximo 5 MB.',
      data: null,
    });
  }

  return res.status(400).json({
    success: false,
    message: err.message || 'Erro ao processar o upload da imagem.',
    data: null,
  });
}

module.exports = {
  uploadAvatarPhoto,
  handleUploadError,
};
