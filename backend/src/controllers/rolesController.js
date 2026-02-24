import * as rolesService from '../services/rolesService.js';

export async function listRoles(req, res, next) {
  try {
    const roles = await rolesService.listRoles();
    res.json(roles);
  } catch (err) {
    next(err);
  }
}

export async function getRole(req, res, next) {
  try {
    const role = await rolesService.getRoleById(req.params.id);
    res.json(role);
  } catch (err) {
    next(err);
  }
}

export async function createRole(req, res, next) {
  try {
    const role = await rolesService.createRole(req.body);
    res.status(201).json(role);
  } catch (err) {
    next(err);
  }
}

export async function updateRole(req, res, next) {
  try {
    const role = await rolesService.updateRole(req.params.id, req.body);
    res.json(role);
  } catch (err) {
    next(err);
  }
}

export async function deleteRole(req, res, next) {
  try {
    await rolesService.deleteRole(req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
