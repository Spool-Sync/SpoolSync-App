import * as storageLocationService from '../services/storageLocationService.js';

export async function create(req, res, next) {
  try {
    const location = await storageLocationService.create(req.body);
    res.status(201).json(location);
  } catch (err) {
    next(err);
  }
}

export async function list(req, res, next) {
  try {
    const locations = await storageLocationService.list(req.query);
    res.json(locations);
  } catch (err) {
    next(err);
  }
}

export async function getOne(req, res, next) {
  try {
    const location = await storageLocationService.getById(req.params.locationId);
    res.json(location);
  } catch (err) {
    next(err);
  }
}

export async function update(req, res, next) {
  try {
    const location = await storageLocationService.update(req.params.locationId, req.body);
    res.json(location);
  } catch (err) {
    next(err);
  }
}

export async function remove(req, res, next) {
  try {
    await storageLocationService.remove(req.params.locationId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function linkSpool(req, res, next) {
  try {
    const result = await storageLocationService.linkSpool(req.params.locationId, req.body.spoolId);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function unlinkSpool(req, res, next) {
  try {
    await storageLocationService.unlinkSpool(req.params.locationId, req.body.spoolId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
