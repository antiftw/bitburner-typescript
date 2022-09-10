import Configurator from "/service/core/Configurator";
import { ExceptionHandler } from "/service/diagnostics/ExceptionHandler";
import BotnetScanner from "/service/network-tool/BotnetScanner";

/** @param {NS} ns **/
export async function main(ns: NS): Promise<void> {
    // This step scans the botnet network to identify all botnet (read: "purchased") servers
    const context = 'LOOP_4';
    try{
        const cfg = new Configurator(ns);
        const verbose = cfg.determineVerbosity(cfg.getConfiguration('steps.scanBotnet.verbosity', 'main').getNumberValue());
        const scanner = new BotnetScanner(ns, verbose);
        await scanner.execute();
    }catch(e){
        const eh = new ExceptionHandler(ns, context);
        eh.handle(e, 'SCAN-BOT');
    }
}