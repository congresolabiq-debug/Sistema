// Configuración de Supabase - REEMPLAZA con tus credenciales reales
const SUPABASE_URL = 'https://tapvkxfblkbarskdmxdo.supabase.co';  // Cambiar por tu URL
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRhcHZreGZibGtiYXJza2RteGRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA0MzE1OTAsImV4cCI6MjA3NjAwNzU5MH0._AaRXoxSzTyY5FTpX7sD3f6WnlKiLCk1DkpixmTyP8o';           // Cambiar por tu key

// Inicializar Supabase
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Verificar autenticación
async function checkAuth() {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) throw error;
    return session;
}

// Función mejorada de login
async function loginUser(email, password) {
    try {
        console.log('🔐 Intentando login con:', email);
        
        const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password
        });
        
        if (error) throw error;
        
        // Obtener perfil del usuario
        const profile = await getUserProfile(data.user.id);
        
        return { 
            success: true, 
            data: {
                ...data,
                profile: profile
            }
        };
        
    } catch (error) {
        console.error('❌ Error en login:', error);
        return { 
            success: false, 
            error: error.message 
        };
    }
}

// Obtener perfil del usuario - VERSIÓN MEJORADA
async function getUserProfile(userId) {
    try {
        console.log('🔍 Obteniendo perfil para usuario:', userId);
        
        const { data, error } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('id', userId)
            .single();
        
        if (error) {
            console.error('❌ Error obteniendo perfil:', error);
            
            // Si es error de "no encontrado", podríamos crear el perfil automáticamente
            if (error.code === 'PGRST116') {
                console.log('⚠️ Perfil no encontrado, intentando crear uno...');
                return await createUserProfileFromAuth(userId);
            }
            
            return null;
        }
        
        console.log('✅ Perfil obtenido:', data);
        return data;
        
    } catch (error) {
        console.error('❌ Error en getUserProfile:', error);
        return null;
    }
}

// Función auxiliar para crear perfil si no existe
async function createUserProfileFromAuth(userId) {
    try {
        // Obtener información del usuario desde Auth
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error || !user) throw error;
        
        const userData = user.user_metadata;
        
        console.log('📝 Creando perfil automáticamente para:', user.email);
        
        const { data: newProfile, error: insertError } = await supabase
            .from('user_profiles')
            .insert([
                {
                    id: userId,
                    email: user.email,
                    name: userData.name || user.email.split('@')[0],
                    user_type: userData.user_type || 'student',
                    created_at: new Date().toISOString()
                }
            ])
            .select()
            .single();
        
        if (insertError) {
            console.error('❌ Error creando perfil automáticamente:', insertError);
            return null;
        }
        
        console.log('✅ Perfil creado automáticamente:', newProfile);
        return newProfile;
        
    } catch (error) {
        console.error('❌ Error en createUserProfileFromAuth:', error);
        return null;
    }
}

// Función mejorada para registrar usuario
async function registerUser(email, password, name, userType) {
    try {
        console.log('📝 Registrando usuario:', { email, name, userType });
        
        const { data, error } = await supabase.auth.signUp({
            email: email,
            password: password,
            options: {
                data: {
                    name: name,
                    user_type: userType
                }
            }
        });
        
        if (error) throw error;
        
        console.log('✅ Usuario registrado en auth:', data.user?.id);
        
        // Crear perfil de usuario en la tabla user_profiles
        if (data.user) {
            const { error: profileError } = await supabase
                .from('user_profiles')
                .insert([
                    {
                        id: data.user.id,
                        email: email,
                        name: name,
                        user_type: userType,
                        created_at: new Date().toISOString()
                    }
                ]);
            
            if (profileError) {
                console.error('❌ Error creando perfil:', profileError);
                // Si hay error creando el perfil, eliminamos el usuario de auth
                await supabase.auth.admin.deleteUser(data.user.id);
                throw profileError;
            }
            
            console.log('✅ Perfil de usuario creado exitosamente');
        }
        
        return { success: true, data };
    } catch (error) {
        console.error('❌ Error completo en registro:', error);
        return { success: false, error: error.message };
    }
}

