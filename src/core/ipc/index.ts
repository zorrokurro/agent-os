/**
 * Core IPC Module
 *
 * Public API for the IPC layer.
 * Import everything from here, not from individual files.
 *
 * @example
 * import { IPCClient, ElectronTransport, MockTransport } from '@/core/ipc'
 */

export { IPCClient, type IPCInvokeOptions, type IPCStreamOptions, type IPCStreamHandle } from './IPCClient'
export { IPC_CHANNELS, IPC_EVENTS, type IPCChannel, type IPCEvent } from './channels'
export type {
  IPCContract,
  IPCEventContract,
  IPCRequest,
  IPCResponse,
  IPCEventData,
  IPCChannelKey,
  IPCEventChannelKey,
} from './contracts'
export type { IPCTransport } from './transports'
export { ElectronTransport } from './transports/ElectronTransport'
export { MockTransport } from './transports/MockTransport'
