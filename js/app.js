// Aplicación principal
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

async function initializeApp() {
    console.log('🚀 Inicializando aplicación...');
    
    // Manejar formulario de login
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    // Manejar formulario de registro
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', handleRegister);
    }

    // Verificar autenticación en páginas protegidas
    await checkPageAuth();
    
    // Cargar contenido específico de cada página
    await loadPageSpecificContent();
}

// Manejar login
async function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const loginText = document.getElementById('loginText');
    const loginSpinner = document.getElementById('loginSpinner');
    const submitBtn = document.querySelector('button[type="submit"]');
    
    // Validaciones básicas
    if (!email || !password) {
        alert('❌ Por favor completa todos los campos');
        return;
    }
    
    // Mostrar loading
    loginText.textContent = 'Iniciando sesión...';
    loginSpinner.classList.remove('d-none');
    submitBtn.disabled = true;
    
    try {
        const result = await window.supabaseClient.loginUser(email, password);
        
        if (result.success) {
            loginText.textContent = '¡Éxito! Redirigiendo...';
            
            // Determinar redirección basada en el tipo de usuario
            const userType = result.data.profile?.user_type || 
                           determineUserType(email);
            
            setTimeout(() => {
                if (userType === 'evaluator' || userType === 'admin') {
                    window.location.href = 'evaluator-dashboard.html';
                } else {
                    window.location.href = 'student-dashboard.html';
                }
            }, 1000);
            
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        console.error('❌ Error en login:', error);
        resetLoginButton(loginText, loginSpinner, submitBtn);
        showLoginError(error);
    }
}

// Manejar registro
async function handleRegister(e) {
    e.preventDefault();
    
    const name = document.getElementById('name').value;
    const email = document.getElementById('email').value;
    const userType = document.getElementById('userType').value;
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    
    const registerText = document.getElementById('registerText');
    const registerSpinner = document.getElementById('registerSpinner');
    const submitBtn = document.querySelector('button[type="submit"]');
    
    // Validaciones
    if (password !== confirmPassword) {
        alert('❌ Las contraseñas no coinciden');
        return;
    }
    
    if (password.length < 6) {
        alert('❌ La contraseña debe tener al menos 6 caracteres');
        return;
    }
    
    if (!userType) {
        alert('❌ Por favor selecciona un tipo de usuario');
        return;
    }
    
    // Mostrar loading
    registerText.textContent = 'Creando cuenta...';
    registerSpinner.classList.remove('d-none');
    submitBtn.disabled = true;
    
    try {
        const result = await window.supabaseClient.registerUser(email, password, name, userType);
        
        if (result.success) {
            registerText.textContent = '¡Cuenta creada!';
            
            alert('✅ Cuenta creada exitosamente. Ya puedes iniciar sesión.');
            
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 2000);
            
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        console.error('❌ Error en registro:', error);
        resetRegisterButton(registerText, registerSpinner, submitBtn);
        showRegisterError(error);
    }
}

// Determinar tipo de usuario por email
function determineUserType(email) {
    if (email.includes('profesor') || email.includes('evaluador') || 
        email.includes('comite') || email.includes('admin')) {
        return 'evaluator';
    }
    return 'student';
}
// Cargar dashboard del estudiante
async function loadStudentDashboard() {
    try {
        const user = await window.supabaseClient.getCurrentUser();
        if (!user) return;
        
        const works = await window.supabaseClient.getStudentWorks(user.id);
        displayStudentWorks(works);
    } catch (error) {
        console.error('Error cargando dashboard estudiante:', error);
        showError('worksList', 'Error cargando trabajos: ' + error.message);
    }
}

// Cargar dashboard del evaluador
async function loadEvaluatorDashboard() {
    try {
        const works = await window.supabaseClient.getWorksForEvaluation();
        displayEvaluatorWorks(works);
        updateStatistics(works);
    } catch (error) {
        console.error('Error cargando dashboard evaluador:', error);
        showError('worksList', 'Error cargando trabajos: ' + error.message);
    }
}

