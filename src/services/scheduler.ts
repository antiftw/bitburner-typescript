import { NS } from "@ns";
import { getStats } from "/modules/helper";
import { packMessage, unpackMessage } from "/modules/messaging";
import {
  MessageResponse,
  SchedulerRequest,
  SchedulerResponse,
  Stats,
} from "/types";

const timeToExpiration = 250;

export async function main(ns: NS): Promise<void> {
  const args = ns.flags([
    ["port", 2],
    [
      "ramPool",
      [
        "n00dles",
        "foodnstuff",
        "sigma-cosmetics",
        "joesguns",
        "nectar-net",
        "hong-fang-tea",
        "harakiri-sushi",
      ],
    ],
  ]);

  // we do our own logging
  ns.disableLog("ALL");
  ns.print("----------Starting scheduler----------");

  // for each server in the ram pool, kill all scripts
  let stats = getStats(ns, args["ramPool"]);
  for (const server of args["ramPool"]) {
    if (ns.serverExists(server)) {
      ns.killall(server);
      ns.print(`Killed all scripts on ${server}`);
    }
  }

  // start up the port and clear it
  const pHandle = ns.getPortHandle(args["port"]);
  pHandle.clear();
  ns.print(`Port ${args["port"]} opened and cleared`);

  // handle incoming service requests
  const scheduledJobs = {} as Record<string, SchedulerRequest[]>;
  (args["ramPool"] as string[]).forEach((s) => (scheduledJobs[s] = []));
  ns.print("Ready for service requests!");
  while (true) {
    // update stats
    stats = getStats(ns, args["ramPool"]);
    const largestRamChunk = (args["ramPool"] as string[])
      .map((s) => stats.servers[s].maxRam)
      .reduce((a, b) => (a > b ? a : b));

    // remove old jobs to free up memory
    for (const server of args["ramPool"]) {
      _.remove(scheduledJobs[server], (job) => Date.now() > job.endTime);
    }

    // check for port data, discarding bad data and old messages
    const parsed = unpackMessage<number | SchedulerRequest>(ns, pHandle.peek());
    if (
      (!pHandle.empty() && parsed === undefined) || // message we are unable to parse
      (parsed && Date.now() - parsed.timeSent > timeToExpiration) // old message, not handled
    ) {
      pHandle.read();
      continue;
    }

    // if it's not from us, it's for us
    if (parsed && parsed.source !== ns.getScriptName()) {
      pHandle.read(); // consume message

      if (typeof parsed.data === "number") {
        // handle max ram request
        ns.print(`Received max ram request from ${parsed.source}`);
        const response = packMessage(
          ns,
          `Response to ram request from ${parsed.source}`,
          {
            sourceMessage: parsed,
            data: largestRamChunk,
          } as MessageResponse<number>
        );
        pHandle.write(response);
        ns.print(`Responded with max ram = ${largestRamChunk}`);
      } else {
        // handle scheduling request
        ns.print(`Received scheduling request from: ${parsed.source}`);

        const scheduled = scheduleRequest(
          ns,
          stats,
          args["ramPool"],
          scheduledJobs,
          parsed.data
        );

        const response = packMessage(
          ns,
          `Response to scheduler request from ${parsed.source}`,
          {
            sourceMessage: parsed,
            data: scheduled,
          } as MessageResponse<SchedulerResponse>
        );
        pHandle.write(response);
        ns.print(
          `Responded with success='${scheduled.success}' host='${scheduled.host}'`
        );
      }
    }

    await ns.sleep(1);
  }
}

function scheduleRequest(
  ns: NS,
  stats: Stats,
  ramPool: string[],
  jobs: Record<string, SchedulerRequest[]>,
  request: SchedulerRequest
): SchedulerResponse {
  // select server with min available ram for duration of job
  let minRam = Infinity;
  let bestHost = "";
  for (const server of ramPool) {
    let ramAvail = stats.servers[server].maxRam;
    for (const job of jobs[server]) {
      // if jobs would overlap, we subtract the job's ram from available ram
      if (request.startTime < job.endTime || request.endTime > job.startTime) {
        ramAvail -= request.ram;
      }
    }
    // ns.print(`${server} has ${ramAvail} during requested time`);
    if (ramAvail >= request.ram && ramAvail < minRam) {
      minRam = ramAvail;
      bestHost = server;
    }
  }

  if (bestHost !== "") {
    jobs[bestHost].push(request);
    ns.print(
      `${bestHost} selected for ${request.ram}GB [${request.startTime}->${request.endTime}]`
    );
  } else {
    ns.print(
      `No host available for ${request.ram}GB [${request.startTime}->${request.endTime}]`
    );
  }
  // ns.print(`Jobs: ${JSON.stringify(jobs)}`);

  return {
    ram: request.ram,
    startTime: request.startTime,
    endTime: request.endTime,
    success: bestHost !== "",
    host: bestHost,
  };
}
