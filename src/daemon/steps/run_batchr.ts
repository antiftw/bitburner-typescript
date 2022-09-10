
import Configurator from "/service/core/Configurator";
import { ExceptionHandler } from "/service/diagnostics/ExceptionHandler";
import { BatchHandler } from "/service/network-tool/hacking/BatchHandler";
/**
 * Execute the BatchHandler, which handles the copying and executing of the WGH Batches
 * @param {*} ns
 */


/** @param {NS} ns **/
export async function main(ns: NS): Promise<void> {
    const context = 'LOOP15';
    try{
        const cfg = new Configurator(ns);
        const verbose = cfg.determineVerbosity(cfg.getConfiguration('steps.runBatcher.verbosity', 'main').getNumberValue());
        const batcher = new BatchHandler(ns, verbose);
        await batcher.execute();
    }catch(e){
        const eh = new ExceptionHandler(ns, context);
        eh.handle(e, 'BATCHER');
    }
}