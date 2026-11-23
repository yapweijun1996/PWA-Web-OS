export type WorkerRequest =
  | { type: 'inspect' }
  | { type: 'activate'; buildId: string; readyClients: string[] };

export interface WorkerInspection {
  type: 'inspection';
  buildId: string;
  ready: boolean;
  clientId: string;
  peers: string[];
}

export interface ActivationReply {
  type: 'activation';
  result: 'accepted' | 'other_client' | 'failed';
}

export type PeerMessage =
  | { type: 'prepare'; attempt: string; buildId: string; clients: string[] }
  | { type: 'vote'; attempt: string; clientId: string; ready: boolean }
  | { type: 'commit' | 'abort'; attempt: string };
