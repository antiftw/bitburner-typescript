import { NS } from "@ns";
import { ExceptionHandler } from "service/diagnostics/ExceptionHandler";
import Logger from "/service/diagnostics/Logger";
import HacknetScanner from "/service/network-tool/HacknetScanner";
export async function main(ns: NS): Promise<void> {
    const context = 'HCK-SCAN';
    try {
        const verbose = 2;
        const scanner = new HacknetScanner(ns, verbose);
        const logger = new Logger(ns, verbose, context)
        const result = await scanner.execute();
        logger.handleResult(result);
    }catch(e) {
        const eh = new ExceptionHandler(ns, context);
        eh.handle(e);
    }
    
}