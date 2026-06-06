// Caminho: backend/src/services/email.service.js

const nodemailer = require('nodemailer');

// Helper to create the transport client
async function createTransporter() {
  const host = process.env.SMTP_HOST ? process.env.SMTP_HOST.trim() : '';
  const portStr = process.env.SMTP_PORT ? process.env.SMTP_PORT.trim() : '';
  const user = process.env.SMTP_USER ? process.env.SMTP_USER.trim() : '';
  const pass = process.env.SMTP_PASS ? process.env.SMTP_PASS.trim() : '';
  const secureStr = process.env.SMTP_SECURE ? process.env.SMTP_SECURE.trim() : '';

  // If SMTP variables are defined in .env, use them
  if (host && portStr && user && pass) {
    console.log('[Email Service] Criando transporter SMTP com configurações do .env...');
    const transporter = nodemailer.createTransport({
      host,
      port: parseInt(portStr),
      secure: secureStr === 'true', // Converte string para booleano
      family: 4, // Força o uso de IPv4 para evitar falhas de conexão por IPv6
      auth: {
        user,
        pass,
      },
    });

    // Validar conexão SMTP e credenciais imediatamente
    try {
      await transporter.verify();
      console.log('[Email Service] Conexão SMTP autenticada e pronta para envio.');
    } catch (verifyErr) {
      console.error('[Email Service Warning] Falha na validação de conexão SMTP:', verifyErr.message);
    }

    return transporter;
  }

  // Fallback for Development: Create an Ethereal SMTP test account
  // This automatically generates real inbox URLs that can be previewed in the console!
  console.log('[Email Service] SMTP do .env incompleto. Inicializando fallback Ethereal de testes...');
  try {
    const testAccount = await nodemailer.createTestAccount();
    const transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
    console.log('[Email Service] Transporter Ethereal criado com sucesso.');
    return transporter;
  } catch (err) {
    console.error('[Email Service] Failed to create Ethereal test account:', err.message);
    return null;
  }
}

/**
 * Sends a welcome email to a new user.
 * @param {string} toEmail 
 * @param {string} userName 
 */
exports.sendWelcomeEmail = async (toEmail, userName) => {
  try {
    const transporter = await createTransporter();
    if (!transporter) {
      console.warn('[Email Service] Transporter not available. Email not sent.');
      return;
    }

    const fromHeader = process.env.SMTP_FROM || `"Lumina Idiomas" <${process.env.SMTP_USER || 'pamelataiane1234@gmail.com'}>`;

    // Premium HTML template matching the Lumina Idiomas visual theme
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Bem-vindo à Lumina Idiomas</title>
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background-color: #F1F5F9;
            margin: 0;
            padding: 0;
            color: #1E293B;
          }
          .container {
            max-width: 600px;
            margin: 40px auto;
            background-color: #FFFFFF;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
          }
          .header {
            background-color: #0E7490; /* Teal dark matching the app theme */
            padding: 40px 20px;
            text-align: center;
          }
          .header h1 {
            color: #FFFFFF;
            margin: 0;
            font-size: 28px;
            font-weight: 700;
          }
          .content {
            padding: 30px;
            line-height: 1.6;
          }
          .content h2 {
            color: #0E7490;
            font-size: 20px;
            margin-top: 0;
          }
          .btn-container {
            text-align: center;
            margin: 30px 0;
          }
          .btn {
            background-color: #0E7490;
            color: #FFFFFF !important;
            padding: 14px 28px;
            text-decoration: none;
            border-radius: 8px;
            font-weight: bold;
            display: inline-block;
          }
          .footer {
            background-color: #F8FAFC;
            padding: 20px;
            text-align: center;
            font-size: 12px;
            color: #64748B;
            border-top: 1px solid #E2E8F0;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Lumina Idiomas</h1>
          </div>
          <div class="content">
            <h2>Olá, ${userName}!</h2>
            <p>Seja muito bem-vindo(a) à <strong>Lumina Idiomas</strong>! Estamos extremamente felizes em ter você conosco iniciando essa nova jornada de aprendizado.</p>
            <p>O nosso aplicativo foi projetado para levar a sua fluência em inglês para o próximo nível de forma interativa, divertida e totalmente gamificada.</p>
            <p>Abaixo estão os dados da sua conta para acesso:</p>
            <ul>
              <li><strong>E-mail:</strong> ${toEmail}</li>
              <li><strong>Plataforma:</strong> Aplicativo Lumina Idiomas</li>
            </ul>
            <div class="btn-container">
              <a href="http://localhost:8081" class="btn">Iniciar Meus Estudos</a>
            </div>
            <p>Se tiver qualquer dúvida ou precisar de suporte, basta responder a este e-mail.</p>
            <p>Bons estudos!</p>
            <p>Abraços,<br><strong>Equipe Lumina Idiomas</strong></p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Lumina Idiomas. Todos os direitos reservados.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    console.log('[Email Service] Tentando enviar e-mail de Boas-Vindas para:', toEmail);
    const info = await transporter.sendMail({
      from: fromHeader,
      to: toEmail,
      subject: '✨ Bem-vindo à Lumina Idiomas!',
      html: htmlContent,
    });

    console.log(`[Email Service] Welcome email successfully queued/sent to: ${toEmail}`);

    // If using Ethereal test account, output the URL to click and view it!
    if (nodemailer.getTestMessageUrl(info)) {
      console.log(`👉 Preview Welcome Email here: ${nodemailer.getTestMessageUrl(info)}`);
    }
  } catch (error) {
    console.error('[Email Service] Failed to send email:', error.message);
  }
};

