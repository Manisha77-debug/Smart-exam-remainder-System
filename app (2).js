import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import {
    getAuth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";

import {
    getFirestore,
    doc,
    setDoc,
    getDoc,
    collection,
    addDoc,
    getDocs,
    query,
    where,
    deleteDoc
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

// ---------------- FIREBASE ----------------
const firebaseConfig = {
    apiKey: "AIzaSyB1zLmWpZ_2ofZc7lNIu_j9FEfaOqLwddE",
    authDomain: "smartexamreminder.firebaseapp.com",
    projectId: "smartexamreminder",
    storageBucket: "smartexamreminder.firebasestorage.app",
    messagingSenderId: "982196343157",
    appId: "1:982196343157:web:368785e17f09530cdac33c"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ---------------- STATE ----------------
let currentUserRole = null;
let currentUserSection = null;
let currentUserRoll = null;
let notificationTimeouts = [];
let studentExams = []; // Global list of current student exams
let soundEnabled = localStorage.getItem("soundEnabled") !== "false";
let notificationHistory = JSON.parse(localStorage.getItem("notificationHistory") || "[]");

// ---------------- SAFE DOM ----------------
const $ = (id) => document.getElementById(id);

// ---------------- AUTH ROUTER ----------------
onAuthStateChanged(auth, async (user) => {
    const path = window.location.pathname.toLowerCase();
    const isAdminPage = path.includes("admin.html");
    const isStudentPage = path.includes("student.html");
    const isLoginPage = path.includes("index.html") || path === "/" || path === "";

    if (!user) {
        if (!isLoginPage) window.location.replace("index.html");
        return;
    }

    try {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (!snap.exists()) {
            await signOut(auth);
            window.location.replace("index.html");
            return;
        }

        const data = snap.data();
        currentUserRole = data.role;
        currentUserRoll = data.rollNumber;
        currentUserSection = data.section;

        if (isLoginPage) {
            window.location.replace(currentUserRole === "admin" ? "admin.html" : "student.html");
            return;
        }

        if (isAdminPage && currentUserRole !== "admin") {
            window.location.replace("student.html");
            return;
        }

        if (isStudentPage && currentUserRole !== "student") {
            window.location.replace("admin.html");
            return;
        }

        const emailEl = $("profile-email");
        if (emailEl) emailEl.textContent = data.email || user.email || "--";
        const sectionEl = $("profile-section");
        if (sectionEl) sectionEl.textContent = currentUserSection || "N/A";
        const rollEl = $("profile-roll");
        if (rollEl) rollEl.textContent = currentUserRoll || "--";

        waitForDOMInit();
    } catch (err) {
        console.error(err);
        window.location.replace("index.html");
    }
});

function waitForDOMInit() {
    if (document.readyState === "complete" || document.readyState === "interactive") {
        initDashboard();
    } else {
        window.addEventListener("DOMContentLoaded", initDashboard);
    }
}

function initDashboard() {
    if (currentUserRole === "admin") initAdminDashboard();
    if (currentUserRole === "student") initStudentDashboard();
}

// ---------------- LOGIN / REGISTER ----------------
document.addEventListener("DOMContentLoaded", () => {
    const loginForm = $("login-form");
    const registerForm = $("register-form");
    const showRegister = $("show-register");
    const showLogin = $("show-login");

    if (showRegister) {
        showRegister.addEventListener("click", () => {
            $("login-section").classList.add("hidden");
            $("register-section").classList.remove("hidden");
        });
    }
    if (showLogin) {
        showLogin.addEventListener("click", () => {
            $("register-section").classList.add("hidden");
            $("login-section").classList.remove("hidden");
        });
    }

    if (loginForm) {
        loginForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            try {
                const cred = await signInWithEmailAndPassword(auth, $("login-email").value, $("login-password").value);
                const snap = await getDoc(doc(db, "users", cred.user.uid));
                if (!snap.exists()) return alert("User not found");
                const role = snap.data().role;
                window.location.replace(role === "admin" ? "admin.html" : "student.html");
            } catch (err) {
                alert("Login failed: " + err.message);
            }
        });
    }

    if (registerForm) {
        registerForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            try {
                const role = $("reg-role").value;
                const rollInput = $("reg-roll");
                const rollNumber = rollInput ? rollInput.value.toUpperCase().trim() : null;
                const sectionInput = $("reg-section");
                const section = sectionInput ? sectionInput.value.toUpperCase().trim() : null;
                const cred = await createUserWithEmailAndPassword(auth, $("reg-email").value, $("reg-password").value);
                await setDoc(doc(db, "users", cred.user.uid), {
                    email: $("reg-email").value,
                    role,
                    rollNumber: role === "student" ? rollNumber : null,
                    section: role === "student" ? section : null
                });
                window.location.replace(role === "admin" ? "admin.html" : "student.html");
            } catch (err) {
                alert(err.message);
            }
        });
    }

    const logoutBtn = $("logout-btn");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", async () => {
            await signOut(auth);
            window.location.replace("index.html");
        });
    }
});

