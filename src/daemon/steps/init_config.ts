import Configurator from "/service/core/Configurator";
import { ExceptionHandler } from "/service/diagnostics/ExceptionHandler";

/** @param {NS} ns **/
export async function main(ns: NS): Promise<void> {
    // This step writes the configuration file
    const context = 'LOOP_1';
    try{
        const cfg = new Configurator(ns);
        await cfg.initialize();
    }catch(e){
        const eh = new ExceptionHandler(ns, context);
        eh.handle(e, 'INIT-CONFIG');
    }
}