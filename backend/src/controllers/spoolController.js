import * as spoolService from '../services/spoolService.js';

export async function create(req, res, next) {
  try {
    const spool = await spoolService.create(req.body);
    res.status(201).json(spool);
  } catch (err) {
    next(err);
  }
}

export async function list(req, res, next) {
  try {
    const result = await spoolService.list(req.query);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getUsageTrend(req, res, next) {
  try {
    const days = parseInt(req.query.days) || 30;
    const trend = await spoolService.getUsageTrend(days);
    res.json(trend);
  } catch (err) {
    next(err);
  }
}

export async function getUsageTrendByType(req, res, next) {
  try {
    const days = parseInt(req.query.days) || 30;
    const trend = await spoolService.getUsageTrendByType(days);
    res.json(trend);
  } catch (err) {
    next(err);
  }
}

export async function listFilters(req, res, next) {
  try {
    const filters = await spoolService.listFilters();
    res.json(filters);
  } catch (err) {
    next(err);
  }
}

export async function getOne(req, res, next) {
  try {
    const spool = await spoolService.getById(req.params.spoolId);
    res.json(spool);
  } catch (err) {
    next(err);
  }
}

export async function update(req, res, next) {
  try {
    const spool = await spoolService.update(req.params.spoolId, req.body);
    res.json(spool);
  } catch (err) {
    next(err);
  }
}

export async function remove(req, res, next) {
  try {
    await spoolService.remove(req.params.spoolId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function associateLocation(req, res, next) {
  try {
    const spool = await spoolService.associateLocation(req.params.spoolId, req.body);
    res.json(spool);
  } catch (err) {
    next(err);
  }
}

export async function updateWeight(req, res, next) {
  try {
    const spool = await spoolService.updateWeight(req.params.spoolId, req.body.weight_g);
    res.json(spool);
  } catch (err) {
    next(err);
  }
}

export async function updateStatus(req, res, next) {
  try {
    const spool = await spoolService.updateStatus(req.params.spoolId, req.body.orderStatus);
    res.json(spool);
  } catch (err) {
    next(err);
  }
}

export async function markSpent(req, res, next) {
  try {
    const spent = req.body.spent !== false; // default true
    const spool = await spoolService.markSpent(req.params.spoolId, spent);
    res.json(spool);
  } catch (err) { next(err); }
}

export async function refill(req, res, next) {
  try {
    const spool = await spoolService.refill(req.params.spoolId, req.body);
    res.json(spool);
  } catch (err) { next(err); }
}

export async function getHistory(req, res, next) {
  try {
    const days = parseInt(req.query.days) || 90;
    const history = await spoolService.getHistory(req.params.spoolId, days);
    res.json(history);
  } catch (err) {
    next(err);
  }
}

export async function findByNfcTag(req, res, next) {
  try {
    const spool = await spoolService.findByNfcTag(req.params.nfcTagId);
    if (!spool) return res.status(404).json({ message: 'No spool with that NFC tag' });
    res.json(spool);
  } catch (err) {
    next(err);
  }
}

export async function linkNfcTag(req, res, next) {
  try {
    const spool = await spoolService.linkNfcTag(req.params.spoolId, req.body.nfcTagId);
    res.json(spool);
  } catch (err) {
    next(err);
  }
}