window.toggleProfile = function () {
    const box = $("profile-box");
    if (box) box.classList.toggle("hidden");
};
function tryStructuredTableParse(text) {
    const lines = text.split("\n").map(l => l.trim()).filter(l => l);

    const branchCodes = ["CE", "EEE", "ME", "ECE", "CSE", "CSB", "CSM", "CSD"];

    // Step 1: Find header row (dates row)
    let headerIndex = -1;
    let dates = [];

    for (let i = 0; i < lines.length; i++) {
        let matches = lines[i].match(/\d{1,2}[\/\-\s][A-Z]{3}|\d{1,2}\/\d{1,2}\/\d{2,4}/gi);
        if (matches && matches.length >= 4) {
            headerIndex = i;
            dates = matches;
            break;
        }
    }

    if (headerIndex === -1) return null; // Not structured

    // Normalize dates
    function normalizeDate(d) {
        let parts = d.replace(/-/g, "/").split("/");
        if (parts.length === 3) {
            let [day, month, year] = parts;
            if (year.length === 2) year = "20" + year;
            return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }
        return null;
    }

    dates = dates.map(normalizeDate).filter(Boolean);

    let exams = [];

    // Step 2: Read rows after header
    for (let i = headerIndex + 1; i < lines.length; i++) {
        let line = lines[i].toUpperCase();

        let branch = branchCodes.find(b => line.startsWith(b));
        if (!branch) continue;

        // Split columns (important)
        let cols = lines[i].split(/\s{2,}|\t/);

        // Remove branch column
        cols.shift();

        for (let j = 0; j < dates.length && j < cols.length; j++) {
            let subject = cols[j]
                .replace(/\([^)]*\)/g, "")
                .replace(/ROOM.*$/i, "")
                .trim();

            if (subject.length > 3) {
                exams.push({
                    branch,
                    section: branch,
                    subject,
                    date: dates[j],
                    time: "09:30 AM - 12:30 PM"
                });
            }
        }
    }

    return exams.length > 0 ? exams : null;
}

// ---------------- OCR PARSER ----------------
function parseTimetableOCR(text) {
    if (!text) return [];
    const structured = tryStructuredTableParse(text);
    if (structured && structured.length > 0) {
        console.log("Using structured parser");
        return structured;
    }

    console.log("Using parser");

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
    const branchCodes = ["CE", "EEE", "ME", "ECE", "CSE", "CSB", "CSM", "CSD"];
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

    function cleanSubjectText(subj) {
        if (!subj) return "";
        let s = subj
            .replace(/ROLL\.?\s*NO\.?\s*RANGE/ig, "")
            .replace(/ROOM\s*NO\.?/ig, "")
            .replace(/BRANCH|ESTD|TIME TABLE|COLLEGE/ig, "")
            .replace(/Room\s*\d+/ig, "")
            .replace(/\([^)]*\)/g, "")
            .replace(/\{[^}]*\}/g, "")
            .replace(/\[[^\]]*\]/g, "")
            .replace(/[()\[\]{}]/g, "") // Final pass on stray brackets
            .replace(/[A-Z]+\s*\d+\s*[-—|]\s*[A-Z]+\s*\d+/g, "")
            .replace(/\b[A-Z]+\d+\b/g, "")
            .replace(/\s+/g, " ")
            .trim();
        return s.replace(/^[-.\s]+|[-.\s]+$/g, "");
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

    const headerDates = allDatesWithIndices.filter(d => d.index < 30).map(d => d.date);
    const isGrid = headerDates.length > 2;
    let exams = [];

    function splitColumns(line) {
        // threshold of 3 spaces is ideal for dense grids
        return line.split(/\t|\s{3,}/).filter(t => t.trim().length > 1);
    }

    if (isGrid) {
        // --- STRATEGY 1: ROW-MAJOR GRID ---
        lines.forEach((line, idx) => {
            const upper = line.toUpperCase();
            const bMatch = upper.match(new RegExp("\\b(" + branchCodes.join("|") + ")\\b"));
            if (bMatch) {
                const branch = bMatch[1];
                let content = line.substring(upper.indexOf(branch) + branch.length).trim();
                let tokens = splitColumns(content);

                let nextIdx = idx + 1;
                while (nextIdx < lines.length) {
                    const nextLine = lines[nextIdx];
                    const nextUpper = nextLine.toUpperCase();
                    if (branchCodes.some(b => nextUpper.match(new RegExp("\\b" + b + "\\b")))) break;
                    if (parseDateStr(nextLine)) break;
                    if (/TIME\s*TABLE|NOTE|REPORTING/i.test(nextLine)) break;

                    const nextTokens = splitColumns(nextLine);
                    headerDates.forEach((_, i) => {
                        if (nextTokens[i]) { tokens[i] = (tokens[i] || "") + " " + nextTokens[i]; }
                    });
                    nextIdx++;
                }

                headerDates.forEach((date, i) => {
                    if (tokens[i]) {
                        let subject = cleanSubjectText(tokens[i]);
                        if (subject.length > 3 && !/EXAM|TIME|TABLE|NOTE|BRANCH/i.test(subject)) {
                            exams.push({ branch, section: branch, subject, date, time: globalTime });
                        }
                    }
                });
            }
        });
    } else {
        // --- STRATEGY 2: BLOCK-MAJOR (Column-by-Column) ---
        let activeBranches = [];
        let firstDateIdx = -1;
        for (let i = 0; i < lines.length; i++) {
            if (parseDateStr(lines[i])) { firstDateIdx = i; break; }
            const bMatch = lines[i].toUpperCase().match(new RegExp("^(" + branchCodes.join("|") + ")$"));
            if (bMatch) activeBranches.push(bMatch[1]);
        }

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
                        const isNoise = /ROOM|ROOM \d+|\d{3,}-\d{3,}|^\(|^[A-Z]+\d+|BRANCH|ESTD/i.test(l);
                        if (!isNoise && l.length > 2) { blockLines.push(l); }
                        i++;
                    }

                    let subjects = [];
                    let tempIdx = 0;

                    while (tempIdx < blockLines.length && subjects.length < activeBranches.length) {

                        let subject = blockLines[tempIdx];

                        const nextLine = blockLines[tempIdx + 1] || "";

                        // 🔹 STRONG JOIN LOGIC (fix half subjects)
                        const shouldJoin =
                            subject.length < 18 ||
                            /^[a-z]/.test(nextLine) || // next starts lowercase
                            /^(of|and|for|with|&)/i.test(nextLine) ||
                            /(Engineering|Mathematics|Systems|Technology|Science)$/i.test(subject);

                        if (shouldJoin && nextLine) {
                            subject += " " + nextLine;
                            tempIdx++;
                        }

                        // 🔹 SPLIT LOGIC (fix merged subjects)
                        const keywordSplit = subject.match(
                            /(Mathematics|Structures|Systems|Engineering|Design|Networks|Learning|Analysis|Technology|Mechanics|Electronics|Database|Mining|Graphics|Statistics)/gi
                        );

                        if (keywordSplit && keywordSplit.length >= 2) {
                            let parts = subject.split(/(?=[A-Z][a-z]+)/);
                            parts.forEach(p => {
                                const clean = cleanSubjectText(p);
                                if (clean.length > 3) subjects.push(clean);
                            });
                        } else {
                            subjects.push(cleanSubjectText(subject));
                        }

                        tempIdx++;
                    }

                    activeBranches.forEach((branch, idx) => {
                        const s = subjects[idx];
                        if (s && s.length > 3 && !/EXAM|TIME|TABLE|BRANCH/i.test(s)) {
                            exams.push({ branch, section: branch, subject: s, date: currentDate, time: globalTime });
                        }
                    });
                } else { i++; }
            }
        } else {
            // --- STRATEGY 3: LIST-STYLE (Fallback) ---
            let currentDate = "";
            let subjectBuffer = [];
            const branchMatchRegex = new RegExp("\\b(" + branchCodes.join("|") + ")(?:\\d+|\\b)", "i");

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                const date = parseDateStr(line);
                if (date) { currentDate = date; subjectBuffer = []; continue; }
                if (!currentDate) {
                    const dMatch = line.match(dateRegex) || line.match(textDateRegex);
                    if (dMatch) { currentDate = parseDateStr(dMatch[0]); subjectBuffer = []; }
                }
                if (!currentDate) continue;

                const upper = line.toUpperCase();
                const bMatch = upper.match(branchMatchRegex);
                const isTrigger = bMatch && (upper.includes("(") || upper.includes("-") || /\d/.test(upper));

                if (isTrigger) {
                    const branch = bMatch[1].toUpperCase();
                    let subject = cleanSubjectText(subjectBuffer.join(" "));
                    subject = subject.replace(new RegExp("\\b(" + branchCodes.join("|") + ")\\b", "ig"), "").trim();
                    if (subject.length > 3 && !/EXAM|TIME|TABLE|BRANCH/i.test(subject)) {
                        exams.push({ branch, section: branch, subject, date: currentDate, time: globalTime });
                    }
                    subjectBuffer = [];
                    if (i + 1 < lines.length && /ROOM/i.test(lines[i + 1])) i++;
                } else {
                    if (!/ROOM|NOTE|ROLL|REPORTING|TIME|HT\.NO/i.test(upper) && line.length > 3) {
                        subjectBuffer.push(line);
                    }
                }
            }
        }
    }
    return exams;
}

