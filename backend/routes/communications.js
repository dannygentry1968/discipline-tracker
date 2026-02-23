const router = require('express').Router();
const ctrl = require('../controllers/communicationController');
const { requireAuth, requirePerm } = require('../middleware/auth');

router.use(requireAuth);
router.get('/', ctrl.list);
router.get('/:id', ctrl.get);
router.post('/', requirePerm('sendCommunications'), ctrl.create);
router.delete('/:id', requirePerm('sendCommunications'), ctrl.delete);

module.exports = router;
