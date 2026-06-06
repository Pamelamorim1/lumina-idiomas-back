// Temporary password test script
const { Client } = require('pg');

const passwords = ['amorim', 'postgres123', 'postgres', 'admin', 'root', '123456', ''];

async function testPasswords() {
  for (const pw of passwords) {
    const client = new Client({
      host: 'localhost',
      port: 5433,
      user: 'postgres',
      password: pw,
      database: 'postgres',
    });
    try {
      await client.connect();
      console.log(`\n🎉 SUCCESS! Connected successfully with password: "${pw}"`);
      await client.end();
      process.exit(0);
    } catch (e) {
      console.log(`Tried "${pw}": Failed - ${e.message}`);
    }
  }
  console.log('\n❌ None of the tested passwords worked.');
  process.exit(1);
}

testPasswords();
