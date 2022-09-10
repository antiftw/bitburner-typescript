import Configurator from "/service/core/Configurator";
import { ExceptionHandler } from "/service/diagnostics/ExceptionHandler";
import { BotnetManager } from "/service/network-tool/manager/BotnetManager";

/** @param {NS} ns **/
export async function main(ns: NS): Promise<void> {
    // This step uses the allocated budget to expand/upgrade the botnet network
    const context = 'LOOP10';
    try{
        const cfg = new Configurator(ns);
        const verbose = cfg.determineVerbosity(cfg.getConfiguration('steps.runBotnet.verbosity', 'main').getNumberValue());
        const botnet = new BotnetManager(ns, verbose);
        await botnet.run();
    }catch(e){
        const eh = new ExceptionHandler(ns, context);
        eh.handle(e, 'BOT-MANAGER');
    }
}