/**
 * Sends a password reset token/link email.
 * @param {string} toEmail 
 * @param {string} userName 
 * @param {string} token 
 */
exports.sendPasswordResetEmail = async (toEmail, userName, token) => {
  try {
    const transporter = await createTransporter();
    if (!transporter) return;

    const fromHeader = process.env.SMTP_FROM || `"Lumina Idiomas" <${process.env.SMTP_USER || 'suporte@luminaidiomas.com.br'}>`;

    // We can use a simple localhost web link or just display the token/code
    const resetUrl = `http://localhost:8333/auth/reset-password-page?token=${token}`;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Recuperação de Senha - Lumina Idiomas</title>
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background-color: #F1F5F9;
            margin: 0;
            padding: 0;
            color: #1E293B;
          }
          .container {
            max-width: 600px;
            margin: 40px auto;
            background-color: #FFFFFF;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
          }
          .header {
            background-color: #0E7490;
            padding: 30px 20px;
            text-align: center;
          }
          .header h1 {
            color: #FFFFFF;
            margin: 0;
            font-size: 24px;
          }
          .content {
            padding: 30px;
            line-height: 1.6;
          }
          .content h2 {
            color: #0E7490;
            font-size: 18px;
            margin-top: 0;
          }
          .token-box {
            background-color: #F8FAFC;
            border: 1px dashed #0E7490;
            padding: 15px;
            font-family: monospace;
            font-size: 14px;
            word-break: break-all;
            margin: 20px 0;
            border-radius: 6px;
            text-align: center;
          }
          .btn-container {
            text-align: center;
            margin: 35px 0;
          }
          .btn {
            background-color: #0E7490;
            color: #FFFFFF !important;
            padding: 14px 28px;
            text-decoration: none;
            border-radius: 8px;
            font-weight: bold;
            display: inline-block;
          }
          .footer {
            background-color: #F8FAFC;
            padding: 20px;
            text-align: center;
            font-size: 12px;
            color: #64748B;
            border-top: 1px solid #E2E8F0;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Lumina Idiomas</h1>
          </div>
          <div class="content">
            <h2>Olá, ${userName}!</h2>
            <p>Recebemos uma solicitação para redefinir a senha da sua conta.</p>
            <p>Se você não fez essa solicitação, pode ignorar este e-mail com segurança.</p>
            <p>Para prosseguir com a redefinição de sua senha, clique no botão abaixo:</p>
            <div class="btn-container">
              <a href="${resetUrl}" class="btn">Redefinir Minha Senha</a>
            </div>
            <p>Ou, se preferir, você pode copiar e colar o token abaixo na página de alteração do aplicativo:</p>
            <div class="token-box">${token}</div>
            <p>Este link e código expiram em 15 minutos.</p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Lumina Idiomas. Todos os direitos reservados.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    console.log('[Email Service] Tentando enviar e-mail de Redefinição de Senha para:', toEmail);
    const info = await transporter.sendMail({
      from: fromHeader,
      to: toEmail,
      subject: '🔒 Recuperação de Senha - Lumina Idiomas',
      html: htmlContent,
    });

    console.log(`[Email Service] Password reset email sent to: ${toEmail}`);
    if (nodemailer.getTestMessageUrl(info)) {
      console.log(`👉 Preview Password Reset Email here: ${nodemailer.getTestMessageUrl(info)}`);
    }
  } catch (error) {
    console.error('[Email Service] Failed to send password reset email:', error.message);
  }
};

