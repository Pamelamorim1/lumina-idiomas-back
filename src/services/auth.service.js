// Caminho: backend/src/services/auth.service.js

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/database'); // Prisma Client instance
const emailService = require('./email.service');

const onboardingService = require('./onboarding.service');
const lessonService = require('./lesson.service');

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_change_me_in_production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// Re-export onboarding methods
exports.selectLanguage = onboardingService.selectLanguage;
exports.selectObjective = onboardingService.selectObjective;
exports.getObjectives = onboardingService.getObjectives;
exports.selectStartingPoint = onboardingService.selectStartingPoint;

// Re-export lesson methods
exports.getCurrentLesson = lessonService.getCurrentLesson;
exports.completeLesson = lessonService.completeLesson;

/**
 * Checks if a user exists in the database by their email.
 * @param {string} email 
 * @returns {Promise<boolean>}
 */
exports.checkEmailExists = async (email) => {
  const user = await db.usuario.findUnique({
    where: { email: email.toLowerCase().trim() },
    select: { id: true }
  });
  return !!user;
};

/**
 * Helper to map the database user progress and gamification to user profile.
 */
const mapUserProfile = (user, progress, licoes = []) => {
  const idiomaNome = progress?.idioma?.nome || null;
  const nivelNome = progress?.nivel?.nome || null;
  const objetivoNome = progress?.objetivo?.nome || null;

  let progressoPorcentagem = 0;
  if (licoes.length > 0) {
    const totalProgress = licoes.reduce((acc, lic) => {
      const prog = lic.progresso_licao?.[0];
      return acc + (prog ? (prog.progresso_porcentagem || 0) : 0);
    }, 0);
    progressoPorcentagem = Math.round(totalProgress / licoes.length);
  }

  const diasSeguidos = progress?.usuario_gamificacao?.dias_ofensiva ?? 0;
  const pontosGanhos = progress?.usuario_gamificacao?.pontos_acumulados ?? 0;

  const licoesDoDia = licoes.map(lic => {
    const prog = lic.progresso_licao?.[0];
    const pct = prog ? (prog.progresso_porcentagem || 0) : 0;
    return {
      id: lic.id,
      titulo: lic.titulo,
      duracao: `${lic.duracao_minutos || 10} min`,
      progresso: pct / 100,
      tipo: lic.tipo || 'grammar'
    };
  });

  return {
    id: user.id,
    nomeCompleto: user.nome_completo,
    email: user.email,
    criadoEm: user.data_criacao,
    ativo: user.is_ativo,
    etapaCadastro: progress?.id_etapa || 1,
    cursoAtivo: idiomaNome,
    nivelAtivo: nivelNome,
    objetivoAtivo: objetivoNome,
    nivelLabel: nivelNome ? `Nível ${nivelNome}` : "Não Iniciado",
    progressoPorcentagem,
    diasSeguidos,
    pontosGanhos,
    licoesDoDia
  };
};

/**
 * Fetches user profile data by their ID.
 * @param {number|string} id 
 * @returns {Promise<object|null>}
 */
exports.getUserById = async (id) => {
  const user = await db.usuario.findUnique({
    where: { id: parseInt(id, 10) },
    select: {
      id: true,
      nome_completo: true,
      email: true,
      is_ativo: true,
      data_criacao: true
    }
  });

  if (!user) return null;

  const progress = await db.usuario_idioma.findFirst({
    where: { id_usuario: user.id },
    orderBy: { id: 'desc' },
    include: {
      idioma: true,
      nivel: true,
      objetivo: true,
      usuario_gamificacao: true
    }
  });

  let licoes = [];
  if (progress && progress.id_idioma && progress.id_nivel) {
    licoes = await db.licao.findMany({
      where: {
        id_idioma: progress.id_idioma,
        id_nivel: progress.id_nivel
      },
      include: {
        progresso_licao: {
          where: {
            id_usuario: user.id
          }
        }
      }
    });
  }

  return mapUserProfile(user, progress, licoes);
};

