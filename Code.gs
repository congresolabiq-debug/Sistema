const DRIVE_FOLDER_ID = '15uaMvkO2toWBxgyhrWZB-jH7c229iiEO';
const TEMPLATE_ID = '1z8LMJqXj_Nj4L0bIBJjaH2-PaXiTCYhkTSgNuVjO6iQ';
const CERTIFICATES_FOLDER_ID = '1slHOhYFi-lArwC8ocHgBqAWrrxgRlGf3';
const FRONTEND_URL = 'https://congresolabiq.github.io/Sistema';
const RESET_TOKEN_EXPIRY_HOURS = 1;

// --- FUNCIONES DE ENTRADA (GET) ---

function doGet(e) {
  const action = e.parameter.action;
  const db = SpreadsheetApp.getActiveSpreadsheet();
  let result = {};

  try {
    if (action === 'getWorks') {
      const works = getSheetData(db, 'works');
      const users = getSheetData(db, 'users');
      const data = works.map(w => ({
        ...w,
        student_name: (users.find(u => u.id === w.student_id) || {}).name || 'Desconocido'
      }));
      result = { success: true, data: data };
    }
    else if (action === 'getStudentWorks') {
      const studentId = e.parameter.studentId;
      const works = getSheetData(db, 'works');
      const data = works.filter(w => w.student_id === studentId);
      result = { success: true, data: data };
    }
    else if (action === 'getEvaluators') {
      const users = getSheetData(db, 'users');
      result = { success: true, data: users.filter(u => u.user_type === 'evaluator') };
    }
    else if (action === 'getAssignments') {
      const assignments = getSheetData(db, 'assignments');
      const works = getSheetData(db, 'works');
      const users = getSheetData(db, 'users');
      const evaluations = getSheetData(db, 'evaluations'); 

      const enriched = assignments.map(a => {
        const work = works.find(w => w.id === a.work_id);
        const evaluator = users.find(u => u.id === a.evaluator_id);
        const evalDoc = evaluations.find(e => e.work_id === a.work_id && e.evaluator_id === a.evaluator_id);
        return {
          ...a,
          works: { ...work },
          user_profiles: evaluator,
          total_score: evalDoc ? evalDoc.total_score : null,
          evaluation: evalDoc || null
        };
      });
      result = { success: true, data: enriched };
    }
    else if (action === 'getLiveAssignments') {
      const assignments = getSheetData(db, 'live_assignments');
      const works = getSheetData(db, 'works');
      const users = getSheetData(db, 'users');
      const liveEvals = getSheetData(db, 'live_evaluations');
      const enriched = assignments.map(a => {
        const work = works.find(w => w.id === a.work_id);
        const student = work ? users.find(u => u.id === work.student_id) : null;
        const myEval = liveEvals.find(e => e.work_id === a.work_id && e.evaluator_id === a.evaluator_id);
        return {
          ...a,
          works: { ...work, student_name: student ? student.name : '' },
          evaluation: myEval || null
        };
      });
      result = { success: true, data: enriched };
    }
    else if (action === 'getProfessorsBySemester') {
       const semester = e.parameter.semester;
       const professors = getSheetData(db, 'catalog_professors');
       const filtered = professors.filter(p => p.semester === semester);
       result = { success: true, data: filtered };
    }
    else if (action === 'getWinners') {
      const works = getSheetData(db, 'works');
      const users = getSheetData(db, 'users');
      const ciclos = {
        "Básico": ["1er Semestre", "2do Semestre", "3er Semestre"],
        "Intermedio": ["4to Semestre", "5to Semestre", "6to Semestre"],
        "Terminal": ["7mo Semestre", "8vo Semestre", "9no Semestre"]
      };
      const scoredWorks = works.filter(w => w.live_score !== "" && Number(w.live_score) > 0).map(w => ({
          ...w, student_name: (users.find(u => u.id === w.student_id) || {}).name || 'N/A'
      }));
      const oral = scoredWorks.filter(w => w.status === 'accepted_oral').sort((a, b) => b.live_score - a.live_score).slice(0, 3);
      const poster = scoredWorks.filter(w => w.status === 'accepted_poster').sort((a, b) => b.live_score - a.live_score).slice(0, 3);
      let porCiclo = [];
      Object.keys(ciclos).forEach(nombre => {
        const semestres = ciclos[nombre];
        const worksInCycle = scoredWorks.filter(w => semestres.includes(w.semester));
        const mejoresOral = worksInCycle.filter(w => w.status === 'accepted_oral').sort((a, b) => b.live_score - a.live_score).slice(0, 2);
        const mejoresPoster = worksInCycle.filter(w => w.status === 'accepted_poster').sort((a, b) => b.live_score - a.live_score).slice(0, 2);
        porCiclo.push({
          ciclo_nombre: nombre,
          oral: mejoresOral.length ? mejoresOral : null,
          poster: mejoresPoster.length ? mejoresPoster : null
        });
      });
      result = { success: true, data: { oral, poster, porCiclo } };
    }
    else if (action === 'getConfig') {
      result = { success: true, data: { submission_deadline: obtenerFechaLimiteSubida(), event_date: obtenerFechaEvento() } };
    }
  } catch (error) {
    result = { success: false, error: error.toString() };
  }
  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
}

