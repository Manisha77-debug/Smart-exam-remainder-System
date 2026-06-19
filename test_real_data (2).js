// test_real_data.js
const realOCRText = `COLLEGE EXAM TIME TABLE
BRANCH
CE
Civil Engineering
EEE
Electrical & Electronic
ME
Mechanical Engieering
ECE
E&tronics & Communii
CSE
Computer "ience Engineere
CSB
Computer Sciere Fu.'±ims
CSM
Computer Fundament!
CSD
Computer Science & Desjg
CSD
Computer Science & Desig
31/05/26
Engineering
Mathematics
Engineering
Mathematics-II
Engineering
Mathematics-II
Engineering
Mathematics-II
Data
Structures
Business
Economics
C Ornputer Science
Fundamentas
Discrete
Mathematics
Discrete
Mathematics
03/05/26
Structural
Analysis
Circuit
Theory
Engineering
Mathematics-II
Engineering
Mathematics-II
Database
Managementsyste
Data
Structures
Data
Structures
Data
Structures
Data
Structures
06/05/26
Surveying
Electrical
Machines
Thermodynam•cs
Signals &
Systems
Database
ern, Management
Systems
Data
Structures
Probability &
Statistics
Data
Structures
Data
Structures
09/05/26
Concrete
Technology
Power
Systems
Machine
Design
Analog
Circuits
Operating
Systems
Probability
& Statistics
Probability
& Statistics
Data
Mining
Probability
& Statistics
13/05/26
Concrete
Technology
Mechanics
Power
Systems
Manufacturing
Technology
Web
Technologies
Web
Technologies
Web
Technologies
Machine
Learning
Machine
Learning
16/05/26
Transportation
Engineering
Transportatio
Engineering
Environmental
Engineering
Technologies
Systems
Computer
Networks
Machine
Learning
Software
Engineering
Software
Engineering
Database
Managements
20/05/26
Environmental
Engineering
Environmenta
Engineering
Environmen
Engineering
Environmen
Engineerin
Theory
of Computation
Data trocemm
Systems
Database
Management
Big
Data Analytics
Data Data
Analytics
23/05/26
Constructäon
Engineering
Profeesement
Managements
Constructio
Managemen s
27/05/26
Construction
Management
Construction
Management
Construction
Management
Environme al Construction
Engineerin
Engineering
Computer
Networks
Big Data
Information
E-Commerce
Data
Visualization
Data
Science
Software
Engineering
Project
Management
Project
Management
Data
Visualization
Exam Time: 9:30 AM - 12:30 PM`;

function parseTimetableOCR(text) {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const branchCodes = ["CE", "EEE", "ME", "ECE", "CSE", "CSB", "CSM", "CSD"];
    
    function parseDateStr(str) {
        if (!str) return null;
        let m = str.match(/(\d{1,2})\s*[./\-\s\\|]\s*(\d{1,2})\s*[./\-\s\\|]\s*(\d{2,4})/);
        if (m) {
            const day = m[1].padStart(2, '0');
            const month = m[2].padStart(2, '0');
            let year = m[3].replace(/\s+/g, "");
            if (year.length === 2) year = "20" + year;
            return `${year}-${month}-${day}`;
        }
        return null;
    }

    // 1. Collect Branches before first date
    let activeBranches = [];
    let firstDateIdx = -1;
    for (let i = 0; i < lines.length; i++) {
        if (parseDateStr(lines[i])) {
            firstDateIdx = i;
            break;
        }
        const upper = lines[i].toUpperCase();
        const bMatch = upper.match(new RegExp("^(" + branchCodes.join("|") + ")$"));
        if (bMatch) activeBranches.push(bMatch[1]);
    }

    console.log("Detected Branches:", activeBranches);

    let exams = [];
    let currentDate = null;
    let globalTime = "09:30 AM - 12:30 PM";
    const timeMatch = text.match(/(?:EXAM TIME|TIME):\s*([\d:APM\s-]+)/i);
    if (timeMatch) globalTime = timeMatch[1].trim();

    if (activeBranches.length > 0 && firstDateIdx !== -1) {
        let i = firstDateIdx;
        while (i < lines.length) {
            const date = parseDateStr(lines[i]);
            if (date) {
                currentDate = date;
                i++;
                
                // Collect all lines for this date block
                let blockLines = [];
                while (i < lines.length && !parseDateStr(lines[i]) && !lines[i].toLowerCase().includes("exam time")) {
                    blockLines.push(lines[i]);
                    i++;
                }

                // Smart Merger Logic
                let subjects = [];
                let tempIdx = 0;
                while (tempIdx < blockLines.length && subjects.length < activeBranches.length) {
                    let subject = blockLines[tempIdx];
                    
                    // If we have more lines than needed, try to merge with NEXT line
                    if (blockLines.length - tempIdx > activeBranches.length - subjects.length) {
                        const nextLine = blockLines[tempIdx+1] || "";
                        const suffixRegex = /^(Mathematics|Analysis|Theory|System|Engineering|Technology|Structures|Economics|Fundamenta|Learning|Network|Management|Science|Analytics|Visualization|Commerce)/i;
                        const joinRegex = /(&|AND|OF|FOR)$/i;
                        
                        if (subject.length < 15 || joinRegex.test(subject) || suffixRegex.test(nextLine)) {
                            subject += " " + nextLine;
                            tempIdx++;
                        }
                    }
                    subjects.push(subject);
                    tempIdx++;
                }

                // Map to branches
                activeBranches.forEach((branch, idx) => {
                    if (subjects[idx]) {
                        exams.push({ branch, section: branch, subject: subjects[idx].trim(), date: currentDate, time: globalTime });
                    }
                });
            } else {
                i++;
            }
        }
    }

    return exams;
}

const results = parseTimetableOCR(realOCRText);
console.log(`Found ${results.length} exams.`);
results.forEach(e => {
    if (e.date === '2026-05-31') console.log(`  [${e.date}] ${e.branch}: ${e.subject}`);
});
console.log("...");
results.forEach(e => {
    if (e.date === '2026-05-03') console.log(`  [${e.date}] ${e.branch}: ${e.subject}`);
});
