import { NS } from "@ns";

export async function main(ns: NS): Promise<void> {
  const depth = 15;

  // seed server list
  const serverList = [];
  serverList.push(["home"]);
  serverList.push(ns.scan("home"));

  // iteratively list more deeply connected servers
  for (let i = 1; i < depth; i++) {
    const startList = serverList[i];
    const connectedList = [] as string[];

    // for each name at this level add the connected servers to the next level
    for (const name of startList) {
      const scanList = ns.scan(name);
      // verify servers and add
      for (const scannedName of scanList) {
        // dont add previously included servers
        if (
          scannedName == "home" ||
          connectedList.includes(scannedName) ||
          serverList[i - 1].includes(scannedName)
        ) {
          continue;
        }
        connectedList.push(scannedName);
      }
    }

    ns.print(connectedList);
    serverList.push(connectedList);
  }

  // flatten server list into normal array
  const flattened = serverList.join();
  ns.print(JSON.stringify(flattened));

  // output server list to file
  ns.print(serverList);
  await ns.write("/data/server-list.txt", JSON.stringify(serverList), "w");
  await ns.write("/data/flattened-list.txt", JSON.stringify(flattened), "w");
}
