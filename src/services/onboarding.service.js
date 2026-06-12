const db = require('../config/database');

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

exports.getObjectives = async () => {
  return await db.objetivo.findMany({
    orderBy: { id: 'asc' }
  });
};

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

  if (pontoPartida === 'zero') {
    const existingGamificacao = await db.usuario_gamificacao.findUnique({
      where: { id_usuario_idioma: record.id }
    });

    if (!existingGamificacao) {
      await db.usuario_gamificacao.create({
        data: {
          id_usuario_idioma: record.id,
          dias_ofensiva: 0,
          pontos_acumulados: 0,
          ultima_atividade: new Date()
        }
      });
    }
  }

  return {
    etapaCadastro: record.id_etapa,
    nivelId: record.id_nivel,
    pontoPartida
  };
};
