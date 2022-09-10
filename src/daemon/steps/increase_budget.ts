import { BudgetManager } from "/service/core/BudgetManager";
import Configurator from "/service/core/Configurator";
import { ExceptionHandler } from "/service/diagnostics/ExceptionHandler";
import Logger from "/service/diagnostics/Logger";

/** @param {NS} ns **/
export async function main(ns: NS): Promise<void> {
    // This step increases the budget with a specified amount (if applicable)
    const context = 'LOOP_2';
    const eh = new ExceptionHandler(ns, context);
    try{
        let forceRefresh = ns.args[0];
        let amount = ns.args[1];
        const cfg = new Configurator(ns);

        const verbose = cfg.determineVerbosity(cfg.getConfiguration('steps.incrBudget.verbosity', 'main').getNumberValue());
        const logger = new Logger(ns, verbose, context);

        if(typeof forceRefresh === 'undefined') {
            forceRefresh = false;
        }
        if( typeof amount === 'undefined') {
            amount = 0;
        }

        if(typeof amount !== 'number' && typeof amount !== 'boolean') {
            // this means we (are expecting to) have an argument similar to 43k, 2m, 1b or 100t to apply the associated multiplier
            let multiplier = 1;
            if(amount.slice(-1) === 'k') {
                multiplier = 1000;
            }else if(amount.slice(-1) === 'm') {
                multiplier = 1000000;
            }else if(amount.slice(-1) === 'b') {
                multiplier = 1000000000;
            }else if(amount.slice(-1) === 't') {
                multiplier = 1000000000000;
            }else {
                logger.notify(`Unknown multiplier. Type --help for usage options.`);
                return;
            }
            // remove the last character (keeping the number part and removing the string part) + Apply multiplier
            amount =  multiplier * Number(amount.slice(0, amount.length - 1));
            if(isNaN(amount)) {
                logger.notify(`Unknown multiplier. Type --help for usage options.`);
                return;
            }
        }

        // Do the actual work, add the calculated amount to the general budget
        const budget = new BudgetManager(ns, verbose);
        await budget.init(Boolean(forceRefresh));
        await budget.increaseBudget(Number(amount));
    }catch(e){
        eh.handle(e, 'INCREASE-BUDGET');
    }
}