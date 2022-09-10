import Configurator from "/service/core/Configurator";
import { ExceptionHandler } from "/service/diagnostics/ExceptionHandler";
import { PublicManager } from "/service/network-tool/manager/PublicManager";

/** @param {NS} ns **/
export async function main(ns: NS): Promise<void> {
    // This step checks if there are new servers that can be rooted and are not rooted yet, and if so, tries to root them
    const context = 'LOOP11';
    try{
        const cfg = new Configurator(ns);
        const verbose = cfg.determineVerbosity(cfg.getConfiguration('steps.runPublic.verbosity', 'main').getNumberValue());
        const publicManager = new PublicManager(ns, verbose);
        await publicManager.run();
    }catch(e){
        const eh = new ExceptionHandler(ns, context);
        eh.handle(e, 'PUB-MANAGER');
    }
}