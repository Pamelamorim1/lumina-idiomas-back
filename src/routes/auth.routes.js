// Caminho: backend/src/routes/auth.routes.js

const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const profileController = require('../controllers/profile.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const { uploadAvatarPhoto, handleUploadError } = require('../middlewares/upload.middleware');

router.get('/check-email', authController.checkEmail);
router.post('/signup', authController.signup);
router.post('/login', authController.login);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);
router.post('/change-password', authMiddleware, authController.changePassword);
router.patch('/profile', authMiddleware, profileController.updateProfile);
router.post(
  '/profile/photo',
  authMiddleware,
  uploadAvatarPhoto,
  handleUploadError,
  profileController.uploadPhoto
);
router.get('/me', authMiddleware, authController.getMe);
router.post('/select-language', authMiddleware, authController.selectLanguage);
router.post('/select-objective', authMiddleware, authController.selectObjective);
router.get('/objectives', authMiddleware, authController.getObjectives);
router.post('/select-starting-point', authMiddleware, authController.selectStartingPoint);
router.get('/current-lesson', authMiddleware, authController.getCurrentLesson);
router.post('/complete-lesson', authMiddleware, authController.completeLesson);

module.exports = router;
