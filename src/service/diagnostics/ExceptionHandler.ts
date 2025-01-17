import Logger from 'service/diagnostics/Logger'
import { IException, IPort, ISimpleJSONReturn } from '/types';
export class ExceptionHandler{
    ns: NS
    context: string;
    verbose: number;
    logger: Logger;
    constructor(ns: NS, context = 'CONTEXT') {
        this.ns = ns;
        this.context = context;
        this.verbose = 0;
        this.logger = new Logger(ns, this.verbose, this.context);
    }

    instanceOfException(object: any): object is IException {
        return 'message' in object;
    }

    /**
     * Handles the different kinds of exceptions that occur in the application
     * @param exception The exception to handle
     * @param  localContext context from where the exception originated
     * @returns human readable output
     */
    handle(exception: unknown, localContext = ''): ISimpleJSONReturn{
        let output = '';
        if(this.instanceOfException(exception)) {
            output = exception.message
     
        }else if (typeof exception === 'string'){
            
            if(exception.includes('|')) {
                exception.replace('DELIMITER', ', ')
                const parts = exception.split('|');
                output = parts.join(' ');
                
            }else{
                output = exception;
            }
        }
        this.ns.tprintf(`ERROR [EXCEPT] [${this.context}${localContext !== '' ? ':' + localContext : ''}] - ${output}`)
        return {
            success: false,
            message: output
        };
    }
    /**
     * Listen for a KillSignal (generated by the 'kill-all' alias)
     * @param port port on which to listen for the killSignal
     * @returns whether we received a killSignal
     */
    checkKillSignal(port: IPort): boolean {
        const killSignal = this.ns.readPort(port.id);
        if(killSignal !== 'NULL PORT DATA') {
            this.logger.notify(`Kill signal received: terminating...`)
            return true;
        }
        return false;
    }
}