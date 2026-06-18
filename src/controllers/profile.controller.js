const profileService = require('../services/profile.service');
const authService = require('../services/auth.service');

function getBaseUrl(req) {
  if (process.env.API_BASE_URL) {
    return process.env.API_BASE_URL.replace(/\/$/, '');
  }
  return `${req.protocol}://${req.get('host')}`;
}

exports.updateProfile = async (req, res, next) => {
  try {
    const userId = req.userId;
    const { nomeCompleto, email, telefone, bio } = req.body;

    await profileService.updateProfile(userId, {
      nomeCompleto,
      email,
      telefone,
      bio,
    });

    const baseUrl = getBaseUrl(req);
    const profile = await authService.getUserById(userId, baseUrl);

    res.status(200).json({
      success: true,
      message: 'Perfil atualizado com sucesso.',
      data: {
        ...profile,
      },
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
        data: null,
      });
    }
    next(error);
  }
};

exports.uploadPhoto = async (req, res, next) => {
  try {
    const userId = req.userId;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Nenhuma imagem foi enviada.',
        data: null,
      });
    }

    const baseUrl = getBaseUrl(req);
    const result = await profileService.uploadAvatar(userId, req.file, baseUrl);

    res.status(200).json({
      success: true,
      message: 'Foto de perfil atualizada com sucesso.',
      data: result,
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
        data: null,
      });
    }
    next(error);
  }
};