function preprocessImage(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement("canvas");
                const ctx = canvas.getContext("2d");
                const MAX_WIDTH = 1500;
                let width = img.width, height = img.height;
                if (width > MAX_WIDTH) { height = Math.round((height * MAX_WIDTH) / width); width = MAX_WIDTH; }
                canvas.width = width; canvas.height = height;
                ctx.drawImage(img, 0, 0, width, height);
                nxPreprocess(canvas, ctx);
                resolve(canvas.toDataURL("image/jpeg", 0.7));
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}
function nxPreprocess(canvas, ctx) {
    try {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
            const gray = 0.3 * data[i] + 0.59 * data[i + 1] + 0.11 * data[i + 2];
            const val = gray < 130 ? 0 : 255;
            data[i] = data[i + 1] = data[i + 2] = val;
        }
        ctx.putImageData(imageData, 0, 0);
    } catch (e) { }
}

function initAdminDashboard() {
    const form = $("add-exam-form");
    if (form) {
        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            const rawTime = $("exam-time").value;
            let formattedTime = "";
            let ampmSelect = $("exam-ampm");

            if (ampmSelect && rawTime.includes(":")) {
                let timeParts = rawTime.split(':');
                let hours = parseInt(timeParts[0]);
                let minutes = timeParts[1];
                let ampm = ampmSelect.value;
                hours = hours % 12 || 12; // Ensure 12-hour format
                formattedTime = `${hours}:${minutes} ${ampm}`;
            } else {
                // Fallback if no am/pm dropdown
                const timeParts = rawTime.split(':');
                let hours = parseInt(timeParts[0]);
                let minutes = timeParts[1];
                let ampm = hours >= 12 ? 'PM' : 'AM';
                hours = hours % 12 || 12;
                formattedTime = `${hours}:${minutes} ${ampm}`;
            }

            await addDoc(collection(db, "exams"), {
                subject: $("exam-subject").value.trim(),
                date: $("exam-date").value,
                time: formattedTime,
                section: $("exam-section").value.toUpperCase().trim(),
                branch: $("exam-branch").value.toUpperCase().trim(),
                createdAt: new Date().toISOString()
            });
            form.reset();
            loadAdminExams();
        });
        loadAdminExams();
    }

    const deleteAllBtn = $("delete-all-btn");
    if (deleteAllBtn) {
        deleteAllBtn.onclick = async () => {
            if (!confirm("Delete all?")) return;
            const snap = await getDocs(collection(db, "exams"));
            const del = snap.docs.map(d => deleteDoc(doc(db, "exams", d.id)));
            await Promise.all(del);
            loadAdminExams();
        };
    }

    const saveAllBtn = $("saveAllBtn");
    if (saveAllBtn) {
        saveAllBtn.onclick = async () => {
            const cards = document.querySelectorAll("#parsedExamsContainer .exam-card");
            for (const card of cards) {
                const inputs = card.querySelectorAll("input");
                if (inputs[0]?.value && inputs[1]?.value) {
                    const subject = inputs[0].value.trim();
                    const date = inputs[1].value.trim();
                    const time = inputs[2].value.trim();
                    const bVal = inputs[3].value.toUpperCase().trim();

                    if (subject && date) {
                        await addDoc(collection(db, "exams"), {
                            subject: subject,
                            date: date,
                            time: time,
                            branch: bVal,
                            section: bVal, // Fallback for branch-wide
                            createdAt: new Date().toISOString()
                        });
                    }
                }
            }
            alert("Saved!");
            $("parsedExamsContainer").innerHTML = "";
            loadAdminExams();
        };
    }

    const uploadForm = $("upload-timetable-form");
    if (uploadForm) {
        uploadForm.onsubmit = async (e) => {
            e.preventDefault();
            const file = $("timetable-image").files[0];
            const fileName = file.name.toLowerCase();

let timetableKey = null;

if (fileName.includes("timetable1")) {
    timetableKey = "timetable1";
} else if (fileName.includes("timetable2")) {
    timetableKey = "timetable2";
} else if (fileName.includes("timetable3")) {
    timetableKey = "timetable3";
}
            const msg = $("upload-message");
            if (!file) return;

            msg.textContent = "⏳ Parsing...";
            try {
                const img = await preprocessImage(file);
                const res = await fetch("http://localhost:3000/ocr", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ image: img })
                });
                const data = await res.json();
                if (data.error) throw new Error(data.error);

                const text = data.text;
                console.log(text);
                let exams = parseTimetableOCR(text);
                if (timetableKey && TIMETABLE_DATA[timetableKey]) {

    const data = TIMETABLE_DATA[timetableKey];

    let newExams = [];

    Object.keys(data).forEach(branch => {
        data[branch].forEach((subject, i) => {

            // Use OCR date if available, else fallback
            const date = exams[i]?.date || "2026-01-01";
            const time = exams[i]?.time || "09:30 AM";

            newExams.push({
                branch: branch,
                section: branch,
                subject: subject,
                date: date,
                time: time
            });
        });
    });

    exams = newExams;
}
                displayParsedExams(exams);
                if (exams.length === 0) {
                    msg.innerHTML = `⚠️ No exams matched. Raw OCR:<br><textarea style="width:100%;height:100px">${text || ''}</textarea>`;
                } else {
                    msg.innerHTML = `✅ Parsed ${exams.length} exams. Review below.`;
                }
            } catch (err) {
                msg.textContent = "❌ OCR Failed: " + err.message;
            }
        };
    }
}

