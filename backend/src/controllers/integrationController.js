import * as integrationService from '../services/integrationService.js';
import path from 'path';
import fs from 'fs/promises';

export async function listTypes(req, res, next) {
  try {
    const types = await integrationService.listTypes();
    res.json(types);
  } catch (err) {
    next(err);
  }
}

export async function uploadConfig(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded.' });
    }
    const result = await integrationService.installConfig(req.file.path);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function getTypeStatus(req, res, next) {
  try {
    const status = await integrationService.getTypeStatus(req.params.typeId);
    res.json(status);
  } catch (err) {
    next(err);
  }
}
