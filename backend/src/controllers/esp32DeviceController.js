import * as esp32DeviceService from '../services/esp32DeviceService.js';

export async function create(req, res, next) {
  try {
    const device = await esp32DeviceService.create(req.body);
    res.status(201).json(device);
  } catch (err) {
    next(err);
  }
}

export async function list(req, res, next) {
  try {
    const devices = await esp32DeviceService.list();
    res.json(devices);
  } catch (err) {
    next(err);
  }
}

export async function getOne(req, res, next) {
  try {
    const device = await esp32DeviceService.getById(req.params.deviceId);
    res.json(device);
  } catch (err) {
    next(err);
  }
}

export async function update(req, res, next) {
  try {
    const device = await esp32DeviceService.update(req.params.deviceId, req.body);
    res.json(device);
  } catch (err) {
    next(err);
  }
}

export async function remove(req, res, next) {
  try {
    await esp32DeviceService.remove(req.params.deviceId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function report(req, res, next) {
  try {
    const { uniqueDeviceId, ipAddress, channels, nfcReadings, i2cScan, hx711Channels, mfrc522Channels } = req.body;
    const device = await esp32DeviceService.report(uniqueDeviceId, { ipAddress, channels, nfcReadings, i2cScan, hx711Channels, mfrc522Channels });
    res.json(device);
  } catch (err) {
    next(err);
  }
}