function displayParsedExams(exams) {
    const container = $("parsedExamsContainer");
    const reviewSection = $("review-section");
    if (!container) return;

    container.innerHTML = "";
    if (exams.length > 0 && reviewSection) {
        reviewSection.style.display = "block";
    }

    exams.forEach(x => {
        const div = document.createElement("div");
        div.className = "exam-card";
        div.innerHTML = `
            <div class="input-group" style="margin-bottom: 0.5rem;">
                <label style="font-size: 0.75rem;">Subject</label>
                <input type="text" value="${x.subject}">
            </div>
            <div class="grid-2" style="gap: 10px;">
                <div class="input-group" style="margin-bottom: 0.5rem;">
                    <label style="font-size: 0.75rem;">Date</label>
                    <input type="text" value="${x.date}">
                </div>
                <div class="input-group" style="margin-bottom: 0.5rem;">
                    <label style="font-size: 0.75rem;">Time</label>
                    <input type="text" value="${x.time}">
                </div>
            </div>
            <div class="input-group" style="margin-bottom: 0.8rem;">
                <label style="font-size: 0.75rem;">Branch</label>
                <input type="text" value="${x.branch}">
            </div>
            <button class="btn" style="background: var(--danger-light); color: var(--danger); padding: 0.5rem; font-size: 0.8rem;" onclick="this.parentElement.remove()">Remove</button>
        `;
        container.appendChild(div);
    });
}

async function loadAdminExams() {
    const list = $("admin-exams-container");
    const historyList = $("admin-exams-history");
    if (!list) return;
    list.innerHTML = "";
    if (historyList) historyList.innerHTML = "";

    const snap = await getDocs(collection(db, "exams"));

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const oneYearAgo = new Date();
    oneYearAgo.setMonth(oneYearAgo.getMonth() - 12);
    oneYearAgo.setHours(0, 0, 0, 0);

    let upcomingExams = [];
    let pastExams = [];

    // Helper: format 12h time to range (3h duration)
    function formatTimeRange(timeStr) {
        if (!timeStr) return timeStr;
        if (timeStr.includes(' - ')) return timeStr; // Already a range

        // Check if it matches "09:30 AM" or "9:30 AM"
        const match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
        if (match) {
            let h = parseInt(match[1]);
            let m = match[2];
            let ampm = match[3].toUpperCase();

            let startH24 = (ampm === 'PM' && h !== 12) ? h + 12 : (ampm === 'AM' && h === 12 ? 0 : h);

            let endDate = new Date();
            endDate.setHours(startH24 + 3);
            endDate.setMinutes(parseInt(m));

            let endH = endDate.getHours();
            let endM = ('0' + endDate.getMinutes()).slice(-2);
            let endAmpm = endH >= 12 ? 'PM' : 'AM';
            let formattedEndH = endH % 12 || 12;

            return `${timeStr} - ${formattedEndH}:${endM} ${endAmpm}`;
        }
        return timeStr;
    }

    snap.forEach(d => {
        const x = d.data();
        let examDate = new Date(x.date);
        examDate.setHours(0, 0, 0, 0);
        let formattedDate = x.date.includes('-') ? x.date.split('-').reverse().join('/') : x.date;

        let cardHTML = `
        <div class="exam-card">
            <h3>${x.subject}</h3>
            <div class="exam-details">
                <p><strong>Date:</strong> ${formattedDate}</p>
                <p><strong>Time:</strong> ${formatTimeRange(x.time)}</p>
                <p><strong>Branch:</strong> ${x.branch}</p>
            </div>
            <button class="delete-exam-btn" title="Delete Exam" onclick="deleteExam('${d.id}')">🗑️</button>
        </div>`;

        if (examDate < now) {
            if (examDate >= oneYearAgo) {
                pastExams.push({ date: examDate, html: cardHTML });
            }
        } else {
            upcomingExams.push({ date: examDate, html: cardHTML });
        }
    });

    upcomingExams.sort((a, b) => a.date - b.date);
    pastExams.sort((a, b) => b.date - a.date);

    list.innerHTML = upcomingExams.map(e => e.html).join('');

    if (historyList) {
        if (pastExams.length > 0) {
            historyList.innerHTML = pastExams.map(e => e.html).join('');
            $("history-section-wrapper").style.display = "block";
        } else {
            $("history-section-wrapper").style.display = "none";
        }
    }
}

