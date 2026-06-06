// Caminho: backend/src/middlewares/auth.middleware.js

const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_change_me_in_production';

module.exports = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({
      success: false,
      message: 'Token de autenticação não fornecido.',
      data: null
    });
  }

  const parts = authHeader.split(' ');

  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return res.status(401).json({
      success: false,
      message: 'Token malformatado.',
      data: null
    });
  }

  const token = parts[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    // Attach the verified user ID from the token payload to the request object
    req.userId = decoded.id;
    return next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: 'Token inválido ou expirado.',
      data: null
    });
  }
};
