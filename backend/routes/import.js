const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { requireAuth, requirePerm } = require('../middleware/auth');
const importService = require('../services/importService');

// Configure multer for file uploads
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB max

router.use(requireAuth);

// Upload and preview (parse + return headers + first 10 rows)
router.post('/preview', requirePerm('manageStudents'), upload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const result = importService.parseFile(req.file.path);
    res.json({
      filename: req.file.originalname,
      filePath: req.file.path,
      headers: result.headers,
      sheets: result.sheets || null,
      totalRows: result.rows.length,
      preview: result.rows.slice(0, 10)
    });
  } catch (err) {
    res.status(400).json({ error: 'Failed to parse file', detail: err.message });
  }
});

// Apply mapping and validate
router.post('/validate', requirePerm('manageStudents'), (req, res) => {
  try {
    const { filePath, mapping, type, sheet } = req.body;
    if (!filePath || !mapping) return res.status(400).json({ error: 'filePath and mapping required' });

    const result = importService.parseFile(filePath, { sheet });
    const mapped = importService.applyMapping(result.rows, mapping);
    const errors = type === 'staff'
      ? importService.validateStaff(mapped)
      : importService.validateStudents(mapped);

    res.json({
      totalRows: mapped.length,
      validRows: mapped.length - new Set(errors.map(e => e.row)).size,
      errors,
      preview: mapped.slice(0, 10)
    });
  } catch (err) {
    res.status(400).json({ error: 'Validation failed', detail: err.message });
  }
});

// Clean up uploaded files older than 1 hour
router.delete('/cleanup', requirePerm('manageSettings'), (req, res) => {
  const cutoff = Date.now() - 3600000;
  const files = fs.readdirSync(uploadDir);
  let cleaned = 0;
  files.forEach(f => {
    const fp = path.join(uploadDir, f);
    const stat = fs.statSync(fp);
    if (stat.mtimeMs < cutoff) { fs.unlinkSync(fp); cleaned++; }
  });
  res.json({ cleaned });
});

module.exports = router;
