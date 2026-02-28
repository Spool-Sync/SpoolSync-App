import * as printerService from '../services/printerService.js';

export async function create(req, res, next) {
  try {
    const printer = await printerService.create(req.body);
    res.status(201).json(printer);
  } catch (err) {
    next(err);
  }
}

export async function list(req, res, next) {
  try {
    const printers = await printerService.list(req.query);
    res.json(printers);
  } catch (err) {
    next(err);
  }
}

export async function getOne(req, res, next) {
  try {
    const printer = await printerService.getById(req.params.printerId);
    res.json(printer);
  } catch (err) {
    next(err);
  }
}

export async function update(req, res, next) {
  try {
    const printer = await printerService.update(req.params.printerId, req.body);
    res.json(printer);
  } catch (err) {
    next(err);
  }
}

export async function remove(req, res, next) {
  try {
    await printerService.remove(req.params.printerId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function syncStatus(req, res, next) {
  try {
    const printer = await printerService.syncStatus(req.params.printerId);
    res.json(printer);
  } catch (err) {
    next(err);
  }
}

export async function setSpoolHolderCount(req, res, next) {
  try {
    const count = parseInt(req.body.count);
    if (isNaN(count) || count < 0) return res.status(400).json({ message: 'count must be a non-negative integer' });
    const printer = await printerService.setSpoolHolderCount(req.params.printerId, count);
    res.json(printer);
  } catch (err) {
    next(err);
  }
}

export async function configureHolder(req, res, next) {
  try {
    const holder = await printerService.configureHolder(req.params.spoolHolderId, req.body);
    res.json(holder);
  } catch (err) {
    next(err);
  }
}

export async function assignSpool(req, res, next) {
  try {
    const printer = await printerService.assignSpoolToHolder(req.params.spoolHolderId, req.body.spoolId, !!req.body.force);
    res.json(printer);
  } catch (err) {
    next(err);
  }
}

export async function removeSpool(req, res, next) {
  try {
    const printer = await printerService.removeSpoolFromHolder(req.params.spoolHolderId, !!req.query.force);
    res.json(printer);
  } catch (err) {
    next(err);
  }
}

export async function getPrintJobs(req, res, next) {
  try {
    const jobs = await printerService.getPrintJobs(req.params.printerId);
    res.json(jobs);
  } catch (err) {
    next(err);
  }
}

export async function reloadFilaments(req, res, next) {
  try {
    const { assignments } = req.body;
    if (!Array.isArray(assignments)) return res.status(400).json({ message: 'assignments must be an array' });
    const printer = await printerService.reloadFilaments(req.params.printerId, assignments);
    res.json(printer);
  } catch (err) {
    next(err);
  }
}

export async function associateSpoolHolder(req, res, next) {
  try {
    const printer = await printerService.associateSpoolHolder(req.params.printerId, req.body.spoolHolderId);
    res.json(printer);
  } catch (err) {
    next(err);
  }
}

export async function dissociateSpoolHolder(req, res, next) {
  try {
    const printer = await printerService.dissociateSpoolHolder(req.params.printerId, req.body.spoolHolderId);
    res.json(printer);
  } catch (err) {
    next(err);
  }
}
