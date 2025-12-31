const DRIVE_FOLDER_ID = 'ID_DE_TU_CARPETA_DRIVE'; // ¡CAMBIA ESTO!

function doGet(e) {
  const action = e.parameter.action;
  const db = SpreadsheetApp.getActiveSpreadsheet();
  let result = {};

  try {
    // LOGIN
    if (action === 'login') {
      const users = getSheetData(db, 'users');
      const user = users.find(u => u.email === e.parameter.email && u.password === e.parameter.password);
      if (user) {
        result = { success: true, data: { user: { id: user.id }, profile: user } };
      } else {
        result = { success: false, error: 'Credenciales inválidas' };
      }
    } 
    // OBTENER TRABAJOS (ADMIN/EVALUADOR)
    else if (action === 'getWorks') {
      const works = getSheetData(db, 'works');
      const users = getSheetData(db, 'users');
      const data = works.map(w => ({
        ...w,
        student_name: (users.find(u => u.id === w.student_id) || {}).name || 'Desconocido'
      }));
      result = { success: true, data: data };
    }
    // OBTENER TRABAJOS DE UN ESTUDIANTE
    else if (action === 'getStudentWorks') {
      const studentId = e.parameter.studentId;
      const works = getSheetData(db, 'works');
      const data = works.filter(w => w.student_id === studentId);
      result = { success: true, data: data };
    }
    // OBTENER EVALUADORES
    else if (action === 'getEvaluators') {
       const users = getSheetData(db, 'users');
       result = { success: true, data: users.filter(u => u.user_type === 'evaluator') };
    }
    // OBTENER ASIGNACIONES
    else if (action === 'getAssignments') {
      const assignments = getSheetData(db, 'assignments');
      const works = getSheetData(db, 'works');
      const users = getSheetData(db, 'users');
      
      const enriched = assignments.map(a => {
        const work = works.find(w => w.id === a.work_id);
        const evaluator = users.find(u => u.id === a.evaluator_id);
        const student = work ? users.find(u => u.id === work.student_id) : null;
        return {
          ...a,
          works: { ...work, student_name: student ? student.name : '' },
          user_profiles: evaluator
        };
      });
      result = { success: true, data: enriched };
    }

  } catch (error) {
    result = { success: false, error: error.toString() };
  }
  
  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const db = SpreadsheetApp.getActiveSpreadsheet();
  let result = {};

  try {
    const data = JSON.parse(e.postData.contents);

    // REGISTRO
    if (data.action === 'register') {
      const users = getSheetData(db, 'users');
      if (users.find(u => u.email === data.email)) throw new Error('Email ya registrado');
      
      const id = Utilities.getUuid();
      db.getSheetByName('users').appendRow([id, data.email, data.password, data.name, data.user_type, new Date()]);
      result = { success: true };
    }
    // SUBIR TRABAJO
    else if (data.action === 'submitWork') {
      const folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
      const blob = Utilities.newBlob(Utilities.base64Decode(data.fileBase64), 'application/pdf', data.fileName);
      const file = folder.createFile(blob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      
      const id = Utilities.getUuid();
      db.getSheetByName('works').appendRow([
        id, data.student_id, data.title, data.abstract, data.modality, 
        file.getUrl(), file.getId(), 'pending', new Date(), ''
      ]);
      result = { success: true };
    }
    // ASIGNAR TRABAJO
    else if (data.action === 'assignWork') {
       const id = Utilities.getUuid();
       db.getSheetByName('assignments').appendRow([id, data.work_id, data.evaluator_id, 'assigned', new Date(), '']);
       updateRow(db, 'works', 'id', data.work_id, { status: 'under_review' });
       result = { success: true, id: id }; // Devolver ID asignación
    }
    // ENVIAR EVALUACIÓN
    else if (data.action === 'submitEvaluation') {
       const id = Utilities.getUuid();
       // Guardar evaluación (simplificado, añade todas tus columnas aquí)
       db.getSheetByName('evaluations').appendRow([
         id, data.work_id, data.evaluator_id, data.total_score, 
         data.modalidad_sugerida, data.comentarios, new Date()
       ]);
       
       // Marcar asignación como completada
       // Nota: data.assignment_id debe venir del frontend
       if (data.assignment_id) {
         updateRow(db, 'assignments', 'id', data.assignment_id, { status: 'completed', completed_at: new Date() });
       }
       result = { success: true };
    }
    // ACTUALIZAR ESTADO TRABAJO (Finalizar)
    else if (data.action === 'updateWorkStatus') {
       updateRow(db, 'works', 'id', data.work_id, { status: data.status, final_score: data.final_score });
       result = { success: true };
    }

  } catch (error) {
    result = { success: false, error: error.toString() };
  }
  
  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
}

// Helpers
function getSheetData(db, name) {
  const sheet = db.getSheetByName(name);
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
      Object.keys(updates).forEach(key => {
        const updateIdx = headers.indexOf(key);
        if (updateIdx > -1) sheet.getRange(i + 1, updateIdx + 1).setValue(updates[key]);
      });
      break;
    }
  }
}