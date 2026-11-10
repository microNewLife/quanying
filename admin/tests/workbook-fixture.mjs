import ExcelJS from 'exceljs';
// Entirely synthetic data: 45 people, 76 certificates across seven categories.
export async function syntheticWorkbook() {
 const workbook = new ExcelJS.Workbook();
 const categories = [['咨询师导师','RZXDS'],['咨询师','RZX'],['咨询师实习','RZXI'],['辅导师','RFD'],['辅导师实习','RFDI'],['科普师','RK'],['好家长','RHJ']];
 const sheets = categories.map(([name]) => {
  const sheet = workbook.addWorksheet(name);
  sheet.addRow(['姓名','昵称','证书编号','初始认证年份','最近认证年份']);
  return sheet;
 });
 for (let i = 0; i < 76; i++) {
  const person = i % 45;
  const category = i < 45 ? person % 7 : (person + 1) % 7;
  sheets[category].addRow([`测试人员${person}`,person === 0 ? 321 : '',`DEA-${categories[category][1]}-${3000000 + person}`,2025,'NA']);
 }
 sheets[0].addRow(sheets[0].getRow(2).values.slice(1));
 workbook.addWorksheet('历史名单');
 workbook.addWorksheet('学号对照表');
 return Buffer.from(await workbook.xlsx.writeBuffer());
}
