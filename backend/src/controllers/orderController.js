import * as orderService from '../services/orderService.js';

export async function create(req, res, next) {
  try {
    const order = await orderService.create(req.body);
    res.status(201).json(order);
  } catch (err) {
    next(err);
  }
}

export async function list(req, res, next) {
  try {
    const orders = await orderService.list(req.query);
    res.json(orders);
  } catch (err) {
    next(err);
  }
}

export async function getOne(req, res, next) {
  try {
    const order = await orderService.getById(req.params.orderId);
    res.json(order);
  } catch (err) {
    next(err);
  }
}

export async function update(req, res, next) {
  try {
    const order = await orderService.update(req.params.orderId, req.body);
    res.json(order);
  } catch (err) {
    next(err);
  }
}

export async function remove(req, res, next) {
  try {
    await orderService.remove(req.params.orderId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function triggerReorder(req, res, next) {
  try {
    const result = await orderService.triggerReorder();
    res.json(result);
  } catch (err) {
    next(err);
  }
}