/**
 * Sends a confirmation email that the password was changed successfully.
 * @param {string} toEmail 
 * @param {string} userName 
 */
exports.sendPasswordChangedEmail = async (toEmail, userName) => {
  try {
    const transporter = await createTransporter();
    if (!transporter) return;

    const fromHeader = process.env.SMTP_FROM || `"Lumina Idiomas" <${process.env.SMTP_USER || 'suporte@luminaidiomas.com.br'}>`;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Senha Alterada com Sucesso - Lumina Idiomas</title>
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background-color: #F1F5F9;
            margin: 0;
            padding: 0;
            color: #1E293B;
          }
          .container {
            max-width: 600px;
            margin: 40px auto;
            background-color: #FFFFFF;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
          }
          .header {
            background-color: #0E7490;
            padding: 30px 20px;
            text-align: center;
          }
          .header h1 {
            color: #FFFFFF;
            margin: 0;
            font-size: 24px;
          }
          .content {
            padding: 30px;
            line-height: 1.6;
          }
          .content h2 {
            color: #0E7490;
            font-size: 18px;
            margin-top: 0;
          }
          .warning-box {
            background-color: #FFFBEB;
            border-left: 4px solid #F59E0B;
            padding: 15px;
            font-size: 14px;
            margin: 20px 0;
            color: #78350F;
            border-radius: 4px;
          }
          .footer {
            background-color: #F8FAFC;
            padding: 20px;
            text-align: center;
            font-size: 12px;
            color: #64748B;
            border-top: 1px solid #E2E8F0;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Lumina Idiomas</h1>
          </div>
          <div class="content">
            <h2>Olá, ${userName}!</h2>
            <p>Gostaríamos de informar que a senha da sua conta na <strong>Lumina Idiomas</strong> foi alterada com sucesso.</p>
            <div class="warning-box">
              <strong>Não reconhece esta atividade?</strong><br>
              Se você não solicitou a alteração de sua senha, por favor entre em contato com o suporte imediatamente para proteger sua conta.
            </div>
            <p>Se foi você quem fez a alteração, nenhuma ação adicional é necessária. Agora você pode entrar no aplicativo utilizando a nova credencial.</p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Lumina Idiomas. Todos os direitos reservados.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    console.log('[Email Service] Tentando enviar e-mail de Confirmação de Alteração de Senha para:', toEmail);
    const info = await transporter.sendMail({
      from: fromHeader,
      to: toEmail,
      subject: '✅ Senha Alterada com Sucesso - Lumina Idiomas',
      html: htmlContent,
    });

    console.log(`[Email Service] Password change confirmation email sent to: ${toEmail}`);
    if (nodemailer.getTestMessageUrl(info)) {
      console.log(`👉 Preview Password Changed Email here: ${nodemailer.getTestMessageUrl(info)}`);
    }
  } catch (error) {
    console.error('[Email Service] Failed to send password changed email:', error.message);
  }
};
