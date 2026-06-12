const db = require('../config/database');

exports.getCurrentLesson = async (userId) => {
  const currentProgress = await db.usuario_idioma.findFirst({
    where: { id_usuario: parseInt(userId, 10) },
    orderBy: { id: 'desc' },
    include: {
      idioma: true,
      nivel: true
    }
  });

  if (!currentProgress || !currentProgress.id_idioma || !currentProgress.id_nivel) {
    const err = new Error('Nenhum idioma ou nível ativo configurado. Conclua o Onboarding primeiro.');
    err.status = 400;
    throw err;
  }

  // Find active or next lesson
  let activeLicao = null;

  // 1. Check if user already has a lesson in progress (foi_concluida = false)
  const lessonInProgress = await db.usuario_licao.findFirst({
    where: {
      id_usuario: parseInt(userId, 10),
      foi_concluida: false
    },
    include: {
      licao: true
    }
  });

  if (lessonInProgress) {
    activeLicao = lessonInProgress.licao;
  } else {
    // 2. Find all lessons matching their level and language
    const licoes = await db.licao.findMany({
      where: {
        id_idioma: currentProgress.id_idioma,
        id_nivel: currentProgress.id_nivel
      },
      orderBy: { id: 'asc' }
    });

    if (licoes.length === 0) {
      const err = new Error('Nenhuma lição cadastrada no banco de dados para este nível e idioma.');
      err.status = 404;
      throw err;
    }

    // Find completed lessons in usuario_licao
    const completedLicoes = await db.usuario_licao.findMany({
      where: {
        id_usuario: parseInt(userId, 10),
        foi_concluida: true
      },
      select: { id_licao: true }
    });
    const completedIds = new Set(completedLicoes.map(cl => cl.id_licao));

    // Choose the first uncompleted lesson
    const nextLicao = licoes.find(l => !completedIds.has(l.id)) || licoes[0];

    // Create the lesson in progress record in usuario_licao
    const newProgress = await db.usuario_licao.create({
      data: {
        id_usuario: parseInt(userId, 10),
        id_licao: nextLicao.id,
        foi_concluida: false,
        pontos_obtidos: 0
      },
      include: {
        licao: true
      }
    });

    // Also update/create progresso_licao to "em_andamento"
    const existingProg = await db.progresso_licao.findFirst({
      where: {
        id_usuario: parseInt(userId, 10),
        id_licao: nextLicao.id
      }
    });
    if (existingProg) {
      await db.progresso_licao.update({
        where: { id: existingProg.id },
        data: {
          id_status: 2,
          progresso_porcentagem: 0
        }
      });
    } else {
      await db.progresso_licao.create({
        data: {
          id_usuario: parseInt(userId, 10),
          id_licao: nextLicao.id,
          id_status: 2,
          progresso_porcentagem: 0
        }
      });
    }
    activeLicao = newProgress.licao;
  }

  // Fetch choices list from licao_conteudo table
  const choices = await db.licao_conteudo.findMany({
    where: { id_licao: activeLicao.id }
  });

  if (choices.length === 0) {
    const err = new Error('Nenhum conteúdo cadastrado no banco de dados para esta lição.');
    err.status = 404;
    throw err;
  }

  // Fetch options from licao_opcao associated with the content IDs
  const licaoOpcoes = await db.licao_opcao.findMany({
    where: {
      id_licao_conteudo: { in: choices.map(c => c.id) }
    }
  });

  // Generate dynamic multiple choice questions based on the database licao_conteudo records
  const questions = choices.map((item) => {
    const hasDesc = item.descricao && item.descricao.trim().length > 0;
    const pergunta = hasDesc ? `Como se diz "${item.titulo}"?` : `Selecione a opção correta para: "${item.titulo}"`;
    
    // Get options for this specific question content
    const itemOpcoes = licaoOpcoes.filter(o => o.id_licao_conteudo === item.id);

    let respostaCorreta;
    let opcoes;

    if (itemOpcoes.length > 0) {
      // Multiple choice from licao_opcao specifically for this content ID
      const correctOption = itemOpcoes.find(o => o.eh_correta);
      respostaCorreta = correctOption ? correctOption.texto_opcao : (hasDesc ? item.descricao : item.titulo);
      
      const optionsSet = new Set(itemOpcoes.map(o => o.texto_opcao));
      opcoes = Array.from(optionsSet).sort(() => Math.random() - 0.5);
    } else {
      // Dynamic fallback options from other choices of the same lesson
      respostaCorreta = hasDesc ? item.descricao : item.titulo;
      const otherAnswers = choices
        .filter(c => c.id !== item.id)
        .map(c => (hasDesc ? c.descricao : c.titulo))
        .filter(val => val && val.trim().length > 0);

      const optionsSet = new Set([respostaCorreta, ...otherAnswers]);
      opcoes = Array.from(optionsSet).sort(() => Math.random() - 0.5);
    }

    return {
      id: item.id,
      pergunta,
      opcoes,
      respostaCorreta,
      textoAudio: item.titulo,
      codigoIdioma: item.codigo_idioma
    };
  });

  return {
    lesson: {
      id: activeLicao.id,
      titulo: activeLicao.titulo,
      tipo: activeLicao.tipo || 'grammar',
      duracao_minutos: activeLicao.duracao_minutos || 10
    },
    nivelNome: currentProgress.nivel?.nome || 'Iniciante',
    idiomaNome: currentProgress.idioma?.nome || 'Inglês',
    questions
  };
};