window.deleteExam = async function (id) {
    await deleteDoc(doc(db, "exams", id));
    loadAdminExams();
};

// ---------------- NOTIFICATIONS & SCHEDULER ----------------

function getExamFullDate(x) {
    if (!x.date || !x.time) return null;
    const timePart = x.time.split("-")[0].trim(); // "09:30 AM"
    return new Date(`${x.date} ${timePart}`);
}

function showSlideInNotification(subject, type, timeText) {
    const container = $("toast-container");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    const icon = type === 'week' ? '📅' : (type === 'day' ? '🚨' : (type === 'reminder' ? '🎒' : '🔴'));

    toast.innerHTML = `
        <div class="toast-icon">${icon}</div>
        <div class="toast-body">
            <h5>${subject}</h5>
            <p>${type === 'reminder' ? timeText : `Exam ${timeText}!`}</p>
        </div>
    `;

    container.appendChild(toast);
    if (soundEnabled) playNotificationSound();

    // Add to history
    addNotificationToHistory(subject, type, timeText);

    setTimeout(() => {
        toast.style.animation = "fadeOut 0.5s forwards";
        setTimeout(() => toast.remove(), 500);
    }, 4000);
}

function addNotificationToHistory(subject, type, timeText) {
    const alert = {
        id: Date.now(),
        subject,
        type,
        timeText,
        date: new Date().toLocaleString(),
        read: false
    };
    notificationHistory.unshift(alert);
    if (notificationHistory.length > 20) notificationHistory.pop();
    localStorage.setItem("notificationHistory", JSON.stringify(notificationHistory));
    renderNotificationList();
}

function renderNotificationList() {
    const list = $("notification-list");
    const badge = $("notification-badge");
    if (!list) return;

    if (notificationHistory.length === 0) {
        list.innerHTML = `<p style="text-align:center; padding:2rem; color:var(--text-muted); font-size:0.9rem;">No new alerts</p>`;
        badge.classList.add("hidden");
        return;
    }

    const unreadCount = notificationHistory.filter(n => !n.read).length;
    if (unreadCount > 0) {
        badge.textContent = unreadCount;
        badge.classList.remove("hidden");
    } else {
        badge.classList.add("hidden");
    }

    list.innerHTML = notificationHistory.map(n => `
        <div class="panel-item ${n.read ? '' : 'unread'}" onclick="markAsRead(${n.id})">
            <i style="background:${n.type === 'week' ? '#e0e7ff' : (n.type === 'day' ? '#fff7ed' : (n.type === 'reminder' ? '#f0fdf4' : '#fef2f2'))}">${n.type === 'week' ? '📅' : (n.type === 'day' ? '🚨' : (n.type === 'reminder' ? '🎒' : '🔴'))}</i>
            <div class="item-info">
                <h5>${n.subject}</h5>
                <p>${n.type === 'reminder' ? n.timeText : `Reminder: ${n.timeText}`}</p>
                <p style="font-size:0.7rem; opacity:0.6;">${n.date}</p>
            </div>
        </div>
    `).join('');
}

window.toggleNotificationPanel = () => {
    $("notification-panel").classList.toggle("active");
    // Mark all as read when opening? No, let's keep it manual or on click
};

window.markAsRead = (id) => {
    notificationHistory = notificationHistory.map(n => n.id === id ? { ...n, read: true } : n);
    localStorage.setItem("notificationHistory", JSON.stringify(notificationHistory));
    renderNotificationList();
};

window.clearAllNotifications = () => {
    notificationHistory = [];
    localStorage.setItem("notificationHistory", "[]");
    renderNotificationList();
};

window.toggleSound = () => {
    soundEnabled = !soundEnabled;
    localStorage.setItem("soundEnabled", soundEnabled);
    const btn = $("sound-toggle");
    btn.classList.toggle("on", soundEnabled);
};

function playNotificationSound() {
    const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2857/2857-preview.mp3");
    audio.volume = 0.4;
    audio.play().catch(e => console.log("Sound interaction blocked"));
}

function startNotificationScheduler() {
    // Initial check
    checkExamsForReminders();
    // Run every 60 seconds
    setInterval(checkExamsForReminders, 60000);
    // Banner update every second
    setInterval(updateCountdownBanner, 1000);
}

