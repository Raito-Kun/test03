import { EventEmitter } from 'events';
import logger from './logger';
import redis from './redis';
import prisma from './prisma';

// modesl has no official TS types — use require
// eslint-disable-next-line @typescript-eslint/no-var-requires
const esl = require('modesl');

const CALL_TTL = 7200; // 2 hours

export interface ActiveCall {
  agentId: string;
  contactPhone: string;
  direction: string;
  state: string;
  startTime: string;
}

class EslDaemon extends EventEmitter {
  private conn: ReturnType<typeof esl.Connection> | null = null;
  private reconnectDelay = 1000;
  private destroyed = false;

  /** Load ESL config from active cluster in DB, fallback to env vars */
  private async getEslConfig(): Promise<{ host: string; port: number; password: string }> {
    try {
      const cluster = await prisma.pbxCluster.findFirst({ where: { isActive: true } });
      if (cluster) {
        logger.info('ESL config loaded from active cluster', { cluster: cluster.name, host: cluster.eslHost });
        return { host: cluster.eslHost, port: cluster.eslPort, password: cluster.eslPassword };
      }
    } catch (err) {
      logger.warn('Failed to load ESL config from DB, using env vars', { error: (err as Error).message });
    }
    return {
      host: process.env.ESL_HOST || '127.0.0.1',
      port: parseInt(process.env.ESL_PORT || '8021', 10),
      password: process.env.ESL_PASSWORD || 'ClueCon',
    };
  }

  async connect(): Promise<void> {
    if (this.destroyed) return;

    const { host, port, password } = await this.getEslConfig();

    try {
      this.conn = new esl.Connection(host, port, password, () => {
        logger.info('ESL connected to FreeSWITCH');
        this.reconnectDelay = 1000;

        this.conn.subscribe([
          'CHANNEL_CREATE',
          'CHANNEL_ANSWER',
          'CHANNEL_BRIDGE',
          'CHANNEL_HANGUP_COMPLETE',
          'CHANNEL_HOLD',
        ]);

        this.conn.on('esl::event::CHANNEL_CREATE::*', (evt: ESLEvent) => {
          this.handleChannelCreate(evt).catch((e) =>
            logger.error('ESL CHANNEL_CREATE error', { error: e.message }),
          );
        });

        this.conn.on('esl::event::CHANNEL_ANSWER::*', (evt: ESLEvent) => {
          this.handleChannelAnswer(evt).catch((e) =>
            logger.error('ESL CHANNEL_ANSWER error', { error: e.message }),
          );
        });

        this.conn.on('esl::event::CHANNEL_BRIDGE::*', (evt: ESLEvent) => {
          this.handleChannelBridge(evt).catch((e) =>
            logger.error('ESL CHANNEL_BRIDGE error', { error: e.message }),
          );
        });

        this.conn.on('esl::event::CHANNEL_HANGUP_COMPLETE::*', (evt: ESLEvent) => {
          this.handleChannelHangup(evt).catch((e) =>
            logger.error('ESL CHANNEL_HANGUP_COMPLETE error', { error: e.message }),
          );
        });

        this.conn.on('esl::event::CHANNEL_HOLD::*', (evt: ESLEvent) => {
          this.handleChannelHold(evt).catch((e) =>
            logger.error('ESL CHANNEL_HOLD error', { error: e.message }),
          );
        });
      });

      this.conn.on('error', (err: Error) => {
        logger.error('ESL connection error', { error: err.message });
        this.scheduleReconnect();
      });

      this.conn.on('esl::end', () => {
        logger.warn('ESL connection ended');
        this.scheduleReconnect();
      });
    } catch (err: unknown) {
      const e = err as Error;
      logger.error('ESL connect failed', { error: e.message });
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.destroyed) return;
    this.conn = null;
    logger.info(`ESL reconnecting in ${this.reconnectDelay}ms`);
    setTimeout(() => this.connect(), this.reconnectDelay);
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000);
  }

  private async handleChannelCreate(evt: ESLEvent): Promise<void> {
    const uuid = evt.getHeader('Unique-ID');
    const callerNum = evt.getHeader('Caller-Caller-ID-Number') || '';
    const destNum = evt.getHeader('Caller-Destination-Number') || '';
    const direction = evt.getHeader('Call-Direction') || 'outbound';

    if (!uuid) return;

    const call: ActiveCall = {
      agentId: '',
      contactPhone: direction === 'inbound' ? callerNum : destNum,
      direction,
      state: 'ringing',
      startTime: new Date().toISOString(),
    };
    await redis.set(`call:${uuid}`, JSON.stringify(call), 'EX', CALL_TTL);

    this.emit('call:ringing', { uuid, ...call });
  }

  private async handleChannelAnswer(evt: ESLEvent): Promise<void> {
    const uuid = evt.getHeader('Unique-ID');
    if (!uuid) return;

    await this.updateCallState(uuid, 'answered');
    this.emit('call:answered', { uuid });
  }

  private async handleChannelBridge(evt: ESLEvent): Promise<void> {
    const uuid = evt.getHeader('Unique-ID');
    const otherLeg = evt.getHeader('Bridge-B-Unique-ID') || '';
    if (!uuid) return;

    await this.updateCallState(uuid, 'bridged');
    this.emit('call:status_change', { uuid, state: 'bridged', otherLeg });
  }

  private async handleChannelHangup(evt: ESLEvent): Promise<void> {
    const uuid = evt.getHeader('Unique-ID');
    const cause = evt.getHeader('Hangup-Cause') || '';
    if (!uuid) return;

    await redis.del(`call:${uuid}`);
    this.emit('call:ended', { uuid, cause });
  }

  private async handleChannelHold(evt: ESLEvent): Promise<void> {
    const uuid = evt.getHeader('Unique-ID');
    if (!uuid) return;

    await this.updateCallState(uuid, 'hold');
    this.emit('call:status_change', { uuid, state: 'hold' });
  }

  private async updateCallState(uuid: string, state: string): Promise<void> {
    const raw = await redis.get(`call:${uuid}`);
    if (!raw) return;
    const call = JSON.parse(raw) as ActiveCall;
    call.state = state;
    await redis.set(`call:${uuid}`, JSON.stringify(call), 'EX', CALL_TTL);
  }

  getConnection(): ReturnType<typeof esl.Connection> | null {
    return this.conn;
  }

  destroy(): void {
    this.destroyed = true;
    this.conn?.disconnect?.();
    this.conn = null;
  }
}

interface ESLEvent {
  getHeader(name: string): string | undefined;
}

const eslDaemon = new EslDaemon();
export default eslDaemon;
