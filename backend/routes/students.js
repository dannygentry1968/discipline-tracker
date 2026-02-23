const router = require('express').Router();
const ctrl = require('../controllers/studentController');
const { requireAuth, requirePerm } = require('../middleware/auth');
const { requireFields } = require('../middleware/validate');

router.use(requireAuth);

router.get('/', ctrl.list);
router.get('/export', requirePerm('exportData'), ctrl.export);
router.get('/:id', ctrl.get);
router.post('/', requirePerm('manageStudents'), requireFields(['firstName','lastName','grade']), ctrl.create);
router.put('/:id', requirePerm('manageStudents'), requireFields(['firstName','lastName','grade']), ctrl.update);
router.delete('/:id', requirePerm('manageStudents'), ctrl.delete);
router.post('/bulk-import', requirePerm('manageStudents'), ctrl.bulkImport);

module.exports = router;
