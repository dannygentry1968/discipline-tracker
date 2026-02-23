const { parse } = require('csv-parse/sync');
const XLSX = require('xlsx');
const path = require('path');

class ImportService {
  /**
   * Parse uploaded file (CSV or Excel) and return rows as array of objects
   */
  parseFile(filePath, options = {}) {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.csv' || ext === '.tsv') {
      return this.parseCSV(filePath, options);
    } else if (['.xlsx', '.xls', '.xlsm'].includes(ext)) {
      return this.parseExcel(filePath, options);
    }
    throw new Error(`Unsupported file type: ${ext}. Use .csv, .tsv, .xlsx, or .xls`);
  }

  parseCSV(filePath, options = {}) {
    const fs = require('fs');
    const content = fs.readFileSync(filePath, 'utf-8');
    const records = parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      delimiter: options.delimiter || ','
    });
    return { rows: records, headers: records.length ? Object.keys(records[0]) : [] };
  }

  parseExcel(filePath, options = {}) {
    const workbook = XLSX.readFile(filePath);
    const sheetName = options.sheet || workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
    const headers = rows.length ? Object.keys(rows[0]) : [];
    return { rows, headers, sheets: workbook.SheetNames };
  }

  /**
   * Apply column mapping: transform raw rows using user-defined field mapping
   * @param {Array} rows - Raw parsed rows
   * @param {Object} mapping - { targetField: sourceColumn } e.g. { firstName: "First Name", grade: "Gr." }
   */
  applyMapping(rows, mapping) {
    return rows.map(row => {
      const mapped = {};
      for (const [targetField, sourceColumn] of Object.entries(mapping)) {
        if (sourceColumn && row[sourceColumn] !== undefined) {
          mapped[targetField] = String(row[sourceColumn]).trim();
        }
      }
      return mapped;
    });
  }

  /**
   * Validate mapped rows against expected fields
   */
  validateStudents(rows) {
    const errors = [];
    const validGrades = ['K','1','2','3','4','5','6'];
    rows.forEach((row, i) => {
      if (!row.firstName) errors.push({ row: i+1, field: 'firstName', error: 'Required' });
      if (!row.lastName) errors.push({ row: i+1, field: 'lastName', error: 'Required' });
      if (!row.grade) errors.push({ row: i+1, field: 'grade', error: 'Required' });
      else if (!validGrades.includes(row.grade)) errors.push({ row: i+1, field: 'grade', error: `Invalid grade: ${row.grade}` });
      if (row.sex && !['M','F'].includes(row.sex.toUpperCase())) errors.push({ row: i+1, field: 'sex', error: 'Must be M or F' });
    });
    return errors;
  }

  validateStaff(rows) {
    const errors = [];
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    rows.forEach((row, i) => {
      if (!row.firstName) errors.push({ row: i+1, field: 'firstName', error: 'Required' });
      if (!row.lastName) errors.push({ row: i+1, field: 'lastName', error: 'Required' });
      if (!row.email) errors.push({ row: i+1, field: 'email', error: 'Required' });
      else if (!emailRegex.test(row.email)) errors.push({ row: i+1, field: 'email', error: 'Invalid email' });
    });
    return errors;
  }
}

module.exports = new ImportService();