// Mostrar trabajos del estudiante
function displayStudentWorks(works) {
    const container = document.getElementById('worksList');
    if (!container) return;
    
    if (!works || works.length === 0) {
        container.innerHTML = `
            <div class="text-center py-5">
                <div class="text-muted">
                    <p class="h3">📝</p>
                    <p class="h5">No hay trabajos enviados</p>
                    <p class="mb-0">Envía tu primer trabajo usando el botón "Nuevo Trabajo"</p>
                </div>
            </div>
        `;
        return;
    }
    
    container.innerHTML = works.map(work => {
        const statusInfo = getStatusInfo(work.status);
        const daysAgo = getDaysAgo(work.submitted_at);
        
        return `
            <div class="card work-item-card mb-3">
                <div class="card-body">
                    <div class="row">
                        <div class="col-md-8">
                            <h5 class="card-title text-primary">${work.title}</h5>
                            <p class="card-text mb-2">
                                <strong>Estado:</strong> <span class="badge ${statusInfo.class}">${statusInfo.icon} ${statusInfo.text}</span><br>
                                <strong>Modalidad:</strong> ${work.modality === 'ponencia' ? '🎤 Ponencia' : '📊 Póster'}<br>
                                <strong>Enviado:</strong> Hace ${daysAgo} días
                            </p>
                            <div class="mt-3">
                                <a href="${work.file_url}" target="_blank" class="btn btn-sm btn-outline-primary me-2">
                                    📎 Ver Archivo
                                </a>
                            </div>
                        </div>
                        <div class="col-md-4 text-end">
                            <small class="text-muted">
                                ID: ${work.id.substring(0, 8)}...
                            </small>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Información del estado
function getStatusInfo(status) {
    const statusMap = {
        'pending': { class: 'bg-warning text-dark', icon: '📝', text: 'Pendiente' },
        'under_review': { class: 'bg-info text-white', icon: '🔍', text: 'En revisión' },
        'accepted_oral': { class: 'bg-success text-white', icon: '✅', text: 'Ponencia' },
        'accepted_poster': { class: 'bg-success text-white', icon: '✅', text: 'Póster' },
        'rejected': { class: 'bg-danger text-white', icon: '❌', text: 'Rechazado' }
    };
    return statusMap[status] || { class: 'bg-secondary text-white', icon: '❓', text: status };
}

// Calcular días desde el envío
function getDaysAgo(dateString) {
    const submitted = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - submitted);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

// Mostrar trabajos para evaluador
function displayEvaluatorWorks(works) {
    const container = document.getElementById('worksList');
    if (!container) return;
    
    if (!works || works.length === 0) {
        container.innerHTML = `
            <div class="text-center py-5">
                <div class="text-muted">
                    <p class="h3">📝</p>
                    <p class="h5">No hay trabajos para evaluar</p>
                    <p class="mb-0">Todos los trabajos han sido evaluados</p>
                </div>
            </div>
        `;
        return;
    }
    
    container.innerHTML = works.map(work => {
        const statusInfo = getStatusInfo(work.status);
        const studentName = work.user_profiles ? work.user_profiles.name : 'Estudiante';
        const daysAgo = getDaysAgo(work.submitted_at);
        
        return `
            <div class="card work-item-card mb-3">
                <div class="card-body">
                    <div class="row">
                        <div class="col-md-8">
                            <h5 class="card-title text-primary">${work.title}</h5>
                            <p class="card-text mb-2">
                                <strong>Estudiante:</strong> ${studentName}<br>
                                <strong>Modalidad:</strong> ${work.modality === 'ponencia' ? '🎤 Ponencia' : '📊 Póster'}<br>
                                <strong>Enviado:</strong> Hace ${daysAgo} días
                            </p>
                            <div class="mt-3">
                                <a href="${work.file_url}" target="_blank" class="btn btn-sm btn-outline-primary me-2">
                                    📎 Ver Archivo
                                </a>
                                <button class="btn btn-sm btn-success" onclick="openEvaluation('${work.id}')">
                                    ⭐ Evaluar
                                </button>
                            </div>
                        </div>
                        <div class="col-md-4 text-end">
                            <span class="badge ${statusInfo.class}">${statusInfo.icon} ${statusInfo.text}</span>
                            <br>
                            <small class="text-muted mt-2 d-block">
                                ID: ${work.id.substring(0, 8)}...
                            </small>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Actualizar estadísticas
function updateStatistics(works) {
    const total = works.length;
    const pending = works.filter(work => work.status === 'pending').length;
    const reviewed = works.filter(work => work.status === 'under_review').length;
    const completed = works.filter(work => 
        work.status === 'accepted_oral' || 
        work.status === 'accepted_poster' || 
        work.status === 'rejected'
    ).length;

    document.getElementById('totalWorks').textContent = total;
    document.getElementById('pendingWorks').textContent = pending;
    document.getElementById('reviewedWorks').textContent = reviewed;
    document.getElementById('completedWorks').textContent = completed;
}

// Funciones auxiliares
function resetLoginButton(textElement, spinnerElement, buttonElement) {
    textElement.textContent = 'Ingresar al Portal';
    spinnerElement.classList.add('d-none');
    buttonElement.disabled = false;
}

function resetRegisterButton(textElement, spinnerElement, buttonElement) {
    textElement.textContent = 'Crear Cuenta';
    spinnerElement.classList.add('d-none');
    buttonElement.disabled = false;
}

function showLoginError(error) {
    let message = 'Error al iniciar sesión';
    if (error.message.includes('Invalid login credentials')) {
        message = 'Email o contraseña incorrectos';
    } else if (error.message.includes('Email not confirmed')) {
        message = 'Por favor confirma tu email primero';
    } else {
        message = error.message;
    }
    alert('❌ ' + message);
}

function showRegisterError(error) {
    let message = 'Error al crear la cuenta';
    if (error.message.includes('User already registered')) {
        message = 'Este email ya está registrado';
    } else if (error.message.includes('Password should be at least')) {
        message = 'La contraseña debe tener al menos 6 caracteres';
    } else if (error.message.includes('Invalid email')) {
        message = 'El formato del email no es válido';
    } else {
        message = error.message;
    }
    alert('❌ ' + message);
}

function showError(containerId, message) {
    const container = document.getElementById(containerId);
    if (container) {
        container.innerHTML = `
            <div class="alert alert-danger">
                <strong>Error:</strong> ${message}
            </div>
        `;
    }
}

// Funciones globales
window.openEvaluation = function(workId) {
    // Esta función se implementa en evaluator-dashboard.html
    console.log('Abrir evaluación para trabajo:', workId);
    alert('Funcionalidad de evaluación - Ver evaluator-dashboard.html para implementación completa');
};

// Hacer funciones disponibles globalmente
window.supabaseApp = {
    initializeApp,
    handleLogin,
    handleRegister,
    loadStudentDashboard,
    loadEvaluatorDashboard,
    displayStudentWorks,
    displayEvaluatorWorks,
    updateStatistics
};

// Mostrar trabajos en la lista
function displayWorks(works, userType) {
    const worksContainer = document.getElementById('worksList');
    if (!worksContainer) return;
    
    if (works.length === 0) {
        worksContainer.innerHTML = `
            <div class="text-center py-5">
                <p class="text-muted">No hay trabajos para mostrar</p>
            </div>
        `;
        return;
    }
    
    worksContainer.innerHTML = works.map(work => {
        const statusClass = `status-${work.status.toLowerCase().replace(' ', '-')}`;
        
        if (userType === 'student') {
            return `
                <div class="work-card">
                    <div class="d-flex justify-content-between align-items-start">
                        <div class="flex-grow-1">
                            <h5>${work.title}</h5>
                            <p class="mb-1"><strong>Estado:</strong> <span class="${statusClass}">${work.status}</span></p>
                            <p class="mb-1"><strong>Fecha de envío:</strong> ${work.date}</p>
                            <p class="mb-1"><strong>Modalidad:</strong> ${work.modality}</p>
                            <p class="mb-1"><strong>Archivo:</strong> ${work.filename}</p>
                            ${work.score ? `<p class="mb-0"><strong>Calificación:</strong> ${work.score}/100</p>` : ''}
                        </div>
                        <div class="ms-3">
                            <span class="badge bg-secondary">${work.modality}</span>
                        </div>
                    </div>
                </div>
            `;
        } else {
            // Vista para evaluador
            return `
                <div class="work-card">
                    <div class="d-flex justify-content-between align-items-start">
                        <div class="flex-grow-1">
                            <h5>${work.title}</h5>
                            <p class="mb-1"><strong>Estudiante:</strong> ${work.student}</p>
                            <p class="mb-1"><strong>Estado:</strong> <span class="${statusClass}">${work.status}</span></p>
                            <p class="mb-1"><strong>Fecha de envío:</strong> ${work.date}</p>
                            <p class="mb-1"><strong>Modalidad propuesta:</strong> ${work.modality}</p>
                            <p class="mb-2"><strong>Evaluaciones realizadas:</strong> ${work.evaluations}</p>
                            <button class="btn btn-sm btn-outline-primary" onclick="evaluateWork(${work.id})">
                                Evaluar Trabajo
                            </button>
                        </div>
                        <div class="ms-3">
                            <span class="badge bg-secondary">${work.modality}</span>
                        </div>
                    </div>
                </div>
            `;
        }
    }).join('');
}

// Configurar formulario de envío
function setupSubmitForm() {
    const form = document.getElementById('submitWorkForm');
    if (form) {
        form.addEventListener('submit', handleWorkSubmit);
    }
}

// Manejar envío de trabajo
async function handleWorkSubmit(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const workData = {
        title: formData.get('title'),
        abstract: formData.get('abstract'),
        modality: formData.get('modality')
    };
    
    // Aquí iría la lógica para subir el archivo y guardar en Supabase
    alert('Trabajo enviado correctamente (simulación)');
    window.location.href = 'student-dashboard.html';
}

// Verificar autenticación en páginas protegidas - VERSIÓN CORREGIDA
async function checkPageAuth() {
    const protectedPages = ['student-dashboard', 'evaluator-dashboard', 'submit-work'];
    const currentPage = window.location.pathname;
    
    const isProtected = protectedPages.some(page => currentPage.includes(page));
    
    if (isProtected) {
        try {
            const session = await window.supabaseClient.checkAuth();
            if (!session) {
                window.location.href = 'login.html';
                return false;
            }
            
            // OBTENER EL PERFIL PRIMERO - ESTO ES CLAVE
            const profile = await window.supabaseClient.getUserProfile(session.user.id);
            console.log('🔍 Perfil del usuario:', profile);
            
            if (!profile) {
                console.error('❌ No se pudo obtener el perfil del usuario');
                // Redirigir a login si no hay perfil
                window.location.href = 'login.html';
                return false;
            }
            
            // Verificación específica para panel de evaluador
            if (currentPage.includes('evaluator-dashboard')) {
                const isEvaluator = profile.user_type === 'evaluator' || profile.user_type === 'admin';
                console.log(`👨‍🏫 ¿Es evaluador? ${isEvaluator} (tipo: ${profile.user_type})`);
                
                if (!isEvaluator) {
                    alert('❌ No tienes permisos para acceder al panel de evaluador. Tu cuenta es de tipo: ' + profile.user_type);
                    window.location.href = 'student-dashboard.html';
                    return false;
                }
            }
            
            // Verificación para panel de estudiante
            if (currentPage.includes('student-dashboard') && profile.user_type === 'evaluator') {
                console.log('⚠️ Evaluador intentando acceder a panel de estudiante - permitiendo');
                // Permitimos que evaluadores vean el panel de estudiante si quieren
            }
            
            return true;
            
        } catch (error) {
            console.error('Error verificando autenticación:', error);
            window.location.href = 'login.html';
            return false;
        }
    }
    
    return true;
}

// Cargar contenido específico de página
async function loadPageSpecificContent() {
    const path = window.location.pathname;
    
    if (path.includes('student-dashboard')) {
        await loadStudentDashboard();
    } else if (path.includes('evaluator-dashboard')) {
        await loadEvaluatorDashboard();
    }
}
// Función para evaluar trabajo (simulación)
function evaluateWork(workId) {
    alert(`Evaluando trabajo ID: ${workId} - Esta funcionalidad se implementará después`);
}