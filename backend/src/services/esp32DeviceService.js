import { PrismaClient } from '@prisma/client';
import { getIO } from '../websocket/index.js';
import * as spoolHolderService from './spoolHolderService.js';

const prisma = new PrismaClient();

// Known I2C devices and how they expand to logical channels
const I2C_DEVICE_MAP = {
  0x48: { type: 'ADS1115', subChannels: 4, capability: 'LOAD_CELL' },
  0x49: { type: 'ADS1115', subChannels: 4, capability: 'LOAD_CELL' },
  0x4A: { type: 'ADS1115', subChannels: 4, capability: 'LOAD_CELL' },
  0x4B: { type: 'ADS1115', subChannels: 4, capability: 'LOAD_CELL' },
  0x24: { type: 'PN532',   subChannels: 1, capability: 'NFC' },
  0x29: { type: 'PN532',   subChannels: 1, capability: 'NFC' },
  0x70: { type: 'TCA9548A', subChannels: 8, capability: 'MUX' },
  0x71: { type: 'TCA9548A', subChannels: 8, capability: 'MUX' },
  0x72: { type: 'TCA9548A', subChannels: 8, capability: 'MUX' },
  0x73: { type: 'TCA9548A', subChannels: 8, capability: 'MUX' },
};

function expandHx711Channels(hx711Channels) {
  // HX711 is not I2C — channels are identified by their index only
  return hx711Channels.map((ch) => ({
    i2cAddress: null,
    deviceType: 'HX711',
    subChannel: ch,
    suggestedChannel: ch,
    capability: 'LOAD_CELL',
  }));
}

function expandMfrc522Channels(mfrc522Channels) {
  // MFRC522 is SPI — one reader per channel index
  return mfrc522Channels.map((ch) => ({
    i2cAddress: null,
    deviceType: 'MFRC522',
    subChannel: ch,
    suggestedChannel: ch,
    capability: 'NFC',
  }));
}

function expandI2cScan(i2cScan) {
  const channels = [];
  let loadCellChannel = 0;
  let nfcChannel = 0;

  for (const device of i2cScan) {
    const known = I2C_DEVICE_MAP[device.address];
    if (!known || known.capability === 'MUX') {
      channels.push({
        i2cAddress: device.address,
        deviceType: known?.type ?? 'UNKNOWN',
        subChannel: 0,
        suggestedChannel: null,
        capability: known?.capability ?? 'UNKNOWN',
      });
      continue;
    }
    for (let sub = 0; sub < known.subChannels; sub++) {
      channels.push({
        i2cAddress: device.address,
        deviceType: known.type,
        subChannel: sub,
        suggestedChannel: known.capability === 'LOAD_CELL' ? loadCellChannel++ : nfcChannel++,
        capability: known.capability,
      });
    }
  }
  return channels;
}

export async function create(data) {
  const device = await prisma.esp32Device.create({ data });
  getIO()?.emit('esp32Device:created', device);
  return device;
}

export async function list() {
  return prisma.esp32Device.findMany({
    include: { spoolHolders: { select: { spoolHolderId: true, name: true, channel: true } } },
    orderBy: { name: 'asc' },
  });
}

export async function getById(deviceId) {
  return prisma.esp32Device.findUniqueOrThrow({
    where: { deviceId },
    include: { spoolHolders: { select: { spoolHolderId: true, name: true, channel: true } } },
  });
}

export async function update(deviceId, data) {
  const device = await prisma.esp32Device.update({ where: { deviceId }, data });
  getIO()?.emit('esp32Device:updated', device);
  return device;
}

export async function remove(deviceId) {
  await prisma.esp32Device.delete({ where: { deviceId } });
  getIO()?.emit('esp32Device:deleted', { deviceId });
}

export async function report(uniqueDeviceId, { ipAddress, channels = [], nfcReadings = [], i2cScan, hx711Channels, mfrc522Channels }) {
  let detectedChannels;
  if (i2cScan !== undefined || hx711Channels !== undefined || mfrc522Channels !== undefined) {
    detectedChannels = [
      ...expandI2cScan(i2cScan ?? []),
      ...expandHx711Channels(hx711Channels ?? []),
      ...expandMfrc522Channels(mfrc522Channels ?? []),
    ];
  }

  const device = await prisma.esp32Device.upsert({
    where: { uniqueDeviceId },
    update: {
      lastSeen: new Date(),
      ...(ipAddress && { ipAddress }),
      ...(detectedChannels !== undefined && { detectedChannels }),
    },
    create: {
      uniqueDeviceId,
      name: uniqueDeviceId, // placeholder until named via UI
      lastSeen: new Date(),
      ...(ipAddress && { ipAddress }),
      ...(detectedChannels !== undefined && { detectedChannels }),
    },
  });

  for (const ch of channels) {
    // -1 is the HX711 error sentinel (unconnected channel or read failure)
    if (ch.raw_adc === -1) continue;

    const holder = await prisma.spoolHolder.findFirst({
      where: { esp32DeviceId: device.deviceId, channel: ch.channel },
      select: { spoolHolderId: true, loadCellOffset: true, loadCellScale: true },
    });
    if (!holder) continue;

    let weight_g;
    if (ch.raw_adc !== undefined) {
      // Server-side calibration: apply offset/scale stored on the holder
      const offset = holder.loadCellOffset ?? 0;
      const scale  = holder.loadCellScale  ?? 1;
      weight_g = (ch.raw_adc - offset) / scale;
    } else if (ch.weight_g !== undefined) {
      // Legacy firmware that applies calibration on-device
      weight_g = ch.weight_g;
    }

    if (weight_g !== undefined) {
      await spoolHolderService.updateSensorData(holder.spoolHolderId, {
        weight_g,
        ...(ch.raw_adc !== undefined && { raw_adc: ch.raw_adc }),
      });
    }
  }

  for (const nfc of nfcReadings) {
    const holder = await prisma.spoolHolder.findFirst({
      where: { esp32DeviceId: device.deviceId, nfcReaderChannel: nfc.channel },
    });
    if (holder) {
      // Empty string means no card present — pass null to clear the holder's tag
      await spoolHolderService.updateSensorData(holder.spoolHolderId, { nfcTagId: nfc.nfcTagId || null });
    }
  }

  return device;
}
