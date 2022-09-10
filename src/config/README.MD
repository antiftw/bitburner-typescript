# AntiFTW Bitburner 

## Configuration README

This file contains a description of all configuration values as declared in the config/src/main/ directory. Since the configuration is divided by category, this README will follow the same structure. Files are listed in alphabetical order.

### Contents

- botnet.ts
- budet.ts
- hacking.ts
- hacknet.ts
- main.ts
- process.ts
- public.ts 

### botnet.ts

- ***structure_file***: 
    - The file where the structure of the botnet is savved
    - default value: ```/data/botnet_structure.txt```
- ***name_template***: 
    - The (string) template used to name the so-called "purchased servers", which we refer to as "botnet servers". must contain an ```[id]``` tag where the code will insert an index .
    - default value: ```srv[id].antiftw.nl```
- ***max_ram_multiplier***: 
    - The value the maxRam amount will be multiplied with when upgrading a server. Must be >= 2 and integer
    - default value:  ```2```

### budget.ts

- ***general_file***:
    - The file where the general budget is saved
    - default value: ```/budget/general.txt```
- ***hacknet_file***:
    - The file where the hacknet budget is saved
    - default value: ```/budget/hacknet.txt```
- ***botnet_file***:
    - The file where the botnet budget is saved
    - default value: ```/budget/botnet.txt```
- ***program_file***:
    - The file where the programming budget is saved
    - default value: ```/budget/program.txt```
- ***hacknet_percentage***:
    - The percentage of the budget that will be spent on expanding the hacknet network
    - default value: ```50```
- ***botnet_percentage***:
    - The percentage of the budget that will be spent on expanding the botnet network
    - default value: ```50```
- ***program_percentage***:
    - The percentage of the budget that will be spent on programming (not used atm)
    - default value: ```0```

### hacking.ts

- ***scripts.weaken.file*** 
    - Filename of weaken script, used to execute script
    - defaullt value: ```w.js```
- ***scripts.weaken.ram*** 
    - RAM use of weaken script, used to calculate threads
    - defaullt value: ```1.75```
- ***scripts.weaken.name*** 
    - Name of weaken script, used to select script
    - defaullt value: ```weaken```
- ***scripts.grow.file*** 
    - Filename of weaken script
    - defaullt value: ```g.js```
- ***scripts.grow.ram*** 
    - RAM use of weaken script
    - defaullt value: ```1.75```
- ***scripts.grow.name*** 
    - Name of weaken script
    - defaullt value: ```grow```
- ***scripts.hack.file*** 
    - Filename of weaken script
    - defaullt value: ```h.js```
- ***scripts.hack.ram*** 
    - RAM use of weaken script
    - defaullt value: ```1.75```
- ***scripts.hack.name*** 
    - Filename of weaken script
    - defaullt value: ```hack```
- ***path*** 
    - Path where weaken/grow/hack scripts are saved
    - defaullt value: ```/scripts/wgh/```

### hacknet.ts

- ***structure_file***:
    - The file where the structure of a specific network is savved
    - default value: ```/data/hacknet_structure.txt```
- ***min_ram_amount***:
    - Minimum RAM amount that will be added when upgrading Hacknet
    - default value: ```1```
- ***min_lvl_amount***:
    - Minimum levels that will be increased when upgrading Hacknet
    - default value: ```1```
- ***min_cpu_amount***:
    - Minmum cores that will be added when upgrading Hacknet
    - default value:``` 1```

### main.ts

- ***cmdPath***
    - File path where all the steps of the main daemon are stored
    - default value: ```/daemon/main/```
- ***heartbeat***
    - Controls the Main daemon. When this is set to false, the Main daemon dies.
    - default value: ```true```
- ***enabled***
    - This controls whether actions are performed. When this is set to false, the Main daemon remains alive, but will be inactive.
    - default value: ```true```
- ***sleepDuration***
    - The amount of sleep between two iterations
    - default value: ```2000```
- ***heartbeatDuration***
    - Interval between heartbeat notifications
    - default value: ```30000``` (5 min)
- ***verbosity***
    - Controls the amount of verbosity (read: output to terminal)
    - default value: ```0```, 
    - ```0``` : no output
    - ```1``` : only notifications
    - ```2``` : full output

### process.ts

- ***commandPath***:
    - The path where all commands are stored
    - default value: ```/src/commands/```
- ***handlerPath***:
    - The path where all handler commands are stored
    - default value: ```/src/commands/handlers/```
- ***nettoolPath***:
    - The path where all nettool commands are stored
    - default value: ```/src/commands/nettools/```
- ***processPath***:
    - - The path where all process commands are stored
    - default value: ```/src/commands/process/```
- ***processFile***:
    - The path where all processes are stored (not used yet)
    - default value: ```/src/proc.txt```
- ***logDirectory***:
   - The path where all logs are stored (not used yet)
    - default value: ```/src/logs/```
- ***running***:
    - The path where all running processes are stored (not used yet)
    - default value: ```/src/running/proc.txt```
- ***sleepDuration***:
    - Sleepduration for the processhandler (not used yet)
    - default value: ```30000```

### public.ts

- ***structure_file***: 
    - The file where the structure of a specific network is savved
    - default value: ```/data/public_structure.txt```