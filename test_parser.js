// Test script - refined robust version
const ocrTextGridMessy = `COLLEGE EXAM TIME TABLE
BRANCH 31 | 05 | 26 03 \ 05 \ 26 06.05.26
1 CE Civil Engineering
Engineering Mathematics  Structural Analysis  Surveying
2 EEE Electrical & Electronics
Engineering Mathematics-II  Circuit Theory  Electrical Machines
EXAM TIME: 10:00 AM - 1:00 PM`;

function parseTimetableOCR(text) {
    let cleanText = text
        .replace(/\r\n/g, "\n")
        .replace(/\r/g, "\n")
        .replace(/nformation/ig, "Information")
        .replace(/[{]/g, "(")
        .replace(/[}]/g, ")")
        .replace(/['’‘`]/g, "")
        .replace(/[„]/g, "-")
        .replace(/•/g, "-")
        .replace(/ll/g, "II");
    const lines = cleanText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const branchCodes = ["CE", "EEE", "ME", "ECE", "CSE", "CSB", "CSM", "CSD", "CIVIL", "MECHANICAL", "COMPUTER", "ELECTRICAL", "ELECTRONICS"];
    const monthMap = { "JAN": "01", "FEB": "02", "MAR": "03", "APR": "04", "MAY": "05", "JUN": "06", "JUL": "07", "AUG": "08", "SEP": "09", "OCT": "10", "NOV": "11", "DEC": "12" };

    function parseDateStr(str) {
        if (!str) return null;
        str = str.toUpperCase().trim();
        let m = str.match(/(\d{1,2})\s+([A-Z]{3,})\s+(\d{4})/);
        if (m) {
            const day = m[1].padStart(2, '0');
            const monthStr = m[2].substring(0, 3);
            const month = monthMap[monthStr] || "01";
            return `${m[3]}-${month}-${day}`;
        }
        m = str.match(/(\d{1,2})\s*[./\-\s\\|]\s*(\d{1,2})\s*[./\-\s\\|]\s*(\d{2,4})/);
        if (m) {
            const day = m[1].padStart(2, '0');
            const month = m[2].padStart(2, '0');
            let year = m[3].replace(/\s+/g, "");
            if (year.length === 2) year = "20" + year;
            return `${year}-${month}-${day}`;
        }
        return null;
    }

    let globalTime = "09:30 AM - 12:30 PM";
    const timeMatch = text.match(/(?:EXAM TIME|TIME):\s*([\d:APM\s-]+)/i);
    if (timeMatch) globalTime = timeMatch[1].trim();

    let allDatesWithIndices = [];
    const dateRegex = /\b(\d{1,2})\s*[./\-\s\\|]\s*(\d{1,2})\s*[./\-\s\\|]\s*(\d{2,4})\b/g;
    const textDateRegex = /\b(\d{1,2})\s+([A-Z]{3,})\s+(\d{4})\b/ig;
    lines.forEach((line, idx) => {
        let match;
        while ((match = dateRegex.exec(line)) !== null) {
            const d = parseDateStr(match[0]);
            if (d) allDatesWithIndices.push({ date: d, index: idx });
        }
        while ((match = textDateRegex.exec(line)) !== null) {
            const d = parseDateStr(match[0]);
            if (d) allDatesWithIndices.push({ date: d, index: idx });
        }
    });

    const headerDates = [...new Set(allDatesWithIndices.filter(d => d.index < 15).map(d => d.date))];
    const isGrid = headerDates.length > 2;
    let exams = [];

    if (isGrid) {
        console.log("--- Detected GRID layout ---");
        lines.forEach((line, idx) => {
            const upper = line.toUpperCase();
            const bMatch = upper.match(new RegExp("\\b(" + branchCodes.join("|") + ")\\b"));
            if (bMatch) {
                const branch = bMatch[1];
                let content = line.substring(upper.indexOf(branch) + branch.length).trim();
                if (content.length > 0) {
                    let tokens = content.split(/\s{2,}/).filter(t => t.length > 3);
                    let nextIdx = idx + 1;
                    while (nextIdx < lines.length && tokens.length < headerDates.length) {
                        const nextLine = lines[nextIdx];
                        if (branchCodes.some(b => nextLine.toUpperCase().match(new RegExp("\\b" + b + "\\b")))) break;
                        if (parseDateStr(nextLine)) break;
                        const nextTokens = nextLine.split(/\s{2,}/).filter(t => t.length > 3);
                        tokens = tokens.concat(nextTokens);
                        nextIdx++;
                    }
                    headerDates.forEach((date, i) => {
                        if (tokens[i] && !/EXAM|TIME|TABLE|NOTE|ROLL|HALL|TICKET/i.test(tokens[i])) {
                            exams.push({ branch, section: branch, subject: tokens[i].trim(), date, time: globalTime });
                        }
                    });
                }
            }
        });
    } else {
        console.log("--- Detected LIST layout ---");
        // ... (List logic remains similar)
    }
    return exams;
}

console.log("\n>>> MESSY GRID <<<");
const result = parseTimetableOCR(ocrTextGridMessy);
console.log("Result length:", result.length);
result.forEach(e => console.log(`  [${e.date}] ${e.branch}: ${e.subject}`));
