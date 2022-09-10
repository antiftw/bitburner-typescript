import Configurator from "/service/core/Configurator";
import { ExceptionHandler } from "/service/diagnostics/ExceptionHandler";
import { HacknetManager } from "/service/network-tool/manager/HacknetManager";

/** @param {NS} ns **/
export async function main(ns: NS): Promise<void> {
    // This step uses the allocated budget to expand/upgrade the Hacknet network
    const context = 'LOOP12';
    try{
        const cfg = new Configurator(ns);
        const verbose = cfg.determineVerbosity(cfg.getConfiguration('steps.runHacknet.verbosity', 'main').getNumberValue());
        const hacknet = new HacknetManager(ns, verbose);
        await hacknet.run();
    }catch(e){
        const eh = new ExceptionHandler(ns, context);
        eh.handle(e, 'HCK-MANAGER');
    }
}