exports.signup = async ({ nomeCompleto, email, password }) => {
  // Check if user already exists using the introspected 'usuario' model
  const existingUser = await db.usuario.findUnique({
    where: { email: email.toLowerCase().trim() }
  });

  if (existingUser) {
    const err = new Error('Este e-mail já está cadastrado.');
    err.status = 400;
    throw err;
  }

  // Hash password
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  // Insert user into PostgreSQL 'usuario' model
  const user = await db.usuario.create({
    data: {
      nome_completo: nomeCompleto.trim(),
      email: email.toLowerCase().trim(),
      senha_hash: hashedPassword
    }
  });

  // Asynchronously send welcome email (unawaited so it doesn't delay signup response)
  emailService.sendWelcomeEmail(user.email, user.nome_completo).catch((err) => {
    console.error('[Signup Email Error] Failed to send welcome email:', err.message);
  });

  // Generate JWT token
  const token = jwt.sign({ id: user.id }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });

  return {
    user: {
      id: user.id,
      nomeCompleto: user.nome_completo,
      email: user.email,
      criadoEm: user.data_criacao,
      ativo: user.is_ativo,
      etapaCadastro: 1
    },
    token
  };
};

exports.login = async ({ email, password }) => {
  // Fetch user using the 'usuario' model
  const user = await db.usuario.findUnique({
    where: { email: email.toLowerCase().trim() }
  });

  if (!user) {
    const err = new Error('E-mail ou senha incorretos.');
    err.status = 401;
    throw err;
  }

  // Verify password using 'senha_hash'
  const isMatch = await bcrypt.compare(password, user.senha_hash);
  if (!isMatch) {
    const err = new Error('E-mail ou senha incorretos.');
    err.status = 401;
    throw err;
  }

  // Check if user is active using 'is_ativo'
  if (!user.is_ativo) {
    const err = new Error('Esta conta está desativada.');
    err.status = 403;
    throw err;
  }

  // Generate JWT token
  const token = jwt.sign({ id: user.id }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });

  const progress = await db.usuario_idioma.findFirst({
    where: { id_usuario: user.id },
    orderBy: { id: 'desc' },
    include: {
      idioma: true,
      nivel: true,
      objetivo: true,
      usuario_gamificacao: true
    }
  });

  let licoes = [];
  if (progress && progress.id_idioma && progress.id_nivel) {
    licoes = await db.licao.findMany({
      where: {
        id_idioma: progress.id_idioma,
        id_nivel: progress.id_nivel
      },
      include: {
        progresso_licao: {
          where: {
            id_usuario: user.id
          }
        }
      }
    });
  }

  return {
    user: mapUserProfile(user, progress, licoes),
    token
  };
};

/**
 * Request password recovery.
 * Generates recovery token and fires email.
 */
exports.requestPasswordReset = async (email) => {
  const user = await db.usuario.findUnique({
    where: { email: email.toLowerCase().trim() }
  });

  if (!user) {
    const err = new Error('Nenhum usuário cadastrado com este e-mail.');
    err.status = 404;
    throw err;
  }

  // Generate password recovery token (valid for 15m)
  const resetToken = jwt.sign(
    { id: user.id, purpose: 'reset-password' },
    JWT_SECRET,
    { expiresIn: '15m' }
  );

  // Send recovery email (unawaited to avoid latency)
  emailService.sendPasswordResetEmail(user.email, user.nome_completo, resetToken).catch(err => {
    console.error('[Recovery Email Error] Failed to send reset email:', err.message);
  });

  return true;
};

/**
 * Resets the password using a verified token.
 */
exports.resetPassword = async (token, newPassword) => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    if (decoded.purpose !== 'reset-password') {
      const err = new Error('Token inválido para esta operação.');
      err.status = 400;
      throw err;
    }

    const userId = decoded.id;

    // Check if user exists
    const user = await db.usuario.findUnique({
      where: { id: parseInt(userId, 10) }
    });

    if (!user) {
      const err = new Error('Usuário não encontrado.');
      err.status = 404;
      throw err;
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update password in database
    const updatedUser = await db.usuario.update({
      where: { id: user.id },
      data: { senha_hash: hashedPassword }
    });

    // Send confirmation email (unawaited)
    emailService.sendPasswordChangedEmail(updatedUser.email, updatedUser.nome_completo).catch(err => {
      console.error('[Password Changed Email Error] Failed to send confirmation:', err.message);
    });

    return true;
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      const err = new Error('O token de redefinição expirou. Solicite um novo link.');
      err.status = 400;
      throw err;
    }
    if (error.name === 'JsonWebTokenError') {
      const err = new Error('Token de redefinição inválido.');
      err.status = 400;
      throw err;
    }
    throw error;
  }
};
