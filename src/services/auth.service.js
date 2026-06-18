// Caminho: backend/src/services/auth.service.js

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/database'); // Prisma Client instance
const emailService = require('./email.service');
const profileService = require('./profile.service');

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_change_me_in_production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

function validatePasswordStrength(password) {
  if (!password || password.length < 8) {
    return 'A senha deve conter no mínimo 8 caracteres.';
  }
  if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
    return 'A senha deve incluir letras maiúsculas, minúsculas e números.';
  }
  return null;
}

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
const mapUserProfile = (user, progress, avatar, baseUrl) => {
  const idiomaNome = progress?.idioma?.nome || null;
  const nivelNome = progress?.nivel?.nome || null;
  const objetivoNome = progress?.objetivo?.nome || null;

  let nivelLabel = "Não Iniciado";
  let progressoPorcentagem = 0;

  if (nivelNome) {
    const nomeNorm = nivelNome.toLowerCase().trim();
    if (nomeNorm === 'zero') {
      nivelLabel = "Nível A0 • Iniciante";
      progressoPorcentagem = 0;
    } else if (nomeNorm === 'básico' || nomeNorm === 'basico') {
      nivelLabel = "Nível A2 • Básico";
      progressoPorcentagem = 30;
    } else if (nomeNorm === 'intermediário' || nomeNorm === 'intermediario') {
      nivelLabel = "Nível B1 • Intermediário";
      progressoPorcentagem = 65;
    } else if (nomeNorm === 'avançado' || nomeNorm === 'avancado') {
      nivelLabel = "Nível C1 • Avançado";
      progressoPorcentagem = 90;
    } else {
      nivelLabel = `Nível • ${nivelNome}`;
      progressoPorcentagem = 10;
    }
  }

  const diasSeguidos = progress?.usuario_gamificacao?.dias_ofensiva ?? 1;
  const pontosGanhos = progress?.usuario_gamificacao?.pontos_acumulados ?? 150;

  const licoesDoDia = [
    {
      id: 1,
      titulo: "Verbos Modais",
      duracao: "10 min",
      progresso: 0.4,
      tipo: "grammar"
    },
    {
      id: 2,
      titulo: "Conversação no Café",
      duracao: "15 min",
      progresso: 0.0,
      tipo: "conversation"
    }
  ];

  return {
    id: user.id,
    nomeCompleto: user.nome_completo,
    email: user.email,
    telefone: user.telefone ?? null,
    bio: user.bio ?? null,
    fotoUrl: avatar
      ? profileService.buildFotoUrl(baseUrl || '', avatar.caminho, avatar.data_criacao)
      : null,
    criadoEm: user.data_criacao,
    ativo: user.is_ativo,
    etapaCadastro: progress?.id_etapa || 1,
    cursoAtivo: idiomaNome,
    nivelAtivo: nivelNome,
    objetivoAtivo: objetivoNome,
    nivelLabel,
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
exports.getUserById = async (id, baseUrl = '') => {
  const user = await db.usuario.findUnique({
    where: { id: parseInt(id, 10) },
    select: {
      id: true,
      nome_completo: true,
      email: true,
      telefone: true,
      bio: true,
      is_ativo: true,
      data_criacao: true
    }
  });

  if (!user) return null;

  const [progress, avatar] = await Promise.all([
    db.usuario_idioma.findFirst({
      where: { id_usuario: user.id },
      orderBy: { id: 'desc' },
      include: {
        idioma: true,
        nivel: true,
        objetivo: true,
        usuario_gamificacao: true
      }
    }),
    profileService.getActiveAvatar(user.id),
  ]);

  return mapUserProfile(user, progress, avatar, baseUrl);
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

exports.login = async ({ email, password }, baseUrl = '') => {
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

  const avatar = await profileService.getActiveAvatar(user.id);

  return {
    user: mapUserProfile(user, progress, avatar, baseUrl),
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

/**
 * Changes the password for an authenticated user.
 */
exports.changePassword = async (userId, senhaAtual, novaSenha) => {
  const user = await db.usuario.findUnique({
    where: { id: parseInt(userId, 10) }
  });

  if (!user) {
    const err = new Error('Usuário não encontrado.');
    err.status = 404;
    throw err;
  }

  if (!user.is_ativo) {
    const err = new Error('Esta conta está desativada.');
    err.status = 403;
    throw err;
  }

  const isMatch = await bcrypt.compare(senhaAtual, user.senha_hash);
  if (!isMatch) {
    const err = new Error('Senha atual incorreta.');
    err.status = 401;
    throw err;
  }

  if (senhaAtual === novaSenha) {
    const err = new Error('A nova senha deve ser diferente da senha atual.');
    err.status = 400;
    throw err;
  }

  const strengthError = validatePasswordStrength(novaSenha);
  if (strengthError) {
    const err = new Error(strengthError);
    err.status = 400;
    throw err;
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(novaSenha, salt);

  const updatedUser = await db.usuario.update({
    where: { id: user.id },
    data: { senha_hash: hashedPassword }
  });

  emailService.sendPasswordChangedEmail(updatedUser.email, updatedUser.nome_completo).catch(err => {
    console.error('[Password Changed Email Error]', err.message);
  });

  return true;
};

/**
 * Selects language for a user and sets stage to OBJETIVO_CADASTRO.
 */
exports.selectLanguage = async (userId, idiomaId, etapaCadastroId) => {
  const lang = await db.idioma.findUnique({
    where: { id: parseInt(idiomaId, 10) }
  });

  if (!lang) {
    const err = new Error('Idioma selecionado inválido.');
    err.status = 400;
    throw err;
  }

  const nextEtapaId = etapaCadastroId ? parseInt(etapaCadastroId, 10) : 2;

  // Check if there is an existing record
  const existing = await db.usuario_idioma.findFirst({
    where: { id_usuario: parseInt(userId, 10) }
  });

  let record;
  if (existing) {
    record = await db.usuario_idioma.update({
      where: { id: existing.id },
      data: {
        id_idioma: lang.id,
        id_etapa: nextEtapaId
      }
    });
  } else {
    record = await db.usuario_idioma.create({
      data: {
        id_usuario: parseInt(userId, 10),
        id_idioma: lang.id,
        id_etapa: nextEtapaId
      }
    });
  }

  return {
    etapaCadastro: record.id_etapa,
    idiomaId: record.id_idioma,
    idiomaNome: lang.nome
  };
};

/**
 * Selects/Updates the user's objective and sets stage to PARTIDA_CADASTRO.
 */
exports.selectObjective = async (userId, objetivoId, etapaCadastroId) => {
  const objective = await db.objetivo.findUnique({
    where: { id: parseInt(objetivoId, 10) }
  });

  if (!objective) {
    const err = new Error('Objetivo selecionado inválido.');
    err.status = 400;
    throw err;
  }

  const nextEtapaId = etapaCadastroId ? parseInt(etapaCadastroId, 10) : 3;

  // Get the latest usuario_idioma record for the user
  const existing = await db.usuario_idioma.findFirst({
    where: { id_usuario: parseInt(userId, 10) },
    orderBy: { id: 'desc' }
  });

  if (!existing) {
    const err = new Error('Nenhum idioma selecionado para este usuário ainda.');
    err.status = 400;
    throw err;
  }

  const record = await db.usuario_idioma.update({
    where: { id: existing.id },
    data: {
      id_objetivo: objective.id,
      id_etapa: nextEtapaId
    }
  });

  return {
    etapaCadastro: record.id_etapa,
    objetivoId: record.id_objetivo,
    objetivoNome: objective.nome
  };
};

/**
 * Fetches all objectives from the database.
 */
exports.getObjectives = async () => {
  return await db.objetivo.findMany({
    orderBy: { id: 'asc' }
  });
};

/**
 * Sets the user's starting point and finalizes onboarding (or updates stage).
 */
exports.selectStartingPoint = async (userId, pontoPartida, etapaCadastroId) => {
  if (!['zero', 'teste'].includes(pontoPartida)) {
    const err = new Error("O campo pontoPartida deve ser 'zero' ou 'teste'.");
    err.status = 400;
    throw err;
  }

  // Get the latest usuario_idioma record for the user
  const existing = await db.usuario_idioma.findFirst({
    where: { id_usuario: parseInt(userId, 10) },
    orderBy: { id: 'desc' }
  });

  if (!existing) {
    const err = new Error('Nenhum registro de idioma/objetivo encontrado para este usuário.');
    err.status = 400;
    throw err;
  }

  const nextEtapaId = etapaCadastroId ? parseInt(etapaCadastroId, 10) : 4;

  let nivelId = null;
  if (pontoPartida === 'zero') {
    // Find the level with name 'Zero'
    const zeroNivel = await db.nivel.findFirst({
      where: { nome: 'Zero' }
    });
    nivelId = zeroNivel ? zeroNivel.id : 1;
  }

  const record = await db.usuario_idioma.update({
    where: { id: existing.id },
    data: {
      id_nivel: nivelId,
      id_etapa: nextEtapaId
    }
  });

  return {
    etapaCadastro: record.id_etapa,
    nivelId: record.id_nivel,
    pontoPartida
  };
};
