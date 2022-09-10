import Configurator from "../core/Configurator";
import Logger from "../diagnostics/Logger";
import TypeHelper from "/toolbox/TypeHelper";
import { IPort } from "/types";

export default class PortHandler {
    ns: NS;
    verbose: number;
    context: string; 
    cfg: Configurator;
    ports: Array<IPort>
    type: TypeHelper;
    logger: Logger;
    constructor(ns: NS, verbose = 0) {
        this.ns = ns;
        this.verbose = verbose;
        this.context = 'PORTRW';
        this.cfg = new Configurator(ns, verbose)
        this.type = new TypeHelper();
        this.ports = this.initializePorts();
        this.logger = new Logger(ns, verbose, this.context)

    }

    initializePorts(): Array<IPort> {
        const portData = this.cfg.getConfigurationCategory('ports');
        this.logger.log
        let index = 0;
        const ports = [];
        for(const data of portData) {
            const purpose = data.getStringValue();
            const port = {
                id: index,
                purpose: purpose
            }
            ports.push(port);
            index++;
        }
        return ports;
    }
    write(port: number | string, data: any) {
        if(this.type.is(port, Number)) {
            this.ns.readPort(port);
        }else  if(this.type.is(port, String)) {
            const portObj = this.ports.find((prt) => {
                prt.purpose === port
            });
            
        }
    }

    read(port: number | string): any {
        if(this.type.is(port, Number)) {
            return this.ns.readPort(port);
        }else  if(this.type.is(port, String)) {
            this
        }
    }
}