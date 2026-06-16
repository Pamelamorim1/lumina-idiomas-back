// Caminho: backend/src/controllers/auth.controller.js

const authService = require('../services/auth.service');

/**
 * Checks if an email is already registered in the database.
 * GET /auth/check-email?email=xxx
 */
exports.checkEmail = async (req, res, next) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'O e-mail é obrigatório para a verificação.',
        data: null
      });
    }

    const exists = await authService.checkEmailExists(email);

    res.status(200).json({
      success: true,
      message: exists ? 'E-mail já está cadastrado.' : 'E-mail livre para cadastro.',
      data: { exists }
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
        data: null
      });
    }
    next(error);
  }
};

/**
 * Gets the logged-in user profile details.
 * GET /auth/me
 */
exports.getMe = async (req, res, next) => {
  try {
    const userId = req.userId;
    const user = await authService.getUserById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado.',
        data: null
      });
    }

    res.status(200).json({
      success: true,
      message: 'Dados do usuário obtidos com sucesso.',
      data: user
    });
  } catch (error) {
    next(error);
  }
};

exports.signup = async (req, res, next) => {
  try {
    const { nomeCompleto, email, password } = req.body;

    if (!nomeCompleto || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Nome completo, e-mail e senha são obrigatórios.',
        data: null
      });
    }

    const result = await authService.signup({ nomeCompleto, email, password });

    res.status(201).json({
      success: true,
      message: 'Usuário cadastrado com sucesso!',
      data: result
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
        data: null
      });
    }
    next(error);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'E-mail e senha são obrigatórios.',
        data: null
      });
    }

    const result = await authService.login({ email, password });

    res.status(200).json({
      success: true,
      message: 'Login efetuado com sucesso!',
      data: result
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
        data: null
      });
    }
    next(error);
  }
};

exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'O e-mail é obrigatório.',
        data: null
      });
    }

    await authService.requestPasswordReset(email);

    res.status(200).json({
      success: true,
      message: 'E-mail de recuperação enviado com sucesso!',
      data: null
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
        data: null
      });
    }
    next(error);
  }
};

exports.resetPassword = async (req, res, next) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Token e nova senha são obrigatórios.',
        data: null
      });
    }

    await authService.resetPassword(token, newPassword);

    res.status(200).json({
      success: true,
      message: 'Senha redefinida com sucesso!',
      data: null
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
        data: null
      });
    }
    next(error);
  }
};

exports.changePassword = async (req, res, next) => {
  try {
    const userId = req.userId;
    const { senhaAtual, novaSenha } = req.body;

    if (!senhaAtual || !novaSenha) {
      return res.status(400).json({
        success: false,
        message: 'Senha atual e nova senha são obrigatórias.',
        data: null
      });
    }

    await authService.changePassword(userId, senhaAtual, novaSenha);

    res.status(200).json({
      success: true,
      message: 'Senha alterada com sucesso!',
      data: null
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
        data: null
      });
    }
    next(error);
  }
};

exports.selectLanguage = async (req, res, next) => {
  try {
    const userId = req.userId; // From authMiddleware
    const { idiomaId, etapaCadastroId } = req.body;

    if (!idiomaId) {
      return res.status(400).json({
        success: false,
        message: 'O ID do idioma é obrigatório.',
        data: null
      });
    }

    const result = await authService.selectLanguage(userId, idiomaId, etapaCadastroId);

    res.status(200).json({
      success: true,
      message: 'Idioma selecionado e cadastro atualizado para a próxima etapa!',
      data: result
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
        data: null
      });
    }
    next(error);
  }
};

exports.selectObjective = async (req, res, next) => {
  try {
    const userId = req.userId; // From authMiddleware
    const { objetivoId, etapaCadastroId } = req.body;

    if (!objetivoId) {
      return res.status(400).json({
        success: false,
        message: 'O ID do objetivo é obrigatório.',
        data: null
      });
    }

    const result = await authService.selectObjective(userId, objetivoId, etapaCadastroId);

    res.status(200).json({
      success: true,
      message: 'Objetivo selecionado e cadastro atualizado para a próxima etapa!',
      data: result
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
        data: null
      });
    }
    next(error);
  }
};

exports.getObjectives = async (req, res, next) => {
  try {
    const objectives = await authService.getObjectives();

    res.status(200).json({
      success: true,
      message: 'Objetivos recuperados com sucesso!',
      data: objectives
    });
  } catch (error) {
    next(error);
  }
};

exports.selectStartingPoint = async (req, res, next) => {
  try {
    const userId = req.userId; // From authMiddleware
    const { pontoPartida, etapaCadastroId } = req.body;

    if (!pontoPartida || !['zero', 'teste'].includes(pontoPartida)) {
      return res.status(400).json({
        success: false,
        message: "O campo pontoPartida deve ser 'zero' ou 'teste'.",
        data: null
      });
    }

    const result = await authService.selectStartingPoint(userId, pontoPartida, etapaCadastroId);

    res.status(200).json({
      success: true,
      message: 'Ponto de partida definido! Cadastro finalizado.',
      data: result
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
        data: null
      });
    }
    next(error);
  }
};
