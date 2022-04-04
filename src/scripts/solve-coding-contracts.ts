import { CodingAttemptOptions, NS } from "@ns";

export async function main(ns: NS): Promise<void> {
  ns.disableLog("ALL");
  ns.print("----------Starting solve-coding-contracts----------");

  const fContents = ns.read("/data/flattened-list.txt");
  const serverList = JSON.parse(fContents).split(",") as string[];
  ns.print(`Checking for CCTs...`);

  for (const server of serverList) {
    if (!ns.serverExists(server)) continue;

    const files = ns.ls(server, ".cct");

    if (files.length > 0) {
      for (const f of files) {
        await handleContract(ns, f, server);
      }
    }
  }
}

async function handleContract(
  ns: NS,
  filename: string,
  host: string
): Promise<void> {
  const contractType = ns.codingcontract.getContractType(filename, host);

  let solution = [] as string[];
  const data = ns.codingcontract.getData(filename, host);
  const verbose = false;
  switch (contractType) {
    case "Merge Overlapping Intervals":
      solution = [JSON.stringify(merge(ns, data as number[][], verbose))];
      break;
    case "Total Ways to Sum":
      break;
    default:
      solution = [];
      break;
  }

  if (solution && solution.length > 0) {
    // submit attempt
    const opts = { returnReward: true } as CodingAttemptOptions;
    const result = ns.codingcontract.attempt(
      solution,
      filename,
      host,
      opts
    ) as string;

    // print output
    const solved = result !== "";
    const out = `${contractType} - ${solved}: ${JSON.stringify(
      data
    )} -> ${JSON.stringify(solution)}`;
    ns.print(out);
    ns.print(`${host} - ${filename} attempted. Rewards: ${result}`);

    // write to file
    await ns.write("/data/coding-contract-attempts.txt", out, "a");
  } else {
    ns.print(
      `No solver for ${contractType}, not attempting ${host} ${filename}`
    );
  }
}

function merge(ns: NS, data: number[][], verbose = false): number[][] {
  const clonedData = _.cloneDeep(data).sort((a, b) => a[0] - b[0]);
  if (verbose) ns.print(clonedData);

  let didCombine = false;
  let input = _.cloneDeep(data).sort((a, b) => a[0] - b[0]);
  let output = _.cloneDeep(data).sort((a, b) => a[0] - b[0]);
  do {
    didCombine = false;
    input = _.cloneDeep(output);
    output = [];
    for (let i = 0; i < input.length - 1; i++) {
      const current = input[i];
      const next = input[i + 1];
      if (current[1] >= next[0]) {
        output.push([current[0], next[1]]);
        didCombine = true;
        i++;
      } else {
        output.push(current);
        if (i === input.length - 2) output.push(input[i + 1]);
      }
    }

    if (verbose)
      ns.print(
        `Input: ${JSON.stringify(input)}, Output: ${JSON.stringify(
          output
        )}, didCombine: ${didCombine}`
      );
  } while (didCombine && output.length > 1);

  return output;
}
