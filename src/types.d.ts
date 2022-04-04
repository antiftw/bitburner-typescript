import { Player, Server } from "@ns";

export interface Flags {
  finishedDeploy: boolean;
  purchasedServers: boolean;
  launchedUpgrades: boolean;
  upgradedServers: boolean;
  launchedCorpDaemon: boolean;
}

export interface HUDRow {
  header: string;
  fValue: string;
}

export interface Stats {
  player: Player;
  servers: Record<string, Server>;
}

export interface ScriptInfo {
  name: string;
  ram: number;
}

export interface ScriptsInfo {
  hackScript: ScriptInfo;
  growScript: ScriptInfo;
  weakenScript: ScriptInfo;
}

export interface Job {
  name: string;
  scriptName: string;
  startTime: number;
  duration: number;
  threads: number;
  target: string;
  host: string;
}

export interface Message<T> {
  hash: number;
  timeSent: number;
  source: string;
  text: string;
  data: T;
}

export interface MessageResponse<T> {
  sourceMessage: Message<T>;
  data: T;
}
