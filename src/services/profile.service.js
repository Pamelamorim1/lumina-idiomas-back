const db = require('../config/database');
const imageService = require('./image.service');
const storageService = require('./storage.service');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeTelefone(telefone) {
  if (telefone === undefined || telefone === null) return null;
  const trimmed = String(telefone).trim();
  if (!trimmed) return null;
  return trimmed.slice(0, 20);
}

function buildFotoUrl(baseUrl, caminho, dataCriacao) {
  if (!caminho) return null;
  const version = dataCriacao ? new Date(dataCriacao).getTime() : Date.now();
  const normalizedBase = baseUrl.replace(/\/$/, '');
  return `${normalizedBase}${caminho}?v=${version}`;
}

async function getActiveAvatar(userId) {
  return db.usuario_imagem.findFirst({
    where: {
      id_usuario: parseInt(userId, 10),
      tipo: 'avatar',
      is_ativa: true,
    },
    orderBy: { data_criacao: 'desc' },
  });
}

exports.getActiveAvatar = getActiveAvatar;
exports.buildFotoUrl = buildFotoUrl;

exports.updateProfile = async (userId, { nomeCompleto, email, telefone, bio }) => {
  const parsedId = parseInt(userId, 10);

  if (!nomeCompleto || !String(nomeCompleto).trim()) {
    const err = new Error('O nome completo é obrigatório.');
    err.status = 400;
    throw err;
  }

  if (!email || !String(email).trim()) {
    const err = new Error('O e-mail é obrigatório.');
    err.status = 400;
    throw err;
  }

  const normalizedEmail = String(email).toLowerCase().trim();
  if (!EMAIL_REGEX.test(normalizedEmail)) {
    const err = new Error('Insira um e-mail válido.');
    err.status = 400;
    throw err;
  }

  const normalizedBio = bio !== undefined && bio !== null ? String(bio).trim() : null;
  if (normalizedBio && normalizedBio.length > 300) {
    const err = new Error('A bio deve ter no máximo 300 caracteres.');
    err.status = 400;
    throw err;
  }

  const user = await db.usuario.findUnique({
    where: { id: parsedId },
    select: { id: true, email: true, is_ativo: true },
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

  if (normalizedEmail !== user.email) {
    const existing = await db.usuario.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });

    if (existing && existing.id !== parsedId) {
      const err = new Error('Este e-mail já está cadastrado.');
      err.status = 400;
      throw err;
    }
  }

  await db.usuario.update({
    where: { id: parsedId },
    data: {
      nome_completo: String(nomeCompleto).trim(),
      email: normalizedEmail,
      telefone: normalizeTelefone(telefone),
      bio: normalizedBio || null,
    },
  });

  return parsedId;
};

exports.uploadAvatar = async (userId, file, baseUrl) => {
  const parsedId = parseInt(userId, 10);

  const user = await db.usuario.findUnique({
    where: { id: parsedId },
    select: { id: true, is_ativo: true },
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

  const processed = await imageService.processAvatar(file.buffer, file.mimetype);
  const saved = await storageService.saveAvatarFiles(parsedId, processed.mainBuffer, processed.thumbBuffer);

  const previousAvatars = await db.$transaction(async (tx) => {
    const inactive = await tx.usuario_imagem.findMany({
      where: {
        id_usuario: parsedId,
        tipo: 'avatar',
        is_ativa: true,
      },
    });

    await tx.usuario_imagem.updateMany({
      where: {
        id_usuario: parsedId,
        tipo: 'avatar',
        is_ativa: true,
      },
      data: { is_ativa: false },
    });

    const created = await tx.usuario_imagem.create({
      data: {
        id_usuario: parsedId,
        tipo: 'avatar',
        caminho: saved.caminho,
        mime_type: saved.mimeType,
        tamanho_bytes: saved.tamanhoBytes,
        largura: processed.largura,
        altura: processed.altura,
        is_ativa: true,
      },
    });

    return { inactive, created };
  });

  previousAvatars.inactive.forEach((avatar) => {
    storageService.deleteFileAsync(avatar.caminho);
  });

  const fotoUrl = buildFotoUrl(baseUrl, previousAvatars.created.caminho, previousAvatars.created.data_criacao);

  return { fotoUrl };
};
