import Configurator from "/service/core/Configurator";
import { ExceptionHandler } from "/service/diagnostics/ExceptionHandler";
import PublicScanner from "/service/network-tool/PublicScanner";

/** @param {NS} ns **/
export async function main(ns: NS): Promise<void> {
    // This step scans the public network to identify all public servers
    const context = 'LOOP_5';
    try{
        const cfg = new Configurator(ns);
        const verbose = cfg.determineVerbosity(cfg.getConfiguration('steps.scanPublic.verbosity', 'main').getNumberValue());
        const scanner = new PublicScanner(ns, verbose);
        await scanner.execute();
    }catch(e){
        const eh = new ExceptionHandler(ns, context);
        eh.handle(e, 'SCAN-PUB');
    }
}