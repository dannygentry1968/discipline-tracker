const router = require('express').Router();
const ctrl = require('../controllers/staffController');
const { requireAuth, requirePerm } = require('../middleware/auth');
const { requireFields } = require('../middleware/validate');

router.use(requireAuth);

router.get('/', ctrl.list);
router.get('/:id', ctrl.get);
router.post('/', requirePerm('manageStaff'), requireFields(['firstName','lastName','email']), ctrl.create);
router.put('/:id', requirePerm('manageStaff'), requireFields(['firstName','lastName','email']), ctrl.update);
router.post('/:id/reset-password', requirePerm('manageStaff'), ctrl.resetPassword);
router.delete('/:id', requirePerm('manageStaff'), ctrl.delete);
router.post('/bulk-import', requirePerm('manageStaff'), ctrl.bulkImport);

module.exports = router;
