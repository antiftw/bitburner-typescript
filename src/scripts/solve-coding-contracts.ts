import { NS } from "@ns";

function handleContract(ns: NS, filename: string, host: string): void {
  const contractType = ns.codingcontract.getContractType(filename, host);
  switch (contractType) {
    case "Total Ways to Sum":
      ns.print(ns.codingcontract.getData(filename, host));
      ns.print(ns.codingcontract.getDescription(filename, host));
      break;
    default:
      ns.print(`Unknown contract type '${contractType}'`);
      break;
  }
}

export async function main(ns: NS): Promise<void> {
  const fContents = ns.read("/data/flattened-list.txt");
  const serverList = JSON.parse(fContents).split(",") as string[];
  ns.print(`Checking for CCTs on: ${serverList}`);

  for (const server of serverList) {
    if (!ns.serverExists(server)) continue;

    const files = ns.ls(server, ".cct");

    if (files.length > 0) {
      ns.print(`${server}: ${files}`);

      for (const f of files) {
        handleContract(ns, f, server);
      }
    }
  }
}
