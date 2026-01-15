/**
 * Transaction Utilities
 * ฟังก์ชันประมวลผลข้อมูลธุรกรรมที่ใช้ร่วมกันได้ทั้ง Web และ Native (Expo)
 */

export const detectBank = (text: string): string => {
    if (text.includes('KASIKORNBANK') || text.includes('กสิกรไทย')) return 'KBank';
    if (text.includes('SCB') || text.includes('ไทยพาณิชย์')) return 'SCB';
    if (text.includes('Krungthai') || text.includes('กรุงไทย')) return 'Krungthai';
    if (text.includes('Bangkok Bank') || text.includes('กรุงเทพ')) return 'BBL';
    if (text.includes('Krungsri') || text.includes('บัตรเครดิต/สินเชื่อ')) return 'Krungsri';
    return 'Unknown';
};

export const extractAmount = (text: string, bank: string = 'Unknown'): number => {
    let possibleAmounts: { val: number, score: number }[] = [];
    const amountKeywords = ['ยอดชำระทั้งหมด', 'ยอดรวม', 'ยอดชำระ', 'จำนวนเงิน', 'amount', 'total', 'ชำระเงิน', 'paid amount', 'บาท'];

    if (bank === 'KBank') amountKeywords.push('จำนวน:');
    if (bank === 'SCB') amountKeywords.push('จำนวนเงิน (Baht)');

    const units = ['บาท', 'baht', 'thb', '฿'];

    // 1. Scan for Keyword + Number
    const keywordRegex = new RegExp(`(?:${amountKeywords.join('|')})\\s*[:\\-\\s]*([\\d,]+\\.?\\d*)`, 'i');
    const keywordMatch = text.match(keywordRegex);
    if (keywordMatch && keywordMatch[1]) {
        const val = parseFloat(keywordMatch[1].replace(/,/g, ''));
        if (val > 0) possibleAmounts.push({ val, score: 100 });
    }

    // 2. Scan for Number + Unit
    const unitRegex = new RegExp(`([\\d,]+\\.?\\d*)\\s*(?:${units.join('|')})`, 'i');
    const unitMatch = text.match(unitRegex);
    if (unitMatch && unitMatch[1]) {
        const val = parseFloat(unitMatch[1].replace(/,/g, ''));
        if (val > 0) possibleAmounts.push({ val, score: 80 });
    }

    // 3. Just some number that looks like an amount
    const anyAmountRegex = /[\d,]+\.\d{2}/g;
    const anyMatches = text.match(anyAmountRegex);
    if (anyMatches) {
        anyMatches.forEach(m => {
            const val = parseFloat(m.replace(/,/g, ''));
            if (val > 0) possibleAmounts.push({ val, score: 50 });
        });
    }

    if (possibleAmounts.length === 0) return 0;

    // Return the one with the highest score
    return possibleAmounts.sort((a, b) => b.score - a.score)[0].val;
};

export interface Transaction {
    id: string;
    amount: number;
    type: 'income' | 'expense';
    category: string;
    date: string;
    note: string;
    refNo?: string;
    receiverName?: string;
}

