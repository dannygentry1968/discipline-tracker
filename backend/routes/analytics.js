const router = require('express').Router();
const ctrl = require('../controllers/analyticsController');
const { requireAuth, requirePerm } = require('../middleware/auth');

router.use(requireAuth);

router.get('/summary', ctrl.summary);
router.get('/behaviors', ctrl.byBehavior);
router.get('/locations', ctrl.byLocation);
router.get('/grades', ctrl.byGrade);
router.get('/day-of-week', ctrl.byDayOfWeek);
router.get('/monthly', ctrl.byMonth);
router.get('/time-blocks', ctrl.byTimeBlock);
router.get('/students', requirePerm('viewAnalytics'), ctrl.studentSummary);
router.get('/staff', requirePerm('viewAnalytics'), ctrl.staffSummary);
router.get('/recidivism', requirePerm('viewAnalytics'), ctrl.recidivism);
router.get('/export', requirePerm('exportData'), ctrl.exportAll);

module.exports = router;