// --- LOGICA DE APOYO ---

function tieneConflictoDeGrupo(grupoTrabajo, gruposProfesorString) {
  if (!grupoTrabajo || !gruposProfesorString) return false;
  const gB = String(grupoTrabajo).trim().toUpperCase();
  const lista = String(gruposProfesorString).split(',').map(g => g.trim().toUpperCase());
  return lista.includes(gB);
}

function esAutoEvaluacion(work, evaluator) {
  if (!work || !evaluator) return false;
  const nombreEv = String(evaluator.name).trim().toUpperCase();
  return String(work.profesor_cargo || '').split(',').some(n => String(n).trim().toUpperCase() === nombreEv);
}

function generarShortId(db, semestre) {
  const prefijos = { "1er Semestre": "A", "2do Semestre": "B", "3er Semestre": "C", "4to Semestre": "D", "5to Semestre": "E", "6to Semestre": "F", "7mo Semestre": "G", "8vo Semestre": "H", "9no Semestre": "I" };
  const letra = prefijos[semestre] || "Z";
  const works = getSheetData(db, 'works');
  const total = works.filter(w => w.semester === semestre).length;
  return letra + (total + 1).toString().padStart(2, '0');
}

function hashPassword(password) {
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password, Utilities.Charset.UTF_8);
  return digest.map(b => ('0' + (b & 0xFF).toString(16)).slice(-2)).join('');
}

function obtenerFechaEvento() {
  const db = SpreadsheetApp.getActiveSpreadsheet();
  const configSheet = db.getSheetByName('config');
  if (configSheet) {
    const data = configSheet.getDataRange().getValues();
    for (let i = 0; i < data.length; i++) {
      if (String(data[i][0]).trim().toLowerCase() === 'event_date') {
        return String(data[i][1]).trim();
      }
    }
  }
  return '15-17 de julio de 2026';
}

function obtenerFechaLimiteSubida() {
  const db = SpreadsheetApp.getActiveSpreadsheet();
  const configSheet = db.getSheetByName('config');
  if (configSheet) {
    const data = configSheet.getDataRange().getValues();
    for (let i = 0; i < data.length; i++) {
      if (String(data[i][0]).trim().toLowerCase() === 'submission_deadline') {
        const val = data[i][1];
        if (val instanceof Date) return val.toISOString();
        return String(val).trim();
      }
    }
  }
  return '';
}

