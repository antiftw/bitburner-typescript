import { NS } from "@ns";

export async function main(ns: NS): Promise<void> {
  const args = ns.flags([
    ["target", "n00dles"],
    ["loop", false],
    ["id", ""],
  ]);
  do {
    await ns.weaken(args["target"]);
  } while (args["loop"]);
}
