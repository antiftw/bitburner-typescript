
import { ExceptionHandler } from "service/diagnostics/ExceptionHandler";
import { ISimpleJSONReturn } from "/types";
/**
 * Handles file manipulation
 */
export class FileManager {
    ns: NS;
    verbose: number;
    context: string;
    eh: ExceptionHandler;
    constructor(ns: NS, verbose = 0) {
        this.ns = ns;
        this.verbose = verbose;
        this.context = 'FILE'
        this.eh = new ExceptionHandler(ns, this.context);
    }
    async write(file: string, data: string, mode?: "w" | "a" ): Promise<void>{

        try{
            await this.ns.write(file, data, mode);
        }catch(e){
           this.eh.handle(e, 'WRITE')
        }
    }
    read(file: string) : string {
        if (!this.fileExists(file)) {
            return '{}'
        }
        try {
            return this.ns.read(file);
        } catch (e)
         {
            return this.eh.handle(e, 'READ').message;
        }
    }
    serialize(obj: Record<string, unknown>) : string {
        try{
            return JSON.stringify(obj);
        }catch(e){
            return this.eh.handle(e, 'SERIALIZE').message;
        }
    }
    unserialize(str: string) : any {
        try{
            return JSON.parse(str);
        }catch(e){
            this.eh.handle(e, 'UNSERIALIZE')
        }
    }
    readJson(file: string): string | any{
        try{
            return this.unserialize(this.read(file));
        }catch(e){
            return this.eh.handle(e, 'READ-JSON')
        }
    }

    async writeJson(file: string, data: any, mode?: "w" | "a") : Promise<void>{
        try{
            mode = typeof mode === 'undefined' ? 'w' : mode;
            const str = this.serialize(data);
            await this.write(file, str, mode);
        }catch(e){
            this.eh.handle(e, 'WRITE-JSON')
        }
    }
    fileExists(fileName: string, server?: string) : boolean {
        if(server === null) {
            return this.ns.fileExists(fileName);
        }
        return this.ns.fileExists(fileName, server);
    }
}