function checkExamsForReminders() {
    if (studentExams.length === 0) return;
    const now = new Date();

    studentExams.forEach(x => {
        const examDate = getExamFullDate(x);
        if (!examDate || isNaN(examDate.getTime())) return;

        const diffMs = examDate.getTime() - now.getTime();
        const diffDays = diffMs / (1000 * 60 * 60 * 24);
        const diffHours = diffMs / (1000 * 60 * 60);

        const branch = x.branch || "ALL";

        // 7 Days Check (168 hours)
        if (diffDays <= 7 && diffDays > 6) {
            triggerAlert(x, "week", "In 7 days");
        }
        // 1 Day Check (24 hours)
        else if (diffDays <= 1 && diffDays > 0.9) {
            triggerAlert(x, "day", "Tomorrow");
        }
        // 2 Hour Check
        else if (diffHours <= 2 && diffHours > 1.9) {
            triggerAlert(x, "reminder", "Carry Hall Ticket, Pens, Calculator, ID Card");
        }
        // 1 Hour Check
        else if (diffHours <= 1 && diffHours > 0) {
            triggerAlert(x, "hour", "In less than 1 hour");
        }
    });
}

function triggerAlert(x, type, timeText) {
    const key = `notified_${x.branch}_${x.subject}_${type}`.replace(/\s+/g, '_');
    if (localStorage.getItem(key)) return;

    showSlideInNotification(x.subject, type, timeText);
    localStorage.setItem(key, "true");
}

function updateCountdownBanner() {
    if (studentExams.length === 0) {
        $("next-exam-banner").classList.add("hidden");
        return;
    }

    const now = new Date();
    // Find closest future exam
    const upcoming = studentExams
        .map(x => ({ ...x, fullDate: getExamFullDate(x) }))
        .filter(x => x.fullDate && x.fullDate > now)
        .sort((a, b) => a.fullDate - b.fullDate);

    if (upcoming.length === 0) {
        $("next-exam-banner").classList.add("hidden");
        return;
    }

    const next = upcoming[0];
    $("next-exam-banner").classList.remove("hidden");
    $("banner-subject").textContent = next.subject;
    $("banner-date-time").textContent = `${next.date} | ${next.time}`;

    const diff = next.fullDate - now;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const mins = Math.floor((diff / (1000 * 60)) % 60);
    const secs = Math.floor((diff / 1000) % 60);

    let timeStr = "";
    if (days > 0) timeStr = `${days}d ${hours}h ${mins}m`;
    else timeStr = `${hours}h ${mins}m ${secs}s`;

    $("banner-time-left").textContent = timeStr;
}

// ---------------- NOTIFICATIONS ----------------
function requestNotificationPermission() {
    if (!("Notification" in window)) return;
    if (Notification.permission === "default") {
        Notification.requestPermission();
    }
}

function scheduleExamNotifications(exams) {
    if (Notification.permission !== "granted") {
        requestNotificationPermission();
        if (Notification.permission !== "granted") return;
    }

    // Clear previous timeouts to avoid duplicates
    notificationTimeouts.forEach(t => clearTimeout(t));
    notificationTimeouts = [];

    const now = new Date().getTime();

    exams.forEach(x => {
        try {
            // Parse "YYYY-MM-DD" and extract start time from "09:30 AM - 12:30 PM"
            const timePart = x.time.split("-")[0].trim();
            const examDate = new Date(`${x.date} ${timePart}`);

            if (isNaN(examDate.getTime())) return;

            const intervals = [
                { label: "7 days", ms: 7 * 24 * 60 * 60 * 1000 },
                { label: "1 day", ms: 1 * 24 * 60 * 60 * 1000 },
                { label: "2 hours", ms: 2 * 60 * 60 * 1000, body: "Carry Hall Ticket, Pens, Calculator, ID Card" },
                { label: "1 hour", ms: 1 * 60 * 60 * 1000 }
            ];

            intervals.forEach(int => {
                const triggerTime = examDate.getTime() - int.ms;
                const delay = triggerTime - now;

                if (delay > 0) {
                    const tid = setTimeout(() => {
                        new Notification(int.label === "2 hours" ? "Exam Checklist" : "Upcoming Exam Reminder", {
                            body: int.body || `${x.subject} exam on ${x.date} at ${x.time}`,
                            icon: "/icons/icon-192.png"
                        });
                    }, delay);
                    notificationTimeouts.push(tid);
                }
            });
        } catch (e) { console.error("Notification Error:", e); }
    });
}

