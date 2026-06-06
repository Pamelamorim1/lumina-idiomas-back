// Caminho: backend/create_user.js
const db = require('./src/config/database');
const bcrypt = require('bcryptjs');

async function run() {
  try {
    const email = 'teste@lumina.com';
    const password = 'password123';
    
    // Check if user already exists
    const existing = await db.usuario.findUnique({
      where: { email }
    });

    if (existing) {
      console.log(`\n⚠️ O usuário "${email}" já existe no banco de dados.`);
      
      // Update password and set to active
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
      await db.usuario.update({
        where: { email },
        data: {
          senha_hash: hashedPassword,
          is_ativo: true
        }
      });
      console.log(`🔄 Senha atualizada com sucesso para: "${password}" e status definido como ATIVO.`);
      process.exit(0);
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const newUser = await db.usuario.create({
      data: {
        nome_completo: 'Estudante Lumina',
        email,
        senha_hash: hashedPassword,
        is_ativo: true
      }
    });

    console.log(`\n🎉 Usuário cadastrado com sucesso!`);
    console.log(`👉 E-mail: ${newUser.email}`);
    console.log(`👉 Senha: ${password}\n`);
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Erro ao criar/atualizar usuário no banco:', error.message);
    process.exit(1);
  }
}

run();
