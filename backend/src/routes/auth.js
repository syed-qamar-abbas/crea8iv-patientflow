const router = require('express').Router();
const ctrl = require('../controllers/authController');
const auth = require('../middleware/auth');

router.post('/register', ctrl.register);
router.post('/login', ctrl.login);
router.get('/username-availability', ctrl.usernameAvailability);
router.post('/refresh', ctrl.refresh);
router.post('/logout', ctrl.logout);
router.get('/me', auth, ctrl.me);

module.exports = router;