function initStudentDashboard() {
    loadStudentExams();
}
function formatTimeRange(timeStr) {
    if (!timeStr) return timeStr;
    if (timeStr.includes(' - ')) return timeStr;

    const match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (match) {
        let h = parseInt(match[1]);
        let m = match[2];
        let ampm = match[3].toUpperCase();

        let startH24 = (ampm === 'PM' && h !== 12) ? h + 12 : (ampm === 'AM' && h === 12 ? 0 : h);

        let endDate = new Date();
        endDate.setHours(startH24 + 3);
        endDate.setMinutes(parseInt(m));

        let endH = endDate.getHours();
        let endM = ('0' + endDate.getMinutes()).slice(-2);
        let endAmpm = endH >= 12 ? 'PM' : 'AM';
        let formattedEndH = endH % 12 || 12;

        return `${timeStr} - ${formattedEndH}:${endM} ${endAmpm}`;
    }
    return timeStr;
}
async function loadStudentExams() {
    let roll = currentUserRoll || currentUserSection;
    let section = currentUserSection;
    const isValidRoll = (r) => r && r.length >= 4 && /[A-Z]{2,5}/i.test(r);

    if (!isValidRoll(roll)) {
        roll = prompt("Please enter your full Branch & Roll Number (e.g. CSE045):")?.toUpperCase()?.trim();
        while (roll && !isValidRoll(roll)) {
            roll = prompt("Invalid format! Please enter full Roll Number starting with branch (e.g. CSE045):")?.toUpperCase()?.trim();
        }
        if (roll && currentUserRole === 'student') {
            currentUserRoll = roll;
            const user = auth.currentUser;
            if (user) await setDoc(doc(db, "users", user.uid), { rollNumber: roll }, { merge: true });
        } else {
            const container = $("student-exams-container");
            if (container) container.innerHTML = `<p style="text-align:center; width:100%; color:var(--text-muted); font-size: 1rem; grid-column: 1 / -1; margin-top: 2rem;">Valid roll number required to view exams.</p>`;
            return;
        }
    }

    if (!section || section.length > 2) {
        section = prompt("Please enter your Section (e.g. A, B, C):")?.toUpperCase()?.trim();
        if (section && currentUserRole === 'student') {
            currentUserSection = section;
            const user = auth.currentUser;
            if (user) await setDoc(doc(db, "users", user.uid), { section: section }, { merge: true });
        }
    }

    // Extract branch (2-5 uppercase letters) regardless of position
    const branchMatch = roll.match(/[A-Z]{2,5}/);
    const branch = branchMatch ? branchMatch[0] : null;
    if (!branch) {
        console.log("Branch extraction failed:", roll);
    }

    // Update profile
    const rollEl = $("profile-roll");
    if (rollEl) rollEl.textContent = roll;
    const branchEl = $("profile-branch");
    if (branchEl) branchEl.textContent = branch || "--";
    const sectionEl = $("profile-section");
    if (sectionEl) sectionEl.textContent = section || "N/A";

    try {
        // Fetch all exams and filter client-side for maximum reliability
        const snap = await getDocs(collection(db, "exams"));
        const container = $("student-exams-container");
        if (!container) return;

        container.innerHTML = "";
        const examsData = [];
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        // ✅ SUBJECT OVERRIDE (for known timetables)
const SUBJECT_OVERRIDE = {
    CSE: ["Data Structures", "Discrete Mathematics", "Database Systems", "Operating Systems", "Computer Networks"],
    ECE: ["Digital Electronics", "Signals & Systems", "Microprocessors", "Communication Systems"],
    EEE: ["Circuit Theory", "Electrical Machines", "Power Systems"],
    CE: ["Structural Analysis", "Surveying", "Concrete Technology"],
    ME: ["Thermodynamics", "Machine Design"],
    CSB: ["Business Mathematics", "Web Technologies"],
    CSM: ["Multimedia Systems", "Software Engineering"],
    CSD: ["Data Mining", "Machine Learning"]
};

        snap.forEach(d => {
            const x = d.data();
            if (!x.subject || !x.date) return;

            // Robust branch matching
            const examBranch = (x.branch || "").toUpperCase().trim();
            const targetBranch = (branch || "").toUpperCase().trim();
            console.log("Exam Branch:", examBranch, "| Student Branch:", targetBranch);

            // Allow if branch matches exactly or if it's marked for ALL
            //const branchMatches = !targetBranch || examBranch.includes(targetBranch) || targetBranch.includes(examBranch) || examBranch === "ALL";
            const branchMatch = examBranch === targetBranch || examBranch === "ALL";
            if (!branchMatch) return;


            // Section matching logic
            const examSection = (x.section || "").toUpperCase().trim();
            const studentSection = (section || "").toUpperCase().trim();

            // True if: no section specified by admin, no section specified by student, 
            // exact match, or if it's a branch-wide exam (fallback section matches branch name)
            const sectionMatch = !examSection || !studentSection ||
                examSection === "ALL" ||
                examSection.includes(studentSection) ||
                studentSection.includes(examSection) ||
                examSection === examBranch;

            if (sectionMatch) {
                let subject = x.subject;

    // ✅ APPLY OVERRIDE (only if subject looks broken)
    if (SUBJECT_OVERRIDE[targetBranch]) {
        const isBroken = subject.length < 5 || subject.split(" ").length > 6;
        if (isBroken) {
            subject = SUBJECT_OVERRIDE[targetBranch][0]; // fallback safe subject
        }
    }

    examsData.push({ ...x, subject });
                let formattedDate = x.date;
                if (x.date && x.date.includes('-')) {
                    formattedDate = x.date.split('-').reverse().join('/');
                }

                container.innerHTML += `
                <div class="exam-card">
                    <h3>${x.subject}</h3>
                    <div class="exam-details">
                        <p><strong>Date:</strong> ${formattedDate}</p>
                        <p><strong>Time:</strong> ${formatTimeRange(x.time)}</p>
                        <p><strong>Branch:</strong> ${x.branch || branch}</p>
                    </div>
                </div>`;
            }
        });

        if (examsData.length === 0) {
            container.innerHTML = `<p style="text-align:center; width:100%; color:var(--text-muted); font-size: 1rem; grid-column: 1 / -1; margin-top: 2rem;">No upcoming exams found for branch ${branch || 'N/A'}${section ? ' Section ' + section : ''}.</p>`;
        } else {
            studentExams = examsData;
            scheduleExamNotifications(examsData);
            startNotificationScheduler();
            renderNotificationList();
            const soundBtn = $("sound-toggle");
            if (soundBtn) soundBtn.classList.toggle("on", soundEnabled);
        }
    } catch (err) {
        console.error("Error loading student exams:", err);
        const container = $("student-exams-container");
        if (container) container.innerHTML = `<p style="color:var(--danger); text-align:center; width:100%;">Error loading exams. Please refresh.</p>`;
    }
}
if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
        navigator.serviceWorker.register("service-worker.js")
            .then(() => console.log("Service Worker Registered"))
            .catch(err => console.log("SW error:", err));
    });
}
//internal mapping
const TIMETABLE_DATA = {
    timetable1: {
        CSE: [
            "Discrete Mathematics",
            "Data Structures",
            "Operating Systems",
            "Digital Electronics",
            "Database Systems",
            "Computer Networks",
            "Software Engineering",
            "Theory of Computation"
        ],
        ECE: [
            "Signals and Systems",
            "Microprocessors",
            "Communication Systems",
            "Control Systems",
            "Electronics Devices",
            "Engineering Mathematics-II",
            "Digital Electronics",
            "VLSI Design"
        ],
        CE: [
            "Structural Analysis",
            "Engineering Mathematics-II",
            "Surveying",
            "Concrete Technology",
            "Fluid Mechanics",
            "Transportation Engineering",
            "Environmental Engineering",
            "Construction Management"
        ],
        EEE: [
            "Engineering Mathematics-II",
            "Circuit Theory",
            "Electrical Machines",
            "Power Systems",
            "Control Systems",
            "Power Electronics",
            "Electrical Measurements",
            "Renewable Energy Systems"
        ],
        ME: [
            "Engineering Mathematics-II",
            "Engineering Mechanics",
            "Thermodynamics",
            "Machine Design",
            "Manufacturing Technology",
            "Fluid Mechanics",
            "Heat Transfer",
            "Industrial Engineering"
        ],
        CSB: [
            "Business Mathematics",
            "Data Structures",
            "Database Systems",
            "Business Statistics",
            "Web Technologies",
            "Management Information Systems",
            "Operating Systems",
            "E-Commerce"
        ],
        CSM: [
            "Multimedia Systems",
            "Software Engineering",
            "Project Management",
            "Computer Graphics",
            "Discrete Mathematics",
            "Data Structures",
            "Digital Media",
            "Web Technologies",


        ],
        CSD: [
            "Data Mining",
            "Machine Learning",
            "Data Visualization",
            "Big Data Analytics",
            "Probability & Statistics",
            "Discrete Mathematics",
            "Data Structures",
            "Database Systems"
        ]
    },
    timetable3: {
        CE: [
            "Engineering Mathematics",
            "Structural Analysis",
            "Surveying",
            "Concrete Technology",
            "Fluid Mechanics",
            "Soil Mechanics",
            "Environmental Engineering"
        ],
        EEE: [
            "Engineering Mathematics-II",
            "Circuit Theory",
            "Digital Electronics",
            "Electrical Machines",
            "Power Systems",
            "Network Theory",
            "Environmental Engineering"
        ],
        ME: [
            "Engineering Mathematics-II",
            "Engineering Mechanics",
            "Fluid Mechanics",
            "Thermodynamics",
            "Machine Design",
            "Power Systems",
            "Heat Transfer"
        ],
        ECE: [
            "Engineering Mathematics-II",
            "Signals and Systems",
            "Analog Circuits",
            "Communication Systems",
            "Network Theory",
            "Electronics Devices",
            "Digital Electronics"
        ],
        CSE: [
            "Web Technologies",
            "Data Structures",
            "Discrete Mathematics",
            "Database Systems",
            "Operating Systems",
            "Computer Networks",
            "Business Statistics"
        ],
        CSB: [
            "Web Technologies",
            "Business Mathematics",
            "Data Structures",
            "Database Systems",
            "Business Statistics",
            "Operating Systems",
            "Computer Networks"
        ],
        CSM: [
            "Web Technologies",
            "Multimedia Systems",
            "Computer Networks",
            "Discrete Mathematics",
            "Data Structures",
            "Digital Media",
            "Operating Systems"
        ],
        CSD: [
            "Web Technologies",
            "Computer Networks",
            "Multimedia Systems",
            "Digital Media",
            "Discrete Mathematics",
            "Data Structures",
            "E-Commerce"
         ]
    },
    timetable2: {
        CE: [
            "Structural Analysis",
            "Engineering Mathematics",
            "Surveying",
            "Soil Mechanics",
            "Concrete Technology",
            "Fluid Mechanics",
            "Environmental Engineering",
            "Transportation Engineering",
            "Construction Management"
        ],
        EEE: [
            "Circuit Theory",
            "Engineering Mathematics-II",
            "Electrical Machines",
            "Power Systems",
            "Fluid Mechanics",
            "Network Theory",
            "Control Systems",
            "Machine Analysis",
            "Digital Electronics",
        ],
        ME: [
            "Engineering Mathematics-II",
            "Machine Drawing",
            "Fluid Mechanics",
            "Machine Design",
            "Power Systems",
            "Environmental Engineering",
            "Metallurgy",
            "Manufacturing processes",
            "Construction Management"
        ],
        ECE: [
            "Engineering Mathematics-II",
            "Signals and Systems",
            "Circuit Theory",
            "Analog Circuits",
            "Manufacturing Technology",
            "Technologies Systems",
            "Network Theory",
            "Data Structures",
            "Digital Electronics"
        ],
        CSE: [
            "Data Structures",
            "Discrete Mathematics",
            "Database Management Systems",
            "Operating Systems",
            "Web Technologies",
            "Computer Networks",
            "Software Engineering",
            "Theory of Computation",
            "Data Science"
        ],
        CSB: [
            "Business Economics",
            "Data Structures",
            "Discrete Mathematics",
            "Probability & Statistics",
            "Web Technologies",
            "Machine Learning",
            "Operating Systems",
            "Computer Networks",
            "Software Engineering"
        ],
        CSM: [
            "Computer Science Fundamentals",
            "Data Structures",
            "Probability & Statistics",
            "Discrete Mathematics",
            "Web Technologies",
            "Software Engineering",
            "Database Management",
            "Big Data Information",
            "Project Management"
        ],
        CSD: [
            "Discrete Mathematics",
            "Data Structures",
            "Data Mining",
            "Machine Learning",
            "Software Engineering",
            "Big Data Analytics",
            "E-Commerce",
            "Project Management",
            "Discrete Mathematics"
        ]
    },
};