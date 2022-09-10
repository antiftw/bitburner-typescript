import Configurator from "/service/core/Configurator";
import { ExceptionHandler } from "/service/diagnostics/ExceptionHandler";
import HacknetScanner from "/service/network-tool/HacknetScanner";

/** @param {NS} ns **/
export async function main(ns: NS): Promise<void> {
    // This step scans the Gacknet network to identify all Hacknet servers
    const context = 'LOOP_6';
    try{
        const cfg = new Configurator(ns);
        const verbose = cfg.determineVerbosity(cfg.getConfiguration('steps.scanHacknet.verbosity', 'main').getNumberValue());
        const scanner = new HacknetScanner(ns, verbose);
        await scanner.execute();
    }catch(e){
        const eh = new ExceptionHandler(ns, context);
        eh.handle(e, 'SCAN-HACK');
    }
}