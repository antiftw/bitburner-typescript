import Configurator from "/service/core/Configurator";
import { ExceptionHandler } from "/service/diagnostics/ExceptionHandler";
import { HackingHandler } from "/service/network-tool/hacking/HackingHandler";

/** @param {NS} ns **/
export async function main(ns: NS): Promise<void> {
    // This step loops through all our servers, and sees if they need to be enslaved
    // (read: wgh files copied + instructed to attack a target)
    // @deprecated
    const context = 'LOOP13';
    try{
        let force = ns.args[0];
        if(typeof force === 'undefined') {
            force = false;
        }
        const cfg = new Configurator(ns);
        const verbose = cfg.determineVerbosity(cfg.getConfiguration('steps.runHacker.verbosity', 'main').getNumberValue());
        const hacker = new HackingHandler(ns, verbose);
        await hacker.execute(Boolean(force));

    }catch(e){
        const eh = new ExceptionHandler(ns, context);
        eh.handle(e, 'HACKER');
    }
}