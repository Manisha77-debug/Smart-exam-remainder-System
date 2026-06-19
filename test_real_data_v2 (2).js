// test_real_data_v2.js
const image2Text = `COLLEGE EXAM TIME TABLE
ESTO
BRANCH
{ROLL. NUMBER RANGE)
ROOM NO.
CE
Civil Engineering
CEOOI - CE025
I Room 4101
EEE
Electrical a Electronics
Engineering
EEEOOI - EEE02S
Room 4102
ME
Meehanical Engineering
MEOOI - ME025
Room 4103
ECE
Electronics & Communication
Engineering
ECEOOI - ECE030
Room 4104
CSE
Computer Science Engineering
CSEOOI - CSE060
Room 4201
CSB
Computer Science &
Business Systems
CSBOOI - CSB030
I Room 4202
CSM
Computer Science &
Multimedia
CSMOOI - CSM03S
I Room 4203
CSD
Computer Science &
Data Science
CSDOOI - CS0035
Room 4204
03 JUNE 2026
Engineering
Mathematics•'l
{CE001-CE025
Room 4101'
Engineering
Mathematics-II
(EEE001-EEE025
I Room 4102)
Engineering
Mathematics-II
(ME001-ME02S
Room 4103i
Engineering
Mathematics-II
{ECE001-ECE030
Room 4104)
Discrete
Mathematics
(CSE001-CSED60
Room 4201)
Business
Mathematics
(CSB001-CSB030
j Room 4202}
Discrete
Mathematics
(CSM001-CSM03S
Room 4203)
Discrete
Mathematics
(CS0001-CSD035
I Room •zoo
06 JUNE 2026
Structural
Analysis
(CEOC1-CE025
Room 4101)
Circuit
Theory
(EEEOOI -EEE02S
I Room 4102)
Engineering
Mechanics
(ME001-ME02S
I Room 4103)
Electronic
Deuices
(ECEOOI - ECE030
I Room 4104)
Data Structures
(CSEOOI -CSEOSO
I Room 4201)
Data Structures
(csgool -CSB030
I Room 4202)
Data Structures
(CSM001-CSM035
I Room 4203)
Data Structures
(CSDOOI -CS0035
I Room 4204)`;

function parseTimetableOCR(text) {
    let cleanText = text
        .replace(/\r\n/g, "\n")
        .replace(/\r/g, "\n")
        .replace(/[{]/g, "(")
        .replace(/[}]/g, ")")
        .replace(/[„]/g, "-")
        .replace(/ll/g, "II");

    const lines = cleanText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const branchCodes = ["CE", "EEE", "ME", "ECE", "CSE", "CSB", "CSM", "CSD"];
    const monthMap = { "JAN":"01","FEB":"02","MAR":"03","APR":"04","MAY":"05","JUN":"06","JUL":"07","AUG":"08","SEP":"09","OCT":"10","NOV":"11","DEC":"12"};

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

    // 1. Collect Branches
    let activeBranches = [];
    let firstDateIdx = -1;
    for (let i = 0; i < lines.length; i++) {
        if (parseDateStr(lines[i])) { firstDateIdx = i; break; }
        const bMatch = lines[i].toUpperCase().match(new RegExp("^(" + branchCodes.join("|") + ")$"));
        if (bMatch) activeBranches.push(bMatch[1]);
    }

    console.log("Detected Branches:", activeBranches);

    let exams = [];
    if (activeBranches.length > 2 && firstDateIdx !== -1) {
        let i = firstDateIdx;
        while (i < lines.length) {
            const date = parseDateStr(lines[i]);
            if (date) {
                let currentDate = date;
                i++;
                let blockLines = [];
                while (i < lines.length && !parseDateStr(lines[i]) && !lines[i].toLowerCase().includes("exam time")) {
                    const l = lines[i];
                    // NOISE FILTER: Skip lines with room, roll numbers, or mostly parentheses
                    const isNoise = /ROOM|ROOM \d+|\d{3,}-\d{3,}|^\(|^[A-Z]+\d+/i.test(l);
                    if (!isNoise && l.length > 2) {
                        blockLines.push(l);
                    }
                    i++;
                }

                let subjects = [];
                let tempIdx = 0;
                while (tempIdx < blockLines.length && subjects.length < activeBranches.length) {
                    let subject = blockLines[tempIdx];
                    if (blockLines.length - tempIdx > activeBranches.length - subjects.length) {
                        const nextLine = blockLines[tempIdx + 1] || "";
                        const suffixRegex = /^(Mathematics|Analysis|Theory|System|Engineering|Technology|Structures|Economics|Fundamenta|Learning|Network|Management|Science|Analytics|Visualization|Commerce|Deuices)/i;
                        const joinRegex = /(&|AND|OF|FOR)$/i;
                        if (subject.length < 15 || joinRegex.test(subject) || suffixRegex.test(nextLine)) {
                            subject += " " + nextLine;
                            tempIdx++;
                        }
                    }
                    subjects.push(subject);
                    tempIdx++;
                }

                activeBranches.forEach((branch, idx) => {
                    if (subjects[idx]) exams.push({ branch, date: currentDate, subject: subjects[idx] });
                });
            } else i++;
        }
    }
    return exams;
}

const exams = parseTimetableOCR(image2Text);
console.log("Total exams:", exams.length);
exams.forEach(e => console.log(`[${e.date}] ${e.branch}: ${e.subject}`));
