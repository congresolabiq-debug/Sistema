class EvaluationAssignment {
    constructor() {}

    async assignWorksToEvaluators(workId, numberOfEvaluators = 3) {
        try {
            // 1. Obtener evaluadores
            const evaluators = await window.apiClient.getEvaluators();
            if (evaluators.length === 0) throw new Error('No hay evaluadores disponibles');

            // 2. Seleccionar aleatorios
            const selected = this.selectRandom(evaluators, numberOfEvaluators);
            
            // 3. Asignar uno por uno (GAS no soporta batch insert fácil en este script simple)
            let count = 0;
            for (const evaluator of selected) {
                const res = await window.apiClient.assignWork(workId, evaluator.id);
                if (res.success) count++;
            }

            return { success: true, message: `Asignado a ${count} evaluadores` };

        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    selectRandom(arr, n) {
        const shuffled = [...arr].sort(() => 0.5 - Math.random());
        return shuffled.slice(0, n);
    }
    
    // Método helper para el dashboard evaluador
    async getAssignedWorks(evaluatorId) {
        const allAssignments = await window.apiClient.getAssignments();
        // Filtramos localmente
        return allAssignments.filter(a => a.evaluator_id === evaluatorId);
    }
}