export const extractReceiver = (text: string): string | null => {
    const clean = (name: string) => {
        return name.replace(/\b\d{3,5}\b/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    };

    const toPatterns = [
        /ไปยัง\s*([ก-๙a-zA-Z0-9\s\.\/\-\(\)#]+?)(?:\s|$|บัญชี|เลขที่|Biller)/,
        /To\s*([ก-๙a-zA-Z0-9\s\.\/\-\(\)#]+?)(?:\s|$|Account|Number|Biller)/,
        /รับเงินโดย\s*([ก-๙a-zA-Z0-9\s\.\/\-\(\)#]+?)(?:\s|$)/,
        /Transfer to\s*([ก-๙a-zA-Z0-9\s\.\/\-\(\)#]+?)(?:\s|$)/,
        /ชำระค่า\s*([ก-๙a-zA-Z0-9\s\.\/\-\(\)#]+?)(?:\s|$)/,
        /จ่ายบิล\s*([ก-๙a-zA-Z0-9\s\.\/\-\(\)#]+?)(?:\s|สำเร็จ|$)/
    ];

    for (const pattern of toPatterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
            const name = match[1].trim();
            if (name.length > 2 && !['ออมทรัพย์', 'Savings', 'Account', 'Bank'].includes(name)) {
                return clean(name);
            }
        }
    }

    const accountRegex = /[X\d]{3}-[X\d]-[X\d]{5}-[X\d]|[X\d]{3}-[X\d]{1,2}-[X\d]{4,6}-[X\d]/g;
    const accountMatches = Array.from(text.matchAll(accountRegex));

    if (accountMatches.length >= 2) {
        const secondAccountIndex = accountMatches[1].index || 0;
        const textBeforeSecondAccount = text.substring(0, secondAccountIndex);
        const linesBefore = textBeforeSecondAccount.split(/[\n\r]+/);

        for (let i = linesBefore.length - 1; i >= 0; i--) {
            const line = linesBefore[i].trim();
            if (line.length > 2 && !['ไปยัง', 'To', 'โอนเงิน', 'เงินสด', 'สำเร็จ'].some(k => line.includes(k))) {
                return clean(line);
            }
        }
    }

    const nameMatch = text.match(/([ก-๙a-zA-Z\s\.\/]+)\s*[\n\r]+\s*[X\d]{3}-[X\d]-[X\d]{5}-[X\d]/);
    if (nameMatch && text.indexOf(nameMatch[0]) > 50) {
        return clean(nameMatch[1]);
    }

    const billerMatch = text.match(/ไปยัง\s*[:\s]*([ก-๙a-zA-Z0-9\s\.]+?)\s+Biller ID/);
    if (billerMatch) return clean(billerMatch[1]);

    return null;
};

export const extractRefNo = (text: string): string | null => {
    const patterns = [
        /(?:เลขที่อ้างอิง|Ref(?:\.|\s)?No|Transaction ID|เลขที่รายการ|รหัสอ้างอิง)[:\s]*([A-Z0-9]{10,})/i,
        /(\d{10,30})/
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
            return match[1].trim();
        }
    }
    return null;
};

export const extractDate = (text: string): string | null => {
    const slashDatePattern = /(\d{1,2})\/(\d{1,2})\/(\d{4})/;
    const slashMatch = text.match(slashDatePattern);
    if (slashMatch) {
        let day = slashMatch[1].padStart(2, '0');
        let month = slashMatch[2].padStart(2, '0');
        let year = parseInt(slashMatch[3]);
        if (year < 2400) year += 543;
        return `${day}/${month}/${year}`;
    }

    const thMonths: { [key: string]: string } = {
        'ม.ค.': '01', 'ก.พ.': '02', 'มี.ค.': '03', 'เม.ย.': '04', 'พ.ค.': '05', 'มิ.ย.': '06',
        'ก.ค.': '07', 'ส.ค.': '08', 'ก.ย.': '09', 'ต.ค.': '10', 'พ.ย.': '11', 'ธ.ค.': '12',
        'มกราคม': '01', 'กุมภาพันธ์': '02', 'มีนาคม': '03', 'เมษายน': '04', 'พฤษภาคม': '05', 'มิถุนายน': '06',
        'กรกฎาคม': '07', 'สิงหาคม': '08', 'กันยายน': '09', 'ตุลาคม': '10', 'พฤศจิกายน': '11', 'ธันวาคม': '12'
    };

    const thDaysPattern = '(\\d{1,2})';
    const thMonthsPattern = '(' + Object.keys(thMonths).join('|').replace(/\./g, '\\.') + ')';
    const thYearsPattern = '(\\d{2,4})';
    const thDateRegex = new RegExp(`${thDaysPattern}\\s*${thMonthsPattern}\\s*${thYearsPattern}`, 'i');

    const thMatch = text.match(thDateRegex);
    if (thMatch) {
        let day = thMatch[1].padStart(2, '0');
        let month = thMonths[thMatch[2]] || '01';
        let year = parseInt(thMatch[3]);
        if (year < 100) year += 2500;
        else if (year < 2400) year += 543;
        return `${day}/${month}/${year}`;
    }

    const enMonths: { [key: string]: string } = {
        'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04', 'May': '05', 'Jun': '06',
        'Jul': '07', 'Aug': '08', 'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
    };

    const enDatePattern = /(\d{1,2})\s*([a-zA-Z]{3,})\s*(\d{2,4})/;
    const enMatch = text.match(enDatePattern);
    if (enMatch) {
        let shortMonth = enMatch[2].substring(0, 3);
        if (enMonths[shortMonth]) {
            let day = enMatch[1].padStart(2, '0');
            let month = enMonths[shortMonth];
            let year = parseInt(enMatch[3]);
            if (year < 100) year += 2000;
            return `${day}/${month}/${year + 543}`;
        }
    }

    return null;
};

export const getCategoryFromText = (text: string, type: 'income' | 'expense', receiver?: string | null, categoryPreferences: { [key: string]: string } = {}) => {
    if (type === 'income') return 'รายได้';

    if (receiver && categoryPreferences[receiver]) {
        return categoryPreferences[receiver];
    }

    const categoryMap: { [key: string]: { keywords: string[], weight: number } } = {
        'อาหารและเครื่องดื่ม': {
            keywords: ['กิน', 'ทอด', 'ย่าง', 'ปิ้ง', 'ข้าว', 'น้ำ', 'กาแฟ', 'อร่อย', 'ชา', 'ขนม', 'ส้มตำ', 'ก๋วยเตี๋ยว', 'บุฟเฟต์', 'บุฟเฟ่ต์', 'มื้อ', 'อาหาร', 'ค่าอาหาร', 'GrabFood', 'Lineman', 'Foodpanda', 'ShopeeFood', 'เซเว่น', 'คาเฟ่', 'KFC', 'McDonald', 'Starbucks'],
            weight: 1.2
        },
        'การเดินทาง': {
            keywords: ['รถ', 'น้ำมัน', 'วิน', 'แท็กซี่', 'BTS', 'MRT', 'เรือ', 'ตั๋วเครื่องบิน', 'ทางด่วน', 'ที่จอดรถ', 'GrabCar', 'Bolt', 'ล้างรถ', 'ซ่อมรถ', 'ปั๊ม', 'เติมน้ำมัน', 'PT', 'TOYOTA', 'Shell', 'Bangchak', 'PTT', 'CALTEX', 'Esso', 'Susco'],
            weight: 1.2
        },
        'ของใช้จำเป็น': {
            keywords: ['ทิชชู่', 'สบู่', 'ยาสีฟัน', 'ผงซักฟอก', 'ของแห้ง', 'ตลาด', 'ซุปเปอร์', 'ของใช้ส่วนตัว', 'ผ้าอนามัย', 'แชมพู', 'โลตัส', 'บิ๊กซี', 'Lotus', 'LOTUS', 'BigC', 'BIGC', 'Watson', 'CJ', '7-Eleven', 'CP FreshMart'],
            weight: 1.0
        },
        'สุขภาพ': {
            keywords: ['ยา', 'หมอ', 'โรงพยาบาล', 'คลินิก', 'วิตามิน', 'หมอฟัน', 'หาหมอ', 'ฟิตเนส', 'แว่นตา', 'ตรวจสุขภาพ', 'Pharmacy', 'Health', 'Allianz', 'AIA', 'FWD', 'Prudential', 'LIFE', 'ประกัน', 'MSIG', 'Insurance', 'KGIB'],
            weight: 1.5
        },
        'สินเชื่อ บัตรเครดิต': {
            keywords: [
                'บัตรเครดิต', 'สินเชื่อ', 'งวด', 'ดอกเบี้ย', 'จ่ายบัตร', 'กรุงศรีเฟิร์สช้อยส์', 'KTC', 'กู้', 'ผ่อนรถ', 'ผ่อนบ้าน', 'ส่งบ้าน', 'ค่าบ้าน', 'Credit Card', 'Loan', 'Leasing',
                'เฟิร์สช้อยส์', 'First Choice', 'Central The 1', 'เซ็นทรัล เดอะวัน', 'เดอะวัน', 'Krungsri', 'โอน:ธุรกิจ'
            ],
            weight: 1.4
        },
        'บันเทิง': {
            keywords: ['ดูหนัง', 'คอนเสิร์ต', 'เกม', 'เติมเกม', 'ปาร์ตี้', 'เหล้า', 'เบียร์', 'คาราโอเกะ', 'Netflix', 'Spotify', 'Youtube Premium', 'Cinema', 'แพคเก็จ'],
            weight: 1.1
        },
        'ช็อปปิ้ง': {
            keywords: ['ซื้อ', 'เสื้อ', 'กางเกง', 'รองเท้า', 'ของใช้', 'ห้าง', 'Lazada', 'Shopee', 'ลาซาด้า', 'ช้อปปี้', 'ชอปปี้', 'ไดโซะ', 'เครื่องสำอาง', 'น้ำหอม', 'Mall'],
            weight: 1.0
        },
        'สาธารณูปโภค': {
            keywords: ['การไฟฟ้า', 'การประปา', 'ค่าไฟ', 'ค่าน้ำ', 'MEA', 'PEA', 'MWA', 'PWA'],
            weight: 2.0
        }
    };

    let bestCategory = 'อื่นๆ';
    let maxScore = 0;

    for (const [cat, config] of Object.entries(categoryMap)) {
        let matches = 0;
        config.keywords.forEach(k => {
            if (text.toUpperCase().includes(k.toUpperCase())) {
                matches++;
            }
        });

        if (matches > 0) {
            const score = matches * config.weight;
            if (score > maxScore) {
                maxScore = score;
                bestCategory = cat;
            }
        }
    }

    return bestCategory;
};

export const parseNaturalLanguage = (text: string) => {
    const amountMatch = text.match(/[\d,.]+/);
    const amount = amountMatch ? parseFloat(amountMatch[0].replace(/,/g, '')) : 0;
    if (amount === 0) return null;
    let type: 'income' | 'expense' = 'expense';

    const incomeKeywords = [
        'เงินเดือน', 'ได้เงิน', 'เข้า', 'รายรับ', 'โอนเข้า', 'ถอนเงิน', 'ค่าคอม',
        'รับ', 'รับเงิน', 'ขาย', 'ขายของ', 'ขายได้', 'กำไร', 'โบนัส', 'ทิป',
        'ถูกหวย', 'สลาก', 'ปันผล', 'มรดก', 'คืนเงิน'
    ];

    if (incomeKeywords.some(k => text.includes(k))) type = 'income';

    let category = getCategoryFromText(text, type);
    const categoryMatch = text.match(/หมวด\s*([ก-๙a-zA-Z]+)/);
    if (categoryMatch) {
        const catKeyword = categoryMatch[1];
        const categoryMapping: { [key: string]: string } = {
            'อาหาร': 'อาหารและเครื่องดื่ม',
            'กิน': 'อาหารและเครื่องดื่ม',
            'ทอด': 'อาหารและเครื่องดื่ม',
            'ย่าง': 'อาหารและเครื่องดื่ม',
            'ปิ้ง': 'อาหารและเครื่องดื่ม',
            'เดินทาง': 'การเดินทาง',
            'รถ': 'การเดินทาง',
            'จำเป็น': 'ของใช้จำเป็น',
            'ใช้จ่าย': 'ของใช้จำเป็น',
            'สุขภาพ': 'สุขภาพ',
            'ยา': 'สุขภาพ',
            'หนี้': 'สินเชื่อ บัตรเครดิต',
            'บัตร': 'สินเชื่อ บัตรเครดิต',
            'บันเทิง': 'บันเทิง',
            'เกม': 'บันเทิง',
            'ช้อปปิ้ง': 'ช็อปปิ้ง',
            'ซื้อของ': 'ช็อปปิ้ง',
            'บ้าน': 'ของใช้ในบ้าน',
            'น้ำไฟ': 'สาธารณูปโภค'
        };

        for (const [key, val] of Object.entries(categoryMapping)) {
            if (catKeyword.includes(key)) {
                category = val;
                break;
            }
        }
    }

    let note = text.replace(/[\d,]+/g, '')
        .replace(/บาท|บ\./g, '')
        .replace(/หมวด\s*[ก-๙a-zA-Z]+/g, '')
        .trim();
    if (!note) note = type === 'income' ? 'รายรับเพิ่มขึ้น' : 'รายจ่ายใหม่';
    return { amount, type, note, category };
};

export const simplifyMerchantName = (name: string) => {
    const upperName = name.toUpperCase();
    if (upperName.includes('PT ') || upperName.includes('PT.')) return 'เติมน้ำมัน PT';
    if (upperName.includes('SHELL')) return 'เติมน้ำมัน Shell';
    if (upperName.includes('BANGCHAK')) return 'เติมน้ำมัน บางจาก';
    if (upperName.includes('PTT')) return 'เติมน้ำมัน PTT';
    if (upperName.includes('CALTEX')) return 'เติมน้ำมัน Caltex';
    if (upperName.includes('ESSO')) return 'เติมน้ำมัน Esso';
    if (upperName.includes('TOYOTA')) return 'เช็ครถ TOYOTA';
    if (upperName.includes('ALLIANZ') || upperName.includes('KGIB')) return 'ประกัน Allianz';
    if (upperName.includes('MSIG')) return 'ประกัน MSIG';
    if (upperName.includes('BANGKOK LIFE')) return 'ประกัน Bangkok Life';
    if (upperName.includes('7-ELEVEN')) return '7-Eleven';
    if (upperName.includes('LOTUS\'S') || upperName.includes('LOTUS')) return 'Lotus';
    if (upperName.includes('BIGC')) return 'BigC';
    if (upperName.includes('WATSON')) return 'Watson';
    if (upperName.includes('CJ')) return 'CJ';
    if (upperName.includes('CP')) return 'CP';
    return name;
};

export const detectMultiTransactions = (text: string, categoryPreferences: { [key: string]: string } = {}): Transaction[] => {
    const rowRegex = /([ก-๙a-zA-Z0-9_.\s\(\)-:/&']+?)\s+([\d,]+\.\d{2})\s*(?:บาท|THB|thb|บาก|บ|ฯ)?/gi;
    const multiTxFound: Transaction[] = [];
    let rowMatch;

    const slipDate = extractDate(text) || new Date().toLocaleDateString('th-TH');

    while ((rowMatch = rowRegex.exec(text)) !== null) {
        let rawName = rowMatch[1].trim();
        const rawAmount = parseFloat(rowMatch[2].replace(/,/g, ''));

        // Clean names of leading dates interleaved from OCR (e.g. "05 ธ.ค.")
        rawName = rawName.replace(/^\d{2}\s+[ก-๙]{1,3}\.?\s*/, '').trim();

        if (rawName.length < 3) continue;

        const category = getCategoryFromText(rawName, 'expense', rawName, categoryPreferences);
        const simplifiedName = simplifyMerchantName(rawName);

        multiTxFound.push({
            id: (Date.now() + Math.random()).toString(),
            amount: rawAmount,
            type: 'expense',
            category: category,
            date: slipDate,
            note: `${simplifiedName} (จ่ายบัตร)`,
            receiverName: rawName
        });
    }

    return multiTxFound;
};
export const isDuplicateTransaction = (newTx: Partial<Transaction>, existingTxs: Transaction[]): boolean => {
    return existingTxs.some(tx => {
        // 1. Check Ref No (Most accurate)
        if (newTx.refNo && tx.refNo && newTx.refNo === tx.refNo) return true;

        // 2. Check combination of Date, Amount, and Category
        const isSameDate = newTx.date === tx.date;
        const isSameAmount = newTx.amount === tx.amount;
        const isSameCategory = newTx.category === tx.category;

        // If it's the exact same amount/date/category within a short time, it's likely a dupe
        if (isSameDate && isSameAmount && isSameCategory) {
            // If they both have receiver names, check those too
            if (newTx.receiverName && tx.receiverName) {
                return newTx.receiverName === tx.receiverName;
            }
            return true;
        }

        return false;
    });
};