exports.completeLesson = async (userId, licaoId, points = 50, respostasCorretas = 0, totalQuestoes = 0) => {
  const existing = await db.usuario_licao.findFirst({
    where: {
      id_usuario: parseInt(userId, 10),
      id_licao: parseInt(licaoId, 10),
      foi_concluida: false
    }
  });

  if (existing) {
    await db.usuario_licao.update({
      where: { id: existing.id },
      data: {
        foi_concluida: true,
        pontos_obtidos: parseInt(points, 10),
        respostas_corretas: parseInt(respostasCorretas, 10),
        total_questoes: parseInt(totalQuestoes, 10),
        data_atividade: new Date()
      }
    });
  } else {
    // Just in case, create or update a completed record
    const completedExisting = await db.usuario_licao.findFirst({
      where: {
        id_usuario: parseInt(userId, 10),
        id_licao: parseInt(licaoId, 10),
        foi_concluida: true
      }
    });
    if (completedExisting) {
      await db.usuario_licao.update({
        where: { id: completedExisting.id },
        data: {
          pontos_obtidos: (completedExisting.pontos_obtidos || 0) + parseInt(points, 10),
          respostas_corretas: parseInt(respostasCorretas, 10),
          total_questoes: parseInt(totalQuestoes, 10),
          data_atividade: new Date()
        }
      });
    } else {
      await db.usuario_licao.create({
        data: {
          id_usuario: parseInt(userId, 10),
          id_licao: parseInt(licaoId, 10),
          foi_concluida: true,
          pontos_obtidos: parseInt(points, 10),
          respostas_corretas: parseInt(respostasCorretas, 10),
          total_questoes: parseInt(totalQuestoes, 10),
          data_atividade: new Date()
        }
      });
    }
  }

  // Also update/create progresso_licao to "concluida" with 100% progress
  const existingProg = await db.progresso_licao.findFirst({
    where: {
      id_usuario: parseInt(userId, 10),
      id_licao: parseInt(licaoId, 10)
    }
  });

  if (existingProg) {
    await db.progresso_licao.update({
      where: { id: existingProg.id },
      data: {
        id_status: 3,
        progresso_porcentagem: 100,
        data_conclusao: new Date()
      }
    });
  } else {
    await db.progresso_licao.create({
      data: {
        id_usuario: parseInt(userId, 10),
        id_licao: parseInt(licaoId, 10),
        id_status: 3,
        progresso_porcentagem: 100,
        data_conclusao: new Date()
      }
    });
  }

  const progress = await db.usuario_idioma.findFirst({
    where: { id_usuario: parseInt(userId, 10) },
    orderBy: { id: 'desc' }
  });

  if (progress) {
    const gamificacao = await db.usuario_gamificacao.findUnique({
      where: { id_usuario_idioma: progress.id }
    });

    if (gamificacao) {
      // Check if they already did an activity today (timezone-robust comparison)
      let alreadyDidActivityToday = false;
      if (gamificacao.ultima_atividade) {
        const todayStr = new Date().toISOString().split('T')[0];
        const lastActStr = new Date(gamificacao.ultima_atividade).toISOString().split('T')[0];
        
        const todayLocalStr = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
        const lastActLocalStr = new Date(gamificacao.ultima_atividade).toLocaleDateString('en-CA');
        
        if (todayStr === lastActStr || todayLocalStr === lastActLocalStr) {
          alreadyDidActivityToday = true;
        }
      }

      await db.usuario_gamificacao.update({
        where: { id: gamificacao.id },
        data: {
          pontos_acumulados: (gamificacao.pontos_acumulados || 0) + parseInt(points, 10),
          dias_ofensiva: alreadyDidActivityToday ? (gamificacao.dias_ofensiva || 0) : (gamificacao.dias_ofensiva || 0) + 1,
          ultima_atividade: new Date()
        }
      });
    } else {
      await db.usuario_gamificacao.create({
        data: {
          id_usuario_idioma: progress.id,
          pontos_acumulados: parseInt(points, 10),
          dias_ofensiva: 1,
          ultima_atividade: new Date()
        }
      });
    }
  }

  return true;
};
