import * as storageZoneService from '../services/storageZoneService.js';

export async function list(req, res, next) {
  try {
    const zones = await storageZoneService.list(req.params.locationId);
    res.json(zones);
  } catch (err) { next(err); }
}

export async function create(req, res, next) {
  try {
    const zone = await storageZoneService.create(req.params.locationId, req.body);
    res.status(201).json(zone);
  } catch (err) { next(err); }
}

export async function update(req, res, next) {
  try {
    const zone = await storageZoneService.update(req.params.zoneId, req.body);
    res.json(zone);
  } catch (err) { next(err); }
}

export async function remove(req, res, next) {
  try {
    await storageZoneService.remove(req.params.zoneId);
    res.status(204).send();
  } catch (err) { next(err); }
}

export async function assignSpool(req, res, next) {
  try {
    await storageZoneService.assignSpoolToZone(req.params.zoneId, req.body.spoolId);
    res.status(204).send();
  } catch (err) { next(err); }
}

export async function removeSpool(req, res, next) {
  try {
    await storageZoneService.removeSpoolFromZone(req.params.zoneId, req.body.spoolId);
    res.status(204).send();
  } catch (err) { next(err); }
}
