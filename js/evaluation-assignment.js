class EvaluationAssignment {
    constructor() { }

    // ✅ CORREGIDO: Ya no se usa para asignación masiva (eso lo hace el backend).
    // Se mantiene para asignación individual desde el admin si se necesita.
    async assignWorksToEvaluators(workId, numberOfEvaluators = 3) {
        try {
            const evaluators = await window.apiClient.getEvaluators();
            if (evaluators.length < numberOfEvaluators) {
                throw new Error(`Se necesitan al menos ${numberOfEvaluators} evaluadores registrados.`);
            }

            const selected = this.selectRandom(evaluators, numberOfEvaluators);

            let count = 0;
            for (const evaluator of selected) {
                const res = await window.apiClient.assignWork(workId, evaluator.id);
                if (res.success) count++;
            }

            if (count !== numberOfEvaluators) {
                throw new Error(`Solo se asignaron ${count} de ${numberOfEvaluators} evaluadores.`);
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

    // ✅ CORREGIDO: Solo devuelve asignaciones PENDIENTES del evaluador (status !== 'completed')
    // El evaluador solo ve lo que le falta evaluar, no lo ya evaluado.
    async getAssignedWorks(evaluatorId) {
        const allAssignments = await window.apiClient.getAssignments();
        return allAssignments.filter(
            a => a.evaluator_id === evaluatorId && a.status !== 'completed'
        );
    }

    // ✅ NUEVO: Devuelve TODAS las asignaciones del evaluador (para historial)
    async getAllAssignedWorks(evaluatorId) {
        const allAssignments = await window.apiClient.getAssignments();
        return allAssignments.filter(a => a.evaluator_id === evaluatorId);
    }

    // ✅ NUEVO: Verifica si un trabajo ya tiene las 3 evaluaciones completas
    isReadyForVerdict(workId, allAssignments) {
        const workAssignments = allAssignments.filter(a => a.work_id === workId);
        const completed = workAssignments.filter(a => a.status === 'completed').length;
        return completed >= 3;
    }
}