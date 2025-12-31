// --- CONFIGURACIÓN ---
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyxGzFJhSWfnNLNpugqtYZAdJCDdi7OKsVuimAKeI-CxpKftgTbgJz_QTJjf1MLGAi24w/exec'; 

// --- GESTIÓN DE SESIÓN LOCAL ---
function saveSession(user) { localStorage.setItem('congreso_user', JSON.stringify(user)); }
function getSession() { return JSON.parse(localStorage.getItem('congreso_user')); }
function logoutUser() { localStorage.removeItem('congreso_user'); return Promise.resolve(true); }

// --- API CLIENTE ---
const apiClient = {
    // Autenticación
    async loginUser(email, password) {
        try {
            const res = await fetch(`${GOOGLE_SCRIPT_URL}?action=login&email=${email}&password=${password}`);
            const json = await res.json();
            if (json.success) saveSession(json.data.profile);
            return json;
        } catch (e) { return { success: false, error: e.message }; }
    },

    async registerUser(email, password, name, userType) {
        return await postData({ 
            action: 'register', email, password, name, user_type: userType 
        });
    },

    async getUserProfile(id) {
        const s = getSession();
        return (s && s.id === id) ? s : null;
    },

    async checkAuth() {
        const s = getSession();
        return s ? { user: { id: s.id } } : null;
    },

    // Trabajos
    async submitWork(workData, file) {
        try {
            const base64 = await toBase64(file);
            return await postData({
                action: 'submitWork',
                student_id: workData.student_id,
                title: workData.title,
                abstract: workData.abstract,
                modality: workData.modality,
                fileName: file.name,
                fileBase64: base64.split(',')[1]
            });
        } catch (e) { return { success: false, error: e.message }; }
    },

    async getStudentWorks(studentId) {
        const res = await fetch(`${GOOGLE_SCRIPT_URL}?action=getStudentWorks&studentId=${studentId}`);
        const json = await res.json();
        return json.success ? json.data : [];
    },

    async getAllWorks() {
        const res = await fetch(`${GOOGLE_SCRIPT_URL}?action=getWorks`);
        const json = await res.json();
        return json.success ? json.data : [];
    },

    // Admin / Evaluadores
    async getEvaluators() {
        const res = await fetch(`${GOOGLE_SCRIPT_URL}?action=getEvaluators`);
        const json = await res.json();
        return json.success ? json.data : [];
    },

    async getAssignments() {
        const res = await fetch(`${GOOGLE_SCRIPT_URL}?action=getAssignments`);
        const json = await res.json();
        return json.success ? json.data : [];
    },

    async assignWork(workId, evaluatorId) {
        return await postData({
            action: 'assignWork',
            work_id: workId,
            evaluator_id: evaluatorId
        });
    },

    // Evaluación
    async submitEvaluation(evaluationData) {
        // Aseguramos que action esté presente
        evaluationData.action = 'submitEvaluation';
        return await postData(evaluationData);
    },

    async updateWorkStatus(workId, status, finalScore) {
        return await postData({
            action: 'updateWorkStatus',
            work_id: workId,
            status: status,
            final_score: finalScore
        });
    },

    async finalizeAndNotify(workId) {
        return await postData({
            action: 'finalizeAndNotify',
            work_id: workId
        });
    },
};

// --- HELPERS ---
async function postData(data) {
    try {
        const res = await fetch(GOOGLE_SCRIPT_URL, {
            redirect: "follow",
            method: 'POST',
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify(data)
        });
        return await res.json();
    } catch (e) { return { success: false, error: e.message }; }
}

const toBase64 = file => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
});

// Exponer globalmente
window.apiClient = apiClient;
// Mantener compatibilidad temporal si es necesario
window.supabaseClient = apiClient; 