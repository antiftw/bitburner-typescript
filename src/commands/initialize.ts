import { NS } from "@ns";
import { BudgetManager } from "service/core/BudgetManager";
import Configurator from "service/core/Configurator";
import { ExceptionHandler } from "service/diagnostics/ExceptionHandler";

/**
 * Initializes the application, generating configuration and budget files
 * Can be executed using the 'init' alias
 */
/** @param {NS} ns **/
export async function main(ns: NS): Promise<void> {
    const context = 'INIT-CMD'
    try{
        const verbose = 2;
        const cfg = new Configurator(ns);
        // Initialize the Configuration, writing the config options to a file
        cfg.readConfig('main', true);
        await cfg.writeConfig(cfg.config, 'main');
        // initialize BudgetHandler with enabled set to 'false', because we don't need the running part of the Handler here
        const budget = new BudgetManager(ns, verbose, false);
        // Pass 'true' to force initialize, resetting the budgets to zero
        await budget.init(true);
        cfg.readConfig('main', true);
        
        const path = cfg.getConfiguration('command_path', 'process');
        // Clear previous data to prevent unexpected behaviour
        ns.run(`${path}data/remove_data.js`)
        //await ns.run(`${path}nettools/scan_all.js`);
        // Wait a bit to make sure scan is complete
        await ns.asleep(2000);
        ns.run(`${path}nettools/analyze_all.js`);

    }catch(e){
        const eh = new ExceptionHandler(ns, context);
        eh.handle(e);
    }
}