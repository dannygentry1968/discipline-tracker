const router = require('express').Router();
const ctrl = require('../controllers/referralController');
const { requireAuth, requirePerm } = require('../middleware/auth');
const { requireFields } = require('../middleware/validate');

router.use(requireAuth);

router.get('/', ctrl.list);
router.get('/:id', ctrl.get);
router.post('/', requirePerm('createReferral'), requireFields(['type','date']), ctrl.create);
router.put('/:id', requirePerm('editReferral'), ctrl.update);
router.patch('/:id/status', requireAuth, ctrl.updateStatus);
router.delete('/:id', requirePerm('deleteReferral'), ctrl.delete);

module.exports = router;
