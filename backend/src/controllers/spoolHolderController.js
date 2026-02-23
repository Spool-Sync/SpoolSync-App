import * as spoolHolderService from '../services/spoolHolderService.js';

export async function create(req, res, next) {
  try {
    const holder = await spoolHolderService.create(req.body);
    res.status(201).json(holder);
  } catch (err) {
    next(err);
  }
}

export async function list(req, res, next) {
  try {
    const holders = await spoolHolderService.list(req.query);
    res.json(holders);
  } catch (err) {
    next(err);
  }
}

export async function getOne(req, res, next) {
  try {
    const holder = await spoolHolderService.getById(req.params.spoolHolderId);
    res.json(holder);
  } catch (err) {
    next(err);
  }
}

export async function update(req, res, next) {
  try {
    const holder = await spoolHolderService.update(req.params.spoolHolderId, req.body);
    res.json(holder);
  } catch (err) {
    next(err);
  }
}

export async function remove(req, res, next) {
  try {
    await spoolHolderService.remove(req.params.spoolHolderId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function calibrate(req, res, next) {
  try {
    const holder = await spoolHolderService.calibrate(req.params.spoolHolderId, req.body);
    res.json(holder);
  } catch (err) {
    next(err);
  }
}

export async function updateSensorData(req, res, next) {
  try {
    const holder = await spoolHolderService.updateSensorData(req.params.spoolHolderId, req.body);
    res.json(holder);
  } catch (err) {
    next(err);
  }
}

