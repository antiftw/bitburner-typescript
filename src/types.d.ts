import { Player, Server } from "@ns";

export interface Stats {
  player: Player;
  servers: {
    [key: string]: Server;
  };
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
