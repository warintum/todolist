import ExcelJS from 'exceljs';
import type { Todo } from './todoTypes';

export const exportTodosAsExcel = async (todos: Todo[], monthLabel?: string) => {
  if (todos.length === 0) {
    console.warn('No todos to export');
    return;
  }

  // เรียงตามวันที่
  const sortedTodos = [...todos].sort((a, b) => {
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

  // สร้าง workbook
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('รายงานการทำงาน');

  // กำหนดความกว้างคอลัมน์
  worksheet.columns = [
    { width: 8 },   // A: ลำดับ
    { width: 80 },  // B: รายละเอียด
    { width: 15 },  // C: วันที่
    { width: 25 },  // D: หมายเหตุ
  ];

  // แถวที่ 1: หัวเรื่องบริษัท (merge A1:D1)
  const companyRow = worksheet.addRow(['บริษัท โรงงานผลิตภัณฑ์อาหารไทย จำกัด']);
  companyRow.height = 25;
  worksheet.mergeCells('A1:D1');

  // จัดสไตล์หัวเรื่องบริษัท
  const companyCell = worksheet.getCell('A1');
  companyCell.font = { bold: true, size: 14 };
  companyCell.alignment = { horizontal: 'center', vertical: 'middle' };

  // แถวที่ 2: หัวเรื่องรายงาน (merge A2:D2)
  const reportTitle = monthLabel
    ? `รายงานการทำงานประจำเดือน : ${monthLabel}`
    : 'รายงานการทำงานประจำเดือน';
  const titleRow = worksheet.addRow([reportTitle]);
  titleRow.height = 25;
  worksheet.mergeCells('A2:D2');

  // จัดสไตล์หัวรายงาน
  const titleCell = worksheet.getCell('A2');
  titleCell.font = { size: 12 };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

  // แถวที่ 3: ชื่อ - นามสกุล   วรินทร์ เข็มแดง (merge A3:B3)
  const nameRow = worksheet.addRow(['ชื่อ - นามสกุล   วรินทร์ เข็มแดง', '', '', '']);
  nameRow.height = 22;
  worksheet.mergeCells('A3:B3');

  // จัดสไตล์ (A3)
  const nameCell = worksheet.getCell('A3');
  nameCell.alignment = { horizontal: 'left', vertical: 'middle' };

  // แถวที่ 4: เว้นว่าง
  worksheet.addRow([]);
  worksheet.getRow(4).height = 10;

  // แถวที่ 5: หัวตาราง
  const headerRow = worksheet.addRow(['ลำดับ', 'รายละเอียด', 'วันที่', 'หมายเหตุ']);
  headerRow.height = 25;

  // จัดสไตล์หัวตาราง
  headerRow.eachCell((cell, colNumber) => {
    cell.font = { bold: true };
    cell.alignment = {
      horizontal: colNumber === 2 ? 'left' : 'center',
      vertical: 'middle'
    };
    cell.border = {
      top: { style: 'medium' },
      bottom: { style: 'medium' },
      left: { style: 'thin' },
      right: { style: 'thin' },
    };
  });

  // ข้อมูลงาน (แถวที่ 6 เป็นต้นไป)
  sortedTodos.forEach((todo, index) => {
    const date = new Date(todo.createdAt);
    const dateStr = date.toLocaleDateString('th-TH', {
      day: 'numeric',
      month: 'numeric',
      year: 'numeric',
    });

    // ใช้ note จาก field หรือเว้นว่าง
    const note = todo.note || '';

    const dataRow = worksheet.addRow([
      index + 1,     // ลำดับ
      todo.text,     // รายละเอียด
      dateStr,       // วันที่
      note           // หมายเหตุ
    ]);
    dataRow.height = 22;

    // จัดสไตล์แต่ละเซลล์
    dataRow.eachCell((cell, colNumber) => {
      cell.border = {
        top: { style: 'thin' },
        bottom: { style: 'thin' },
        left: { style: 'thin' },
        right: { style: 'thin' },
      };

      // ลำดับ (คอลัมน์ 1): กึ่งกลาง
      // รายละเอียด (คอลัมน์ 2): ชิดซ้าย
      // วันที่ (คอลัมน์ 3): กึ่งกลาง
      // หมายเหตุ (คอลัมน์ 4): กึ่งกลาง
      if (colNumber === 2) {
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
      } else {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      }
    });
  });

  // สร้างชื่อไฟล์
  const fileName = monthLabel
    ? `รายงานการทำงาน-${monthLabel.replace(/\s+/g, '-')}.xlsx`
    : `รายงานการทำงาน-${new Date().toISOString().slice(0, 10)}.xlsx`;

  // ดาวน์โหลดไฟล์
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
