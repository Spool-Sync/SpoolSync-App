import * as filamentTypeService from "../services/filamentTypeService.js";

// List unique brands (manufacturers)
export async function listBrands(req, res, next) {
  try {
    const brands = await filamentTypeService.listBrands();
    res.json(brands);
  } catch (err) {
    next(err);
  }
}

// List unique material types for a brand
export async function listMaterialTypes(req, res, next) {
  try {
    const { brand } = req.query;
    if (!brand) return res.status(400).json({ error: "brand required" });
    const materials = await filamentTypeService.listMaterialTypes(brand);
    res.json(materials);
  } catch (err) {
    next(err);
  }
}

// List unique material names for a brand and material type
export async function listMaterials(req, res, next) {
  try {
    const { brand, materialType } = req.query;
    if (!brand || !materialType)
      return res.status(400).json({ error: "brand and materialType required" });
    const names = await filamentTypeService.listMaterials(brand, materialType);
    res.json(names);
  } catch (err) {
    next(err);
  }
}

export async function create(req, res, next) {
  try {
    const filamentType = await filamentTypeService.create(req.body);
    res.status(201).json(filamentType);
  } catch (err) {
    next(err);
  }
}

export async function list(req, res, next) {
  try {
    const filamentTypes = await filamentTypeService.list(req.query);
    res.json(filamentTypes);
  } catch (err) {
    next(err);
  }
}

export async function getOne(req, res, next) {
  try {
    const filamentType = await filamentTypeService.getById(req.params.id);
    res.json(filamentType);
  } catch (err) {
    next(err);
  }
}

export async function update(req, res, next) {
  try {
    const filamentType = await filamentTypeService.update(
      req.params.id,
      req.body,
    );
    res.json(filamentType);
  } catch (err) {
    next(err);
  }
}

export async function remove(req, res, next) {
  try {
    await filamentTypeService.remove(req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function search(req, res, next) {
  try {
    const results = await filamentTypeService.search(req.query.q);
    res.json(results);
  } catch (err) {
    next(err);
  }
}

export async function syncExternal(req, res, next) {
  try {
    const result = await filamentTypeService.syncExternal();
    res.json(result);
  } catch (err) {
    next(err);
  }
}
