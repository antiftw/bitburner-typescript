import { NS } from "@ns";

export async function main(ns: NS): Promise<void> {
  const args = ns.flags([
    ["loop", false],
    ["id", ""],
  ]);
  do {
    await ns.share();
  } while (args["loop"]);
}
