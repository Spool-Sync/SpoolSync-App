import * as userService from '../services/userService.js';

export async function register(req, res, next) {
  try {
    const user = await userService.register(req.body);
    res.status(201).json(user);
  } catch (err) {
    next(err);
  }
}

export async function login(req, res, next) {
  try {
    const result = await userService.login(req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function logout(req, res) {
  // JWT is stateless; client discards the token
  res.json({ message: 'Logged out' });
}

export async function getMe(req, res) {
  // eslint-disable-next-line no-unused-vars
  const { passwordHash, ...user } = req.user;
  res.json(user);
}

export async function updateMe(req, res, next) {
  try {
    const user = await userService.updateUser(req.user.userId, req.body);
    res.json(user);
  } catch (err) {
    next(err);
  }
}

export async function getPermissions(req, res) {
  const { isSuperAdmin, customRoles = [] } = req.user;
  const permissions = [...new Set(customRoles.flatMap((r) => r.permissions))];
  res.json({
    isSuperAdmin,
    roles: customRoles.map((r) => ({ id: r.id, name: r.name, permissions: r.permissions })),
    permissions,
  });
}

export async function createUser(req, res, next) {
  try {
    const user = await userService.createUser(req.body);
    res.status(201).json(user);
  } catch (err) {
    next(err);
  }
}

export async function listUsers(req, res, next) {
  try {
    const users = await userService.listUsers();
    res.json(users);
  } catch (err) {
    next(err);
  }
}

export async function getUser(req, res, next) {
  try {
    const user = await userService.getUserById(req.params.userId);
    res.json(user);
  } catch (err) {
    next(err);
  }
}

export async function updateUser(req, res, next) {
  try {
    const user = await userService.updateUser(req.params.userId, req.body);
    res.json(user);
  } catch (err) {
    next(err);
  }
}

export async function deleteUser(req, res, next) {
  try {
    await userService.deleteUser(req.params.userId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
