const router = require('express').Router();
const ctrl = require('../controllers/permissionController');
const { requireAuth, requirePerm } = require('../middleware/auth');

router.use(requireAuth);

router.get('/', ctrl.getMatrix);
router.put('/:role', requirePerm('managePermissions'), ctrl.updateRole);
router.post('/reset', requirePerm('managePermissions'), ctrl.resetDefaults);

module.exports = router;
