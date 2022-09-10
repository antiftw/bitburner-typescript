import Configuration from "object/Configuration";
import { ExceptionHandler } from "service/diagnostics/ExceptionHandler";
import { FileManager } from "service/core/FileManager";
import { ISimpleJSONReturn } from "types";
import Logger from "service/diagnostics/Logger";
import TypeHelper from "/toolbox/TypeHelper";

export default class Configurator{
    ns: NS;
    verbose: number;
    config: Array<Configuration>;
    context: string;
    eh: ExceptionHandler;
    file: FileManager;
    logger: Logger;
    type: TypeHelper;
    constructor(ns: NS, verbose = 0) {
        this.ns = ns;
        this.verbose = verbose;
        this.config = [];
        this.context = 'CONFIGURATOR';
        this.eh = new ExceptionHandler(ns, this.context);
        this.file = new FileManager(ns, verbose);
        this.logger = new Logger(ns, verbose, this.context);
        this.type = new TypeHelper();
        this.readConfig('main');
    }

    async initialize(configuration = 'main') : Promise<ISimpleJSONReturn>{
        try{
            this.readConfig(configuration, true);
            await this.writeConfig(this.config, configuration);
            return {
                success: true,
                message: `Successfully initialized the '${configuration}' configuration`
            };
        }catch(e) {
            return {
                success: false,
                message: `Error initializing the '${configuration}' configuration`
            }
        }
    }

    setConfig(name: string, value: number|string|number[]|string[], category: string)  : ISimpleJSONReturn{
        const configuration = new Configuration(name, value, category);
        let message;
        let indexToReplace = -1;
        for(let index = 0; index < this.config.length; index++) {
            const config = this.config[index];
            if(config.name === name && config.category === category) {
                indexToReplace = index;
                break;
            }
        }
        if(indexToReplace > -1) {
            // we already have this config, update it
            this.config[indexToReplace] = configuration;
            message = `Configuration ${name} replaced`;
        }else {
            // new config, add it
            this.config.push(configuration);
            message = `Configuration ${name} inserted`;
        }
        return {
            success: true,
            message: message
        };
    }
    getConfiguration(name: string, category: string) : Configuration {
        const config = this.config.find(config => config.name === name && config.category === category);
        if(typeof config === 'undefined' || typeof config.value === 'undefined') {
            return new Configuration('', `The combination of this name  (${name}) + category (${category}) was not found.`, '')
        }
        return config;
    }
    
    async writeConfig(configuration: Configuration[], name: string): Promise<void | ISimpleJSONReturn> {
        try {
            await this.file.writeJson(`/config/dist/${name}.txt`, configuration, 'w')
        }catch(e) {
            return this.eh.handle(e, 'WRITE-CONFIG');
        }
    }
    getConfigurationCategory(category: string): Array<Configuration> {
        const config = this.config.filter(config => config.category = category);
        if(typeof config === 'undefined' ){
            const config =  new Configuration(category, `The category ${category} does not exist.`, category);
            return [config];
        }
        return config;
    }
    /**
     * Reads the config from file into local variable and returns it
     * @param name name of the configuration
     * @returns
     */
    readConfig(name: string, source = false): ISimpleJSONReturn {
        this.config = [];
        this.logger.log(`test`)
        if(source) {
            try{
                const ls = this.ns.ls('home', `/config/src/${name}/`);
                this.ns.tprint(`test: ${ls}`)
                let category = '';
                for (const entry of ls) {
                    this.ns.tprint(entry)
                    if(typeof entry !== 'undefined'){
                        const parts = entry.split('/');
                        const file = parts[parts.length - 1];
                        category = file.split('.')[0];
                    }
                    // source files are a bit of a hack, since the bitburner VSCode extension wont push .txt files
                    // bc of this, we save it as valid typescript so it compiles to js (which get pushed by the extension), 
                    // so we are going to have to manually parse it
                    // The reason I chose this path is that I hate manually initializing all config values programmatically
                    // i.e. using new Configuration('name', 'category', 'value'); 
                    // first trim the whitespace that might be there, since that would interfere.
                    const configData = this.file.read(entry).trim();
                    const lines = configData.split('\n');
                    let jsonString = '';
                    for(let index = 0; index < lines.length; index++){
                        const line = lines[index];
                        
                        if(index === 0) {
                            // this line can be ignored since it is: 'export const data = {'
                            continue;
                        }
                       
                        // everything in between is the data we want
                        jsonString += line;


                        if(index === lines.length - 3) {
                            // this is the last line we should consider, since we need to remove '};' and a 'sourceMappingUrl' line added by tsc
                            break;
                        }
                    }
                    // After adding the '{}' we should have a valid json object in string form, so we can get the actual object:
                    this.logger.log(`{${jsonString}}`)
                    const config = JSON.parse(`{ ${jsonString} }`);

                    // And iterate it to create our local structure
                    Object.entries(config).map(([key, value]) => {
                        if(Array.isArray(value) || typeof value === 'string' || typeof value === 'number') {
                            const configuration = new Configuration(key, value, category);
                            this.config.push(configuration);
                        }
                    })
                    
                }
                
                return {
                    success: true,
                    message: `Successfully read configuration [ ${name} ] from source files.`,
                    value: this.config
                }
            }catch(e) {
                return this.eh.handle(e, 'READ-CONFIG-SOURCE')    
            }  
        }else {
            
            try{
                const configDatas = this.file.readJson('/config/dist/' + name + '.txt');
                for(const cfg of configDatas) {
                    const configuration = new Configuration(cfg.name, cfg.value, cfg.category);
                    this.config.push(configuration);
                }
                return {
                    success: true, 
                    message: `Successfully fetched configuration from disk`,
                    value: this.config
                } 
            }catch(e) {
                return this.eh.handle(e, 'READ-CONFIG-DIST');
            }
        }
    }
    
    determineVerbosity(override: number): number {
        // load config into local datastructure
        this.readConfig('main');
        //this.ns.tprint(`override: ${JSON.stringify(this.config)}`)
        
        let verbosity;
        if(this.config === [] || this.getConfiguration('verbosity', 'main').name === '') {
            // default to full output, since something is clearly wrong
            verbosity = 2;
        }

        if(typeof override !== 'undefined' && override !== 0 && override !== null) {
            // if we have an override
            verbosity =  override;
        }else {
            // use the general setting
            verbosity = this.getConfiguration('verbosity', 'main').getNumberValue();
        }
        this.verbose = verbosity;
        return verbosity;
    }
}