// Verificar sesión activa
async function getCurrentSession() {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) throw error;
    return session;
}

// Obtener usuario actual
async function getCurrentUser() {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) throw error;
    return user;
}

// Cerrar sesión
async function logoutUser() {
    try {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        return true;
    } catch (error) {
        console.error('Error cerrando sesión:', error);
        throw error;
    }
}
// Obtener trabajos del alumno
async function getStudentWorks(studentId) {
    try {
        const { data, error } = await supabase
            .from('works')
            .select('*')
            .eq('student_id', studentId)
            .order('submitted_at', { ascending: false });
        
        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Error obteniendo trabajos:', error);
        return [];
    }
}


// Función MEJORADA para obtener trabajos para evaluación
async function getWorksForEvaluation() {
    try {
        console.log('🔍 Ejecutando consulta para evaluación...');
        
        // Consulta con join para obtener información del estudiante
        const { data, error } = await supabase
            .from('works')
            .select(`
                *,
                user_profiles (
                    name,
                    email
                )
            `)
            .order('submitted_at', { ascending: false });
        
        if (error) {
            console.error('❌ Error en consulta:', error);
            
            // Fallback: consulta simple sin relaciones
            console.log('🔄 Intentando consulta simple...');
            const { data: simpleData, error: simpleError } = await supabase
                .from('works')
                .select('*')
                .order('submitted_at', { ascending: false });
                
            if (simpleError) throw simpleError;
            
            return simpleData || [];
        }
        
        console.log(`✅ ${data?.length || 0} trabajos encontrados`);
        return data || [];
        
    } catch (error) {
        console.error('❌ Error completo en getWorksForEvaluation:', error);
        throw error;
    }
}


// Enviar nuevo trabajo (REAL)
async function submitWork(workData) {
    try {
        const { data, error } = await supabase
            .from('works')
            .insert([workData]);
        
        if (error) throw error;
        return { success: true, data };
    } catch (error) {
        console.error('Error enviando trabajo:', error);
        return { success: false, error: error.message };
    }
}

// Crear evaluación
async function createEvaluation(evaluationData) {
    try {
        console.log('📊 Creando evaluación:', evaluationData);
        
        const { data, error } = await supabase
            .from('evaluations')
            .insert([evaluationData])
            .select();
        
        if (error) throw error;
        
        console.log('✅ Evaluación creada exitosamente');
        return { success: true, data };
    } catch (error) {
        console.error('❌ Error creando evaluación:', error);
        return { success: false, error: error.message };
    }
}

// Función para obtener evaluaciones existentes
async function getWorkEvaluations(workId) {
    try {
        const { data, error } = await supabase
            .from('evaluations')
            .select('*')
            .eq('work_id', workId);
        
        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error obteniendo evaluaciones:', error);
        return [];
    }
}

// Actualizar estado del trabajo
async function updateWorkStatus(workId, status) {
    try {
        const { error } = await supabase
            .from('works')
            .update({ 
                status: status,
                updated_at: new Date().toISOString()
            })
            .eq('id', workId);
        
        if (error) throw error;
        return { success: true };
    } catch (error) {
        console.error('Error actualizando trabajo:', error);
        return { success: false, error: error.message };
    }
}

// Verificar si el usuario es evaluador
async function isUserEvaluator(userId) {
    try {
        const profile = await getUserProfile(userId);
        return profile && (profile.user_type === 'evaluator' || profile.user_type === 'admin');
    } catch (error) {
        console.error('Error verificando rol:', error);
        return false;
    }
}

// Verificar si el usuario es administrador
async function isUserAdmin(userId) {
    try {
        const profile = await getUserProfile(userId);
        return profile && profile.user_type === 'admin';
    } catch (error) {
        console.error('Error verificando rol admin:', error);
        return false;
    }
}

// Exportar funciones para uso global
window.supabaseClient = {
    supabase,
    loginUser,
    registerUser,
    getCurrentUser,
    logoutUser,
    checkAuth,
    getUserProfile,
    getStudentWorks,
    getWorksForEvaluation,
    createEvaluation,
    updateWorkStatus,
    isUserEvaluator,
    isUserAdmin
};