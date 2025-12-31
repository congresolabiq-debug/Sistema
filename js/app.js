// Aplicación principal
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

async function initializeApp() {
    // Listeners de Forms
    const loginForm = document.getElementById('loginForm');
    if (loginForm) loginForm.addEventListener('submit', handleLogin);

    const registerForm = document.getElementById('registerForm');
    if (registerForm) registerForm.addEventListener('submit', handleRegister);

    await checkPageAuth();
    await loadPageSpecificContent();
}

async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const btn = e.submitter; // Botón que envió
    
    // UI Loading
    const originalText = btn.innerHTML;
    btn.disabled = true; btn.textContent = "Cargando...";

    const result = await window.apiClient.loginUser(email, password);
    
    if (result.success) {
        const user = result.data.profile;
        if (user.user_type === 'admin') window.location.href = 'admin-dashboard.html';
        else if (user.user_type === 'evaluator') window.location.href = 'evaluator-dashboard.html';
        else window.location.href = 'student-dashboard.html';
    } else {
        alert('❌ Error: ' + result.error);
        btn.disabled = false; btn.innerHTML = originalText;
    }
}

async function handleRegister(e) {
    e.preventDefault();
    const name = document.getElementById('name').value;
    const email = document.getElementById('email').value;
    const type = document.getElementById('userType').value;
    const pass = document.getElementById('password').value;
    
    if (pass.length < 6) return alert('Contraseña muy corta');
    
    const btn = document.querySelector('button[type="submit"]');
    btn.disabled = true; btn.textContent = "Registrando...";

    const result = await window.apiClient.registerUser(email, pass, name, type);
    
    if (result.success) {
        alert('✅ Cuenta creada. Inicia sesión.');
        window.location.href = 'login.html';
    } else {
        alert('❌ Error: ' + result.error);
        btn.disabled = false; btn.textContent = "Crear Cuenta";
    }
}

async function checkPageAuth() {
    const protectedPages = ['student-dashboard', 'evaluator-dashboard', 'admin-dashboard', 'submit-work'];
    const current = window.location.pathname;
    
    if (protectedPages.some(p => current.includes(p))) {
        const session = await window.apiClient.checkAuth();
        if (!session) {
            window.location.href = 'login.html';
            return;
        }
        
        // Verificar roles
        const profile = await window.apiClient.getUserProfile(session.user.id);
        if (current.includes('admin') && profile.user_type !== 'admin') window.location.href = 'index.html';
        if (current.includes('evaluator') && profile.user_type !== 'evaluator' && profile.user_type !== 'admin') window.location.href = 'index.html';
    }
}

async function loadPageSpecificContent() {
    const path = window.location.pathname;
    if (path.includes('student-dashboard')) {
        const user = (await window.apiClient.checkAuth()).user;
        const works = await window.apiClient.getStudentWorks(user.id);
        // Aquí llamas a tu función de renderizado de UI que tenías en el HTML
        if(window.displayWorks) window.displayWorks(works);
    }
}