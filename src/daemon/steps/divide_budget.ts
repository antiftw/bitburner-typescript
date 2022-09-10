import { BudgetManager } from "/service/core/BudgetManager";
import Configurator from "/service/core/Configurator";
import { ExceptionHandler } from "/service/diagnostics/ExceptionHandler";

/** @param {NS} ns **/
export async function main(ns: NS): Promise<void> {
    // This step divides the general budget according to the percentages configured in the ConfigurationHandler
    const context = 'LOOP_3';
    try{
        const cfg = new Configurator(ns);
        const verbose = cfg.determineVerbosity(cfg.getConfiguration('steps.divdBudget.verbosity', 'main').getNumberValue());
        const budget = new BudgetManager(ns, verbose);
        await budget.run();
    }catch(e){
        const eh = new ExceptionHandler(ns, context);
        eh.handle(e, 'DIVIDE-BUDGET');
    }
}