function formatearFechaLimite(fecha) {
  const meses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const d = new Date(fecha);
  if (isNaN(d.getTime())) return 'la fecha límite configurada';
  return d.getDate() + ' de ' + meses[d.getMonth()] + ' de ' + d.getFullYear() + ' a las ' +
    String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

function seExcedioFechaLimiteSubida() {
  const limite = obtenerFechaLimiteSubida();
  if (!limite) return false;
  const fecha = new Date(limite);
  if (isNaN(fecha.getTime())) return false;
  return new Date() > fecha;
}

function obtenerCodigoEvaluador() {
  const db = SpreadsheetApp.getActiveSpreadsheet();
  const configSheet = db.getSheetByName('config');
  if (configSheet) {
    const data = configSheet.getDataRange().getValues();
    for (let i = 0; i < data.length; i++) {
      if (String(data[i][0]).trim().toLowerCase() === 'evaluator_code') {
        return String(data[i][1]).trim().toLowerCase();
      }
    }
  }
  return 'zaragoza';
}

function shuffleArray(array) {
  let shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// --- POST ---

function doPost(e) {
  const db = SpreadsheetApp.getActiveSpreadsheet();
  let result = {};
  try {
    const data = JSON.parse(e.postData.contents);

    if (data.action === 'login') {
      const users = getSheetData(db, 'users');
      const hashedInput = hashPassword(data.password);
      const user = users.find(u => {
        if (u.email !== data.email) return false;
        const stored = String(u.password).replace(/^'/, '');
        if (stored === hashedInput) return true;
        if (stored === data.password) {
          const h = db.getSheetByName('users').getDataRange().getValues()[0].map(h => String(h).trim().toLowerCase());
          const pwdIdx = h.indexOf('password');
          if (pwdIdx > -1) {
            const sheet = db.getSheetByName('users');
            const dataRows = sheet.getDataRange().getValues();
            for (let i = 1; i < dataRows.length; i++) {
              if (String(dataRows[i][h.indexOf('id')]) === String(u.id)) {
                sheet.getRange(i + 1, pwdIdx + 1).setValue("'" + hashedInput);
                break;
              }
            }
          }
          return true;
        }
        return false;
      });
      if (user) {
        result = { success: true, data: { user: { id: user.id }, profile: user } };
      } else {
        result = { success: false, error: 'Credenciales inválidas' };
      }
    }

    else if (data.action === 'register') {
      const uSheet = db.getSheetByName('users');
      const uData = getSheetData(db, 'users');
      if (uData.find(u => u.email === data.email)) throw new Error('Email ya registrado');

      // Validar código de evaluador en backend
      if (data.user_type === 'evaluator') {
        const validCode = obtenerCodigoEvaluador();
        if (!data.admin_code || String(data.admin_code).toLowerCase() !== validCode) {
          throw new Error('Código de acceso docente incorrecto.');
        }
      }

      const id = Utilities.getUuid();
      const h = uSheet.getDataRange().getValues()[0].map(h => String(h).trim().toLowerCase());
      const row = new Array(h.length).fill("");
      row[h.indexOf('id')] = id;
      row[h.indexOf('email')] = data.email;
      row[h.indexOf('password')] = "'" + hashPassword(data.password);
      row[h.indexOf('name')] = data.name;
      row[h.indexOf('user_type')] = data.user_type;
      row[h.indexOf('timestamp')] = new Date();
      if (h.indexOf('grupos_imparte') > -1) row[h.indexOf('grupos_imparte')] = data.grupos_imparte || "";
      uSheet.appendRow(row);
      result = { success: true };
    }

    else if (data.action === 'submitWork') {
      if (seExcedioFechaLimiteSubida()) {
        throw new Error('La fecha límite para subir trabajos (' + formatearFechaLimite(obtenerFechaLimiteSubida()) + ') ya ha pasado.');
      }
      const folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
      const blob = Utilities.newBlob(Utilities.base64Decode(data.fileBase64), 'application/pdf', data.fileName);
      const file = folder.createFile(blob);
      let fileUrl = "";
      try {
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        fileUrl = file.getUrl();
      } catch(e) { fileUrl = "https://drive.google.com/open?id=" + file.getId(); }

      const wSheet = db.getSheetByName('works');
      const h = wSheet.getDataRange().getValues()[0].map(h => String(h).trim().toLowerCase());
      const row = new Array(h.length).fill("");
      const lock = LockService.getScriptLock();
      const lockAcquired = lock.tryLock(10000);
      let sId;
      try {
        sId = generarShortId(db, data.semester);

        row[h.indexOf('id')] = Utilities.getUuid();
        row[h.indexOf('short_id')] = sId;
        row[h.indexOf('student_id')] = data.student_id;
        row[h.indexOf('title')] = data.title;
        row[h.indexOf('abstract')] = data.abstract;
        row[h.indexOf('modality')] = "Pendiente";
        row[h.indexOf('file_url')] = fileUrl;
        row[h.indexOf('file_id')] = file.getId();
        row[h.indexOf('status')] = 'pending';
        row[h.indexOf('submitted_at')] = new Date();
        row[h.indexOf('semester')] = data.semester;
        row[h.indexOf('team_members')] = data.team_members;
        if (h.indexOf('grupo') > -1) row[h.indexOf('grupo')] = data.group;
        if (h.indexOf('profesor_cargo') > -1) row[h.indexOf('profesor_cargo')] = data.professor_cargo;
        if (h.indexOf('facultad') > -1) row[h.indexOf('facultad')] = data.facultad || '';
        if (h.indexOf('project_type') > -1) row[h.indexOf('project_type')] = data.project_type || '';
        if (h.indexOf('asesores') > -1) row[h.indexOf('asesores')] = data.asesores || '';
        if (h.indexOf('facultad') > -1) row[h.indexOf('facultad')] = data.facultad || '';
        if (h.indexOf('project_type') > -1) row[h.indexOf('project_type')] = data.project_type || '';
        if (h.indexOf('asesores') > -1) row[h.indexOf('asesores')] = data.asesores || '';

        wSheet.appendRow(row);
        SpreadsheetApp.flush();
      } finally {
        if (lockAcquired) lock.releaseLock();
      }
      result = { success: true, shortId: sId };
    }

    else if (data.action === 'setSubmissionDeadline') {
      const configSheet = db.getSheetByName('config');
      if (!configSheet) throw new Error('No se encontró la hoja config.');
      const rows = configSheet.getDataRange().getValues();
      let encontrado = false;
      for (let i = 0; i < rows.length; i++) {
        if (String(rows[i][0]).trim().toLowerCase() === 'submission_deadline') {
          configSheet.getRange(i + 1, 2).setValue(data.deadline || '');
          encontrado = true;
          break;
        }
      }
      if (!encontrado) configSheet.appendRow(['submission_deadline', data.deadline || '']);
      result = { success: true };
    }

    else if (data.action === 'assignWork') {
      const work = getSheetData(db, 'works').find(w => w.id === data.work_id);
      const ev = getSheetData(db, 'users').find(u => u.id === data.evaluator_id);
      
      const esAutoEval = esAutoEvaluacion(work, ev);

      if (tieneConflictoDeGrupo(work.grupo, ev.grupos_imparte) || esAutoEval) {
        result = { success: false, error: `Conflicto: El profesor tiene relación directa con este trabajo.` };
      } else {
        db.getSheetByName('assignments').appendRow([Utilities.getUuid(), data.work_id, data.evaluator_id, 'assigned', new Date(), '']);
        updateRow(db, 'works', 'id', data.work_id, { status: 'under_review' });
        result = { success: true };
      }
    }

    else if (data.action === 'assignAllPending') {
      const works = getSheetData(db, 'works');
      const evaluators = getSheetData(db, 'users').filter(u => u.user_type === 'evaluator');
      const assigns = getSheetData(db, 'assignments');
      const sheet = db.getSheetByName('assignments');
      let workload = {};
      evaluators.forEach(ev => workload[ev.id] = assigns.filter(a => a.evaluator_id === ev.id).length);
      
      let count = 0;
      works.filter(w => w.status === 'pending').forEach(work => {
        let aptos = evaluators.filter(ev => {
          return !tieneConflictoDeGrupo(work.grupo, ev.grupos_imparte) && !esAutoEvaluacion(work, ev);
        });

        if (aptos.length < 2) return; 

        aptos.sort((a, b) => workload[a.id] - workload[b.id]).slice(0, 3).forEach(ev => {
          sheet.appendRow([Utilities.getUuid(), work.id, ev.id, 'assigned', new Date(), '']);
          workload[ev.id]++;
        });
        updateRow(db, 'works', 'id', work.id, { status: 'under_review' });
        count++;
      });
      result = { success: true, count: count };
    }

    else if (data.action === 'submitEvaluation') {
      const eSheet = db.getSheetByName('evaluations');
      const h = eSheet.getDataRange().getValues()[0].map(h => String(h).trim().toLowerCase());
      const row = new Array(h.length).fill("");
      row[h.indexOf('id')] = Utilities.getUuid();
      row[h.indexOf('work_id')] = data.work_id;
      row[h.indexOf('evaluator_id')] = data.evaluator_id;
      row[h.indexOf('total_score')] = data.total_score;
      row[h.indexOf('comentarios')] = data.comentarios;
      row[h.indexOf('timestamp')] = new Date();
      if (h.indexOf('score_pertinencia') > -1) row[h.indexOf('score_pertinencia')] = data.score_pertinencia;
      if (h.indexOf('cumple_extension') > -1) row[h.indexOf('cumple_extension')] = data.cumple_extension === false ? 'no' : 'si';
      
      eSheet.appendRow(row);

      if (data.assignment_id) {
        const aSheet = db.getSheetByName('assignments');
        const aData = aSheet.getDataRange().getValues();
        for (let i = 1; i < aData.length; i++) {
          if (aData[i][0] == data.assignment_id) {
            aSheet.getRange(i + 1, 4).setValue('completed');
            aSheet.getRange(i + 1, 6).setValue(new Date());
            break;
          }
        }
      }
      result = { success: true };
    }

    else if (data.action === 'batchFinalize') {
      const wSheet = db.getSheetByName('works');
      const works = getSheetData(db, 'works');
      const evals = getSheetData(db, 'evaluations');
      const users = getSheetData(db, 'users');
      const h = wSheet.getDataRange().getValues()[0].map(h => String(h).trim().toLowerCase());
      
      const mappingCiclos = { "1er Semestre": "Básico", "2do Semestre": "Básico", "3er Semestre": "Básico", "4to Semestre": "Intermedio", "5to Semestre": "Intermedio", "6to Semestre": "Intermedio", "7mo Semestre": "Terminal", "8vo Semestre": "Terminal", "9no Semestre": "Terminal" };
      let semesterPools = {}; 

      works.forEach((w, idx) => {
        if (w.status === 'rejected' || w.status === 'accepted_oral' || w.status === 'accepted_poster') return;
        const wEvals = evals.filter(e => e.work_id === w.id);
        if (wEvals.length < 2) return;

        // Si algún evaluador marcó que NO cumple con la extensión, se rechaza directamente
        const algunaNoCumple = wEvals.some(e => String(e.cumple_extension || '').toLowerCase() === 'no');
        if (algunaNoCumple) {
          if (!semesterPools[w.semester]) semesterPools[w.semester] = [];
          semesterPools[w.semester].push({ rowIndex: idx + 2, ...w, avgScore: 0, avgPertinencia: 0, ApprovedPert: false, feedback: wEvals.map((e, i) => `Juez ${i + 1}: ${e.comentarios}`).join('\n\n') });
          return;
        }

        const avgTotal = parseFloat((wEvals.reduce((s, c) => s + Number(c.total_score), 0) / wEvals.length).toFixed(1));
        const avgPert = parseFloat((wEvals.reduce((s, c) => s + Number(c.score_pertinencia || 0), 0) / wEvals.length).toFixed(1));
        const fb = wEvals.map((e, i) => `Juez ${i + 1}: ${e.comentarios}`).join('\n\n');
        
        if (!semesterPools[w.semester]) semesterPools[w.semester] = [];
        semesterPools[w.semester].push({ rowIndex: idx + 2, ...w, avgScore: avgTotal, avgPertinencia: avgPert, ApprovedPert: (avgPert >= 6), feedback: fb });
      });

      let salas = { "UMIEZ": { "Básico": [], "Intermedio": [], "Terminal": [] }, "Auditorio Principal": { "Básico": [], "Intermedio": [], "Terminal": [] } };

      Object.keys(semesterPools).forEach(sem => {
        let group = semesterPools[sem].sort((a, b) => b.avgScore - a.avgScore);
        let ciclo = mappingCiclos[sem] || "Básico";
        group.forEach((w, rank) => {
          if (w.avgScore < 60 || !w.ApprovedPert) { 
            w.fStat = 'rejected'; w.fAud = ''; w.fHor = '';
          }
          else if (rank === 0) { 
            w.fStat = 'accepted_oral'; w.fAud = 'UMIEZ'; salas["UMIEZ"][ciclo].push(w); 
          }
          else if (rank === 1) { 
            w.fStat = 'accepted_oral'; w.fAud = 'Auditorio Principal'; salas["Auditorio Principal"][ciclo].push(w); 
          }
          else { 
            w.fStat = 'accepted_poster'; w.fAud = ''; w.fHor = 'Sesión Carteles'; 
          }
        });
      });

      const hInicio = 10, mTurno = 20;
      ["UMIEZ", "Auditorio Principal"].forEach(sala => {
        const b = shuffleArray(salas[sala]["Básico"]), i = shuffleArray(salas[sala]["Intermedio"]), t = shuffleArray(salas[sala]["Terminal"]);
        let res = [];
        for (let j = 0; j < 3; j++) {
          let sec = [];
          if (b[j]) sec.push(b[j]); if (i[j]) sec.push(i[j]); if (t[j]) sec.push(t[j]);
          res = res.concat(shuffleArray(sec));
        }
        res.forEach((work, idx) => {
          let totalMins = idx * mTurno;
          work.fHor = (hInicio + Math.floor(totalMins/60)) + ":" + (totalMins % 60).toString().padStart(2,'0');
        });
      });

      Object.keys(semesterPools).forEach(sem => {
        semesterPools[sem].forEach(w => {
          wSheet.getRange(w.rowIndex, h.indexOf('status')+1).setValue(w.fStat);
          wSheet.getRange(w.rowIndex, h.indexOf('final_score')+1).setValue(w.avgScore);
          wSheet.getRange(w.rowIndex, h.indexOf('feedback')+1).setValue(w.feedback);
          if (h.indexOf('auditorio')>-1) wSheet.getRange(w.rowIndex, h.indexOf('auditorio')+1).setValue(w.fAud || "");
          if (h.indexOf('horario')>-1) {
            const horCell = wSheet.getRange(w.rowIndex, h.indexOf('horario')+1);
            horCell.setNumberFormat('@').setValue(w.fHor || "");
          }
          
          const student = users.find(u => u.id === w.student_id);
          if (student) {
            let msg = `Dictamen: ${w.fStat}\nLugar: ${w.fAud || 'N/A'}\nHora: ${w.fHor || 'N/A'}\n\nRetroalimentación:\n${w.feedback}`;
            try { MailApp.sendEmail(student.email, "Resultado Congreso LABIQ", msg); } catch(e) {}
          }
        });
      });
      result = { success: true };
    }

    else if (data.action === 'notifyJudgesAgenda') {
      const liveAssigns = getSheetData(db, 'live_assignments');
      const works = getSheetData(db, 'works');
      const users = getSheetData(db, 'users');
      users.filter(u => u.user_type === 'evaluator').forEach(ev => {
        const tasks = liveAssigns.filter(a => a.evaluator_id === ev.id);
        if (tasks.length === 0) return;
        const fechaEvento = obtenerFechaEvento();
        let html = `<h2>Agenda para Prof. ${ev.name}</h2><p><strong>Fecha del evento:</strong> ${fechaEvento}</p><table border="1" style="border-collapse:collapse; width:100%;"><tr style="background:#0d6efd; color:white;"><th>Hora</th><th>Lugar</th><th>Trabajo</th></tr>`;
        tasks.forEach(t => {
          const w = works.find(work => work.id === t.work_id);
          if (w) html += `<tr><td>${w.horario || 'N/A'}</td><td>${w.auditorio || 'Carteles'}</td><td><b>${w.short_id}</b> - ${w.title}</td></tr>`;
        });
        html += `</table>`;
        try { MailApp.sendEmail({ to: ev.email, subject: "Agenda de Evaluación - Congreso LABIQ", htmlBody: html }); } catch(e) {}
      });
      result = { success: true };
    }

    else if (data.action === 'assignLiveWorks') {
      const works = getSheetData(db, 'works');
      const evaluators = getSheetData(db, 'users').filter(u => u.user_type === 'evaluator');
      const existing = getSheetData(db, 'live_assignments');
      const lSheet = db.getSheetByName('live_assignments');
      let workload = {};
      evaluators.forEach(ev => workload[ev.id] = existing.filter(a => a.evaluator_id === ev.id).length);
      
      const p1 = evaluators.slice(0, Math.ceil(evaluators.length/2)), p2 = evaluators.slice(Math.ceil(evaluators.length/2));
      let count = 0;
      function asignar(lista, w) {
        let aptos = lista.filter(ev => {
           return !tieneConflictoDeGrupo(w.grupo, ev.grupos_imparte) && !esAutoEvaluacion(w, ev);
        });
        aptos.sort((a,b) => workload[a.id] - workload[b.id]).slice(0,3).forEach(ev => {
          lSheet.appendRow([Utilities.getUuid(), w.id, ev.id, 'assigned', new Date(), '']);
          workload[ev.id]++; count++;
        });
      }
      works.filter(w => w.status === 'accepted_oral').forEach(w => { if(!existing.some(a => a.work_id === w.id)) asignar(w.auditorio==='UMIEZ'?p1:p2, w); });
      works.filter(w => w.status === 'accepted_poster').forEach(w => { if(!existing.some(a => a.work_id === w.id)) asignar(evaluators, w); });
      result = { success: true, count: count };
    }

    else if (data.action === 'assignManualLive') {
      const lSheet = db.getSheetByName('live_assignments');
      const existing = getSheetData(db, 'live_assignments');
      if (existing.some(a => a.work_id === data.work_id && a.evaluator_id === data.evaluator_id)) {
        result = { success: false, error: 'Ese juez ya está asignado a ese trabajo.' };
      } else {
        const work = getSheetData(db, 'works').find(w => w.id === data.work_id);
        const ev = getSheetData(db, 'users').find(u => u.id === data.evaluator_id);
        if (!work || !ev) {
          result = { success: false, error: 'Trabajo o evaluador no encontrado.' };
        } else if (tieneConflictoDeGrupo(work.grupo, ev.grupos_imparte) || esAutoEvaluacion(work, ev)) {
          result = { success: false, error: 'Conflicto: El evaluador tiene relación directa con este trabajo.' };
        } else {
          lSheet.appendRow([Utilities.getUuid(), data.work_id, data.evaluator_id, 'assigned', new Date(), '']);
          result = { success: true };
        }
      }
    }

    else if (data.action === 'submitLiveEvaluation') {
      const evSheet = db.getSheetByName('live_evaluations');
      const headers = evSheet.getDataRange().getValues()[0].map(h => String(h).trim().toLowerCase());
      const fields = {
        id: Utilities.getUuid(),
        work_id: data.work_id,
        evaluator_id: data.evaluator_id,
        total_score: data.total_score,
        s1: data.s1, s2: data.s2, s3: data.s3, s4: data.s4,
        s5: data.s5, s6: data.s6, s7: data.s7, s8: data.s8,
        c1: data.c1, c2: data.c2, c3: data.c3, c4: data.c4,
        c5: data.c5, c6: data.c6, c7: data.c7, c8: data.c8,
        c9: data.c9, c10: data.c10,
        comments: data.comments,
        timestamp: new Date()
      };
      const row = [];
      Object.keys(fields).forEach(k => {
        let idx = headers.indexOf(k);
        if (idx === -1) {
          evSheet.getRange(1, headers.length + 1).setValue(k);
          headers.push(k);
          idx = headers.length - 1;
        }
        row[idx] = fields[k];
      });
      for (let i = 0; i < headers.length; i++) if (row[i] === undefined) row[i] = "";
      evSheet.appendRow(row);

      updateRow(db, 'live_assignments', 'id', data.assignment_id, { status: 'completed', completed_at: new Date() });
      const evs = getSheetData(db, 'live_evaluations').filter(e => e.work_id === data.work_id);
      const avg = (evs.reduce((s, c) => s + Number(c.total_score), 0) / evs.length).toFixed(2);
      updateRow(db, 'works', 'id', data.work_id, { live_score: avg });
      result = { success: true };
    }

    else if (data.action === 'generateCertificates') {
      const work = getSheetData(db, 'works').find(w => w.id === data.work_id);
      const prof = work.profesor_cargo || "No asignado";
      const url = crearSlideEditable(work, prof, "Participación");
      result = { success: true, fileUrl: url };
    }

    else if (data.action === 'forgotPassword') {
      const users = getSheetData(db, 'users');
      const user = users.find(u => u.email === data.email);
      if (user) {
        const token = Utilities.getUuid();
        const now = new Date();
        const expiresAt = new Date(now.getTime() + RESET_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);
        const sheet = db.getSheetByName('reset_tokens');
        let headers;
        if (!sheet) {
          const newSheet = db.insertSheet('reset_tokens');
          headers = ['token', 'email', 'created_at', 'expires_at', 'used'];
          newSheet.appendRow(headers);
        } else {
          headers = sheet.getDataRange().getValues()[0];
        }
        const row = new Array(headers.length).fill("");
        row[headers.indexOf('token')] = token;
        row[headers.indexOf('email')] = data.email;
        row[headers.indexOf('created_at')] = now;
        row[headers.indexOf('expires_at')] = expiresAt;
        row[headers.indexOf('used')] = 'false';
        sheet.appendRow(row);
        const resetLink = FRONTEND_URL + '/set-new-password.html?token=' + token;
        const subject = 'Recuperación de contraseña - Congreso LABIQ';
        const body = 'Hola,\n\nHas solicitado restablecer tu contraseña.\n\nHaz clic en el siguiente enlace para crear una nueva contraseña:\n' + resetLink + '\n\nEste enlace expirará en ' + RESET_TOKEN_EXPIRY_HOURS + ' hora(s).\n\nSi no solicitaste esto, ignora este mensaje.\n\nAtentamente,\nSistema Congreso LABIQ';
        try { MailApp.sendEmail(data.email, subject, body); } catch (e) {}
      }
      result = { success: true };
    }

    else if (data.action === 'resetPassword') {
      const sheet = db.getSheetByName('reset_tokens');
      if (!sheet) throw new Error('Token inválido o expirado.');
      const rows = sheet.getDataRange().getValues();
      const headers = rows[0];
      const tIdx = headers.indexOf('token');
      const eIdx = headers.indexOf('email');
      const expIdx = headers.indexOf('expires_at');
      const usedIdx = headers.indexOf('used');
      let foundRow = -1, email = '';
      for (let i = 1; i < rows.length; i++) {
        if (rows[i][tIdx] === data.token && String(rows[i][usedIdx]).toLowerCase() === 'false') {
          const expires = new Date(rows[i][expIdx]);
          if (expires > new Date()) {
            foundRow = i;
            email = rows[i][eIdx];
          }
          break;
        }
      }
      if (foundRow === -1) throw new Error('El enlace ha expirado o ya fue utilizado.');
      const usersSheet = db.getSheetByName('users');
      const userRows = usersSheet.getDataRange().getValues();
      const uHeaders = userRows[0];
      const emailIdx = uHeaders.indexOf('email');
      const pwdIdx = uHeaders.indexOf('password');
      let userFound = false;
      for (let i = 1; i < userRows.length; i++) {
        if (String(userRows[i][emailIdx]).toLowerCase() === String(email).toLowerCase()) {
          usersSheet.getRange(i + 1, pwdIdx + 1).setValue("'" + hashPassword(data.password));
          userFound = true;
          break;
        }
      }
      if (!userFound) throw new Error('Usuario no encontrado.');
      sheet.getRange(foundRow + 1, usedIdx + 1).setValue('true');
      result = { success: true };
    }

  } catch (error) {
    result = { success: false, error: error.toString() };
  }
  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
}

// ============================================================
// FUNCIONES DE RECONOCIMIENTOS EDITABLES (12 GANADORES)
// ============================================================

function generarPremiacionMasiva() {
  const db = SpreadsheetApp.getActiveSpreadsheet();
  const works = getSheetData(db, 'works');
  const scored = works.filter(w => w.live_score && Number(w.live_score) > 0);
  const ciclos = { 
    "Básico": ["1er Semestre", "2do Semestre", "3er Semestre"], 
    "Intermedio": ["4to Semestre", "5to Semestre", "6to Semestre"], 
    "Terminal": ["7mo Semestre", "8vo Semestre", "9no Semestre"] 
  };

  let listaGanadores = [];

  Object.keys(ciclos).forEach(nombreCiclo => {
    const semCiclo = ciclos[nombreCiclo];
    const trCiclo = scored.filter(w => semCiclo.includes(w.semester));

    // Top 2 Ponencia del ciclo
    trCiclo.filter(w => w.status === 'accepted_oral').sort((a,b) => b.live_score - a.live_score).slice(0, 2).forEach((w,i) => {
      listaGanadores.push({ w, l: `${i + 1}er Lugar Ponencia - Ciclo ${nombreCiclo}` });
    });

    // Top 2 Cartel del ciclo
    trCiclo.filter(w => w.status === 'accepted_poster').sort((a,b) => b.live_score - a.live_score).slice(0, 2).forEach((w,i) => {
      listaGanadores.push({ w, l: `${i + 1}er Lugar Cartel - Ciclo ${nombreCiclo}` });
    });
  });

  listaGanadores.forEach(g => crearSlideEditable(g.w, g.w.profesor_cargo || "No asignado", g.l));
  Logger.log(`✅ ${listaGanadores.length} reconocimientos editables generados.`);
}

function crearSlideEditable(work, profesor, lugarTexto) {
  const folder = DriveApp.getFolderById(CERTIFICATES_FOLDER_ID);
  const copy = DriveApp.getFileById(TEMPLATE_ID).makeCopy(`EDITABLE: ${lugarTexto} - ${work.short_id}`, folder);
  const pres = SlidesApp.openById(copy.getId());
  const meses = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
  const hoy = new Date();

  pres.replaceAllText('{{INTEGRANTES}}', work.team_members);
  pres.replaceAllText('{{TITULO}}', work.title);
  pres.replaceAllText('{{PROFESOR}}', profesor);
  pres.replaceAllText('{{MODALIDAD}}', work.status === 'accepted_oral' ? 'Ponencia Oral' : 'Cartel');
  pres.replaceAllText('{{LUGAR}}', lugarTexto);
  pres.replaceAllText('{{FECHA}}', `${hoy.getDate()} de ${meses[hoy.getMonth()]} de ${hoy.getFullYear()}`);
  pres.saveAndClose();
  return copy.getUrl();
}

// --- HELPERS GENERALES ---

function getSheetData(db, name) {
  const sheet = db.getSheetByName(name);
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  const headers = data[0];
  return data.slice(1).map(row => {
    let obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    return obj;
  });
}

function updateRow(db, sheetName, idCol, idVal, updates) {
  const sheet = db.getSheetByName(sheetName);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const colIdx = headers.indexOf(idCol);
  for (let i = 1; i < data.length; i++) {
    if (data[i][colIdx] == idVal) {
      Object.keys(updates).forEach(k => {
        const uIdx = headers.indexOf(k);
        if (uIdx > -1) sheet.getRange(i + 1, uIdx + 1).setValue(updates[k]);
      });
      break;
    }
  }
}