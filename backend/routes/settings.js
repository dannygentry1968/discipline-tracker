const router = require('express').Router();
const ctrl = require('../controllers/settingsController');
const { requireAuth, requirePerm } = require('../middleware/auth');

router.use(requireAuth);

router.get('/', ctrl.getAll);
router.put('/', requirePerm('manageSettings'), ctrl.update);

// PBIS Resources
router.get('/resources', ctrl.getResources);
router.post('/resources', requirePerm('manageResources'), ctrl.createResource);
router.put('/resources/:id', requirePerm('manageResources'), ctrl.updateResource);
router.delete('/resources/:id', requirePerm('manageResources'), ctrl.deleteResource);

module.exports = router;
