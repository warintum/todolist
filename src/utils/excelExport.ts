import * as XLSX from 'xlsx';
import type { Todo } from './todoTypes';

// สไตล์เส้นขอบตาราง
const borderStyle = {
  top: { style: 'thin' },
  bottom: { style: 'thin' },
  left: { style: 'thin' },
  right: { style: 'thin' },
};

// สไตล์เส้นขอบหนา (สำหรับหัวตาราง)
const borderStyleBold = {
  top: { style: 'medium' },
  bottom: { style: 'medium' },
  left: { style: 'thin' },
  right: { style: 'thin' },
};

// สร้าง cell ด้วยสไตล์
const createCell = (value: string | number, style: any = {}) => ({
  v: value,
  t: typeof value === 'number' ? 'n' : 's',
  s: style,
});

export const exportTodosAsExcel = (todos: Todo[], monthLabel?: string) => {
  if (todos.length === 0) {
    console.warn('No todos to export');
    return;
  }

  // เรียงตามวันที่
  const sortedTodos = [...todos].sort((a, b) => {
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

  // สร้าง worksheet
  const ws: XLSX.WorkSheet = {};
  const range = { s: { c: 0, r: 0 }, e: { c: 3, r: 4 + sortedTodos.length } };
  ws['!ref'] = XLSX.utils.encode_range(range);

  // แถวที่ 1: หัวเรื่องบริษัท (จัดกึ่งกลาง)
  ws['A1'] = createCell('บริษัท โรงงานผลิตภัณฑ์การไฟฟ้าจำกัด', {
    alignment: { horizontal: 'center', vertical: 'center' },
    font: { bold: true },
  });

  // แถวที่ 2: เว้นว่าง
  ws['A2'] = createCell('');

  // แถวที่ 3: หัวเรื่องรายงาน (จัดกึ่งกลาง)
  const reportTitle = monthLabel
    ? `รายงานการทำงานประจำเดือน : ${monthLabel}`
    : 'รายงานการทำงานประจำเดือน';
  ws['A3'] = createCell(reportTitle, {
    alignment: { horizontal: 'center', vertical: 'center' },
  });

  // แถวที่ 4: เว้นว่าง
  ws['A4'] = createCell('');

  // แถวที่ 5: คอลัมน์หัวตาราง (มีเส้นขอบ + จัดกึ่งกลาง)
  const headers = ['ลำดับ', 'รายละเอียด', 'วันที่', 'หมายเหตุ'];
  headers.forEach((header, col) => {
    const cellRef = XLSX.utils.encode_cell({ c: col, r: 4 });
    ws[cellRef] = createCell(header, {
      border: borderStyleBold,
      alignment: { horizontal: 'center', vertical: 'center' },
      font: { bold: true },
    });
  });

  // ข้อมูลงาน (แถวที่ 6 เป็นต้นไป)
  sortedTodos.forEach((todo, index) => {
    const row = 5 + index;
    const date = new Date(todo.createdAt);
    const dateStr = date.toLocaleDateString('th-TH', {
      day: 'numeric',
      month: 'numeric',
      year: 'numeric',
    });

    // ใช้ priority เป็น หมายเหตุ
    const note = (todo as any).note ||
      (todo.priority === 'high' ? 'สูง' :
        todo.priority === 'medium' ? 'ปานกลาง' : 'ต่ำ');

    // ลำดับ (จัดกึ่งกลาง)
    ws[XLSX.utils.encode_cell({ c: 0, r: row })] = createCell(index + 1, {
      border: borderStyle,
      alignment: { horizontal: 'center', vertical: 'center' },
    });

    // รายละเอียด (ชิดซ้าย)
    ws[XLSX.utils.encode_cell({ c: 1, r: row })] = createCell(todo.text, {
      border: borderStyle,
      alignment: { horizontal: 'left', vertical: 'center' },
    });

    // วันที่ (จัดกึ่งกลาง)
    ws[XLSX.utils.encode_cell({ c: 2, r: row })] = createCell(dateStr, {
      border: borderStyle,
      alignment: { horizontal: 'center', vertical: 'center' },
    });

    // หมายเหตุ (จัดกึ่งกลาง)
    ws[XLSX.utils.encode_cell({ c: 3, r: row })] = createCell(note, {
      border: borderStyle,
      alignment: { horizontal: 'center', vertical: 'center' },
    });
  });

  // กำหนดความกว้างคอลัมน์
  ws['!cols'] = [
    { wch: 8 },   // ลำดับ
    { wch: 60 },  // รายละเอียด
    { wch: 12 },  // วันที่
    { wch: 20 },  // หมายเหตุ
  ];

  // กำหนดความสูงแถว
  ws['!rows'] = [
    { hpt: 20 },  // แถว 1
    { hpt: 10 },  // แถว 2 (เว้นว่าง)
    { hpt: 20 },  // แถว 3
    { hpt: 10 },  // แถว 4 (เว้นว่าง)
    { hpt: 25 },  // แถว 5 (หัวตาราง)
    ...sortedTodos.map(() => ({ hpt: 22 })), // แถวข้อมูล
  ];

  // กำหนด merges สำหรับหัวเรื่อง (ให้กว้างเต็มตาราง 4 คอลัมน์)
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }, // แถวที่ 1: บริษัท
    { s: { r: 2, c: 0 }, e: { r: 2, c: 3 } }, // แถวที่ 3: รายงาน
  ];

  // สร้าง workbook
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'รายงานการทำงาน');

  // สร้างชื่อไฟล์
  const fileName = monthLabel
    ? `รายงานการทำงาน-${monthLabel.replace(/\s+/g, '-')}.xlsx`
    : `รายงานการทำงาน-${new Date().toISOString().slice(0, 10)}.xlsx`;

  // ดาวน์โหลดไฟล์
  XLSX.writeFile(wb, fileName);
};
