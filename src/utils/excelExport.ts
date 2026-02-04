import ExcelJS from 'exceljs';
import type { Todo } from './todoTypes';

// Helper function to convert Thai month name to month number
const thaiMonthToNumber = (monthName: string): string => {
  const thaiMonths: Record<string, string> = {
    'มกราคม': '01',
    'กุมภาพันธ์': '02',
    'มีนาคม': '03',
    'เมษายน': '04',
    'พฤษภาคม': '05',
    'มิถุนายน': '06',
    'กรกฎาคม': '07',
    'สิงหาคม': '08',
    'กันยายน': '09',
    'ตุลาคม': '10',
    'พฤศจิกายน': '11',
    'ธันวาคม': '12',
  };
  
  for (const [thaiMonth, number] of Object.entries(thaiMonths)) {
    if (monthName.includes(thaiMonth)) {
      return number;
    }
  }
  
  return '00';
};

// Helper function to extract year from monthLabel
const extractYear = (monthLabel: string): string => {
  const match = monthLabel.match(/\d{4}/);
  return match ? match[0] : new Date().getFullYear().toString();
};

// Helper function to generate sheet name in format "MM-YYYY"
const generateSheetName = (monthLabel?: string): string => {
  if (!monthLabel) {
    const now = new Date();
    return `${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`;
  }
  
  const month = thaiMonthToNumber(monthLabel);
  const year = extractYear(monthLabel);
  return `${month}-${year}`;
};

// Helper function to get month key from date
const getMonthKey = (date: Date): string => {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

// Helper function to get month label in Thai
const getMonthLabel = (date: Date): string => {
  return date.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });
};

// Helper function to create a worksheet with data
const createWorksheet = (
  workbook: ExcelJS.Workbook,
  sheetName: string,
  todos: Todo[],
  monthLabel: string,
  userName?: string
): void => {
  const worksheet = workbook.addWorksheet(sheetName);

  // กำหนดความกว้างคอลัมน์
  worksheet.columns = [
    { width: 8 },   // A: ลำดับ
    { width: 85 },  // B: รายละเอียด
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
  const reportTitle = `รายงานการทำงานประจำเดือน ${monthLabel}`;
  const titleRow = worksheet.addRow([reportTitle]);
  titleRow.height = 25;
  worksheet.mergeCells('A2:D2');

  // จัดสไตล์หัวรายงาน
  const titleCell = worksheet.getCell('A2');
  titleCell.font = { size: 12 };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

  // แถวที่ 3: ชื่อ - นามสกุล (merge A3:B3)
  const displayName = userName?.trim() || '';
  const nameRow = worksheet.addRow([`ชื่อ - นามสกุล   ${displayName}`, '', '', '']);
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

  // เรียงตามวันที่
  const sortedTodos = [...todos].sort((a, b) => {
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

  // ข้อมูลงาน (แถวที่ 6 เป็นต้นไป)
  sortedTodos.forEach((todo, index) => {
    const date = new Date(todo.createdAt);
    const dateStr = date.toLocaleDateString('th-TH', {
      day: 'numeric',
      month: 'numeric',
      year: 'numeric',
    });

    const note = todo.note || '';

    const dataRow = worksheet.addRow([
      index + 1,
      todo.text,
      dateStr,
      note
    ]);
    dataRow.height = 22;

    dataRow.eachCell((cell, colNumber) => {
      cell.border = {
        top: { style: 'thin' },
        bottom: { style: 'thin' },
        left: { style: 'thin' },
        right: { style: 'thin' },
      };

      if (colNumber === 2) {
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
      } else {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      }
    });
  });
};

export const exportTodosAsExcel = async (todos: Todo[], monthLabel?: string, userName?: string) => {
  if (todos.length === 0) {
    console.warn('No todos to export');
    return;
  }

  const workbook = new ExcelJS.Workbook();

  if (monthLabel) {
    // กรณีเลือกเดือนเฉพาะ - สร้างชีตเดียว
    const sheetName = generateSheetName(monthLabel);
    createWorksheet(workbook, sheetName, todos, monthLabel, userName);
  } else {
    // กรณีไม่เลือกเดือน (ทั้งหมด) - แยกชีตตามเดือน
    const groupedByMonth = new Map<string, Todo[]>();
    
    todos.forEach(todo => {
      const date = new Date(todo.createdAt);
      const monthKey = getMonthKey(date);
      
      if (!groupedByMonth.has(monthKey)) {
        groupedByMonth.set(monthKey, []);
      }
      groupedByMonth.get(monthKey)!.push(todo);
    });

    // เรียงตามเดือน (จากน้อยไปมาก)
    const sortedMonths = Array.from(groupedByMonth.keys()).sort();

    // สร้างชีตสำหรับแต่ละเดือน
    sortedMonths.forEach(monthKey => {
      const monthTodos = groupedByMonth.get(monthKey)!;
      const firstTodo = monthTodos[0];
      const monthLabelForSheet = getMonthLabel(new Date(firstTodo.createdAt));
      const sheetName = monthKey; // Format: "YYYY-MM"
      
      createWorksheet(workbook, sheetName, monthTodos, monthLabelForSheet, userName);
    });
  }

  // สร้างชื่อไฟล์
  const fileName = monthLabel
    ? `รายงานการทำงาน-${monthLabel.replace(/\s+/g, '-')}.xlsx`
    : `รายงานการทำงาน-ทุกเดือน-${new Date().toISOString().slice(0, 10)}.xlsx`;

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
