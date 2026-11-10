import ExcelJS from 'exceljs';

export const qualifications = ['咨询师导师', '咨询师', '咨询师实习', '辅导师', '辅导师实习', '科普师', '好家长'];
const prefixes: Record<string, string> = { 咨询师导师: 'RZXDS', 咨询师: 'RZX', 咨询师实习: 'RZXI', 辅导师: 'RFD', 辅导师实习: 'RFDI', 科普师: 'RK', 好家长: 'RHJ' };
export interface ImportRow {
  name: string; nickname: string; certificate_no: string; qualification: string;
  initial_year: number | null; recent_year: number | null; sheet: string; row: number;
  status?: string; reason?: string;
}
export interface ParsedWorkbook { rows: ImportRow[]; issues: ImportRow[]; ignored: string[]; duplicates: number; hash: string }
function text(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    if ('richText' in value) return value.richText.map(t => t.text).join('').trim();
    throw new Error('不支持公式、日期对象或链接单元格，请转换为文本/年份后导入');
  }
  return String(value).trim();
}
function year(value: string): number | null {
  if (!value || value.toUpperCase() === 'NA') return null;
  if (!/^(19|20)\d{2}$/.test(value)) throw new Error('认证年份必须是四位年份');
  return Number(value);
}
export async function parseWorkbook(buffer: ArrayBuffer): Promise<ParsedWorkbook> {
  if (buffer.byteLength > 10 * 1024 * 1024) throw new Error('文件不能超过 10 MB');
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  const hash = Array.from(new Uint8Array(digest), n => n.toString(16).padStart(2, '0')).join('');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const rows: ImportRow[] = [], issues: ImportRow[] = [], ignored: string[] = [];
  let count = 0;
  for (const sheet of workbook.worksheets) {
    if (!qualifications.includes(sheet.name)) { ignored.push(sheet.name); continue; }
    if (sheet.rowCount > 10000) throw new Error('工作表超过 10000 行，请移除多余区域');
    const headers = new Map<string, number>();
    sheet.getRow(1).eachCell((cell, col) => {
      const name = text(cell.value);
      if (name && headers.has(name)) throw new Error(`${sheet.name} 存在重复列名：${name}`);
      if (name) headers.set(name, col);
    });
    for (const h of ['姓名', '昵称', '证书编号', '初始认证年份', '最近认证年份']) {
      if (!headers.has(h)) throw new Error(`${sheet.name} 缺少列：${h}`);
    }
    sheet.eachRow((source, index) => {
      if (index === 1) return;
      const values = [...headers.values()].map(col => source.getCell(col).value);
      if (values.every(v => v === null || v === undefined || v === '')) return;
      if (++count > 5000) throw new Error('有效记录超过 5000 条');
      const row: ImportRow = { sheet: sheet.name, row: index, name: '', nickname: '', certificate_no: '', qualification: sheet.name, initial_year: null, recent_year: null };
      try {
        const get = (h: string) => text(source.getCell(headers.get(h)!).value);
        row.name = get('姓名'); row.nickname = get('昵称'); row.certificate_no = get('证书编号').toUpperCase();
        row.initial_year = year(get('初始认证年份')); row.recent_year = year(get('最近认证年份'));
        if (!row.name || row.name.length > 100 || row.nickname.length > 100) throw new Error('姓名不能为空，姓名/昵称不超过 100 字');
        if (!new RegExp(`^DEA-${prefixes[sheet.name]}-[0-9]{7}$`).test(row.certificate_no)) throw new Error('证书编号格式或资格分类不匹配');
        if (!row.initial_year || (row.recent_year && row.recent_year < row.initial_year)) throw new Error('初始年份缺失或最近年份早于初始年份');
        rows.push(row);
      } catch (e) { issues.push({ ...row, status: 'invalid', reason: (e as Error).message }); }
    });
  }
  if (!count) throw new Error('没有找到支持的认证工作表和数据');
  // Exclude every occurrence of a contradictory certificate, never silently choose the first.
  const groups = new Map<string, ImportRow[]>();
  for (const r of rows) groups.set(r.certificate_no, [...(groups.get(r.certificate_no) || []), r]);
  const valid: ImportRow[] = []; let duplicates = 0;
  const signature = (r: ImportRow) => JSON.stringify([r.name,r.nickname,r.qualification,r.initial_year,r.recent_year]);
  for (const group of groups.values()) {
    if (new Set(group.map(signature)).size > 1) {
      issues.push(...group.map(r => ({ ...r, status: 'conflict', reason: '文件内同一证书内容冲突，请修正后重新导入' })));
    } else { valid.push(group[0]!); duplicates += group.length - 1; }
  }
  return { rows: valid, issues, ignored, duplicates, hash };
}
