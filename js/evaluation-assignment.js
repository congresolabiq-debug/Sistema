// Sistema de designación aleatoria de trabajos para evaluación
class EvaluationAssignment {
    constructor() {
        this.supabase = window.supabaseClient.supabase;
    }

    // Método principal para asignar trabajos a evaluadores
    async assignWorksToEvaluators(workId, numberOfEvaluators = 3) {
        try {
            console.log(`🎯 Asignando trabajo ${workId} a ${numberOfEvaluators} evaluadores...`);

            // 1. Obtener todos los evaluadores disponibles
            const evaluators = await this.getAvailableEvaluators();
            if (evaluators.length === 0) {
                throw new Error('No hay evaluadores disponibles en el sistema');
            }

            // 2. Seleccionar evaluadores aleatoriamente
            const selectedEvaluators = this.selectRandomEvaluators(evaluators, numberOfEvaluators);
            console.log('✅ Evaluadores seleccionados:', selectedEvaluators);

            // 3. Crear las asignaciones en la base de datos
            const assignments = await this.createAssignments(workId, selectedEvaluators);
            
            // 4. Actualizar estado del trabajo
            await this.updateWorkStatus(workId, 'under_review');

            return {
                success: true,
                assignments: assignments,
                message: `Trabajo asignado a ${selectedEvaluators.length} evaluadores`
            };

        } catch (error) {
            console.error('❌ Error en asignación:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Obtener evaluadores disponibles
// En evaluation-assignment.js - reemplaza la función getAvailableEvaluators
async getAvailableEvaluators() {
    try {
        console.log('🔍 Buscando evaluadores disponibles...');
        
        const { data, error } = await supabase
            .from('user_profiles')
            .select('id, name, email, user_type')
            .eq('user_type', 'evaluator')
            .not('id', 'is', null);

        if (error) {
            console.error('Error obteniendo evaluadores:', error);
            // Si falla por is_active, intentar sin ese filtro
            const { data: fallbackData, error: fallbackError } = await supabase
                .from('user_profiles')
                .select('id, name, email, user_type')
                .eq('user_type', 'evaluator')
                .not('id', 'is', null);
                
            if (fallbackError) throw fallbackError;
            return fallbackData || [];
        }
        
        console.log(`✅ Encontrados ${data?.length || 0} evaluadores`);
        return data || [];
        
    } catch (error) {
        console.error('Error crítico obteniendo evaluadores:', error);
        return [];
    }
}

    // Seleccionar evaluadores aleatoriamente
    selectRandomEvaluators(evaluators, count) {
        if (evaluators.length <= count) {
            return evaluators; // Si hay menos evaluadores que los requeridos, usar todos
        }

        // Mezclar array y seleccionar los primeros 'count'
        const shuffled = [...evaluators].sort(() => 0.5 - Math.random());
        return shuffled.slice(0, count);
    }

    // Crear asignaciones en la base de datos
    async createAssignments(workId, evaluators) {
        const assignments = evaluators.map(evaluator => ({
            work_id: workId,
            evaluator_id: evaluator.id,
            assigned_at: new Date().toISOString(),
            status: 'assigned' // assigned, in_progress, completed
        }));

        const { data, error } = await this.supabase
            .from('evaluation_assignments')
            .insert(assignments)
            .select();

        if (error) throw error;

        return data;
    }

    // Actualizar estado del trabajo
    async updateWorkStatus(workId, status) {
        const { error } = await this.supabase
            .from('works')
            .update({ 
                status: status,
                updated_at: new Date().toISOString()
            })
            .eq('id', workId);

        if (error) throw error;
    }

    // Obtener trabajos asignados a un evaluador específico
    async getAssignedWorks(evaluatorId) {
        try {
            const { data, error } = await this.supabase
                .from('evaluation_assignments')
                .select(`
                    *,
                    works (
                        id,
                        title,
                        abstract,
                        modality,
                        file_url,
                        status,
                        submitted_at,
                        user_profiles (name, email)
                    )
                `)
                .eq('evaluator_id', evaluatorId)
                .order('assigned_at', { ascending: false });

            if (error) throw error;

            return data || [];
        } catch (error) {
            console.error('Error obteniendo trabajos asignados:', error);
            return [];
        }
    }

    // Verificar si un trabajo ya fue evaluado por un evaluador
    async hasEvaluatorRatedWork(workId, evaluatorId) {
        try {
            const { data, error } = await this.supabase
                .from('evaluations')
                .select('id')
                .eq('work_id', workId)
                .eq('evaluator_id', evaluatorId)
                .single();

            return !!data; // Retorna true si ya existe una evaluación
        } catch (error) {
            return false;
        }
    }

    // Obtener estadísticas de asignaciones
    async getAssignmentStats() {
        try {
            const { data, error } = await this.supabase
                .from('evaluation_assignments')
                .select('status, works(status)');

            if (error) throw error;

            const stats = {
                total: data.length,
                assigned: data.filter(a => a.status === 'assigned').length,
                in_progress: data.filter(a => a.status === 'in_progress').length,
                completed: data.filter(a => a.status === 'completed').length
            };

            return stats;
        } catch (error) {
            console.error('Error obteniendo estadísticas:', error);
            return null;
        }
    }
}

// Funciones auxiliares globales
function getAssignmentStatusInfo(status) {
    const statusMap = {
        'assigned': { badge: '<span class="badge bg-warning">📋 Asignado</span>', text: 'Asignado' },
        'in_progress': { badge: '<span class="badge bg-info">🔍 En Progreso</span>', text: 'En Progreso' },
        'completed': { badge: '<span class="badge bg-success">✅ Completado</span>', text: 'Completado' }
    };
    return statusMap[status] || { badge: '<span class="badge bg-secondary">❓ Desconocido</span>', text: 'Desconocido' };
}

function getDaysAgo(dateString) {
    const submitted = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - submitted);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

// Exportar para uso global
window.EvaluationAssignment = EvaluationAssignment;
window.getAssignmentStatusInfo = getAssignmentStatusInfo;
window.getDaysAgo = getDaysAgo;