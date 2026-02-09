// src/controllers/productController.ts
import { Request, Response } from 'express';
import pool from '../config/db';
import { logActivity } from '../utils/activityLog';

const getParam = (value: string | string[] | undefined): string => {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
};

const computeStatus = (totalStock: number, reorderPoint: number) => {
  if (totalStock === 0) return 'Empty';
  if (totalStock < reorderPoint) return 'Low';
  return 'In Stock';
};

const mapProductRow = (row: any) => ({
  id: row.id,
  name: row.name,
  sku: row.sku,
  category: row.category,
  brand: row.brand,
  description: row.description,
  price: parseFloat(row.price.toString()),
  costPrice: row.cost_price ? parseFloat(row.cost_price.toString()) : undefined,
  image: row.image,
  reorderPoint: parseInt(row.reorder_point.toString(), 10),
  status: row.status,
  supplierName: row.supplier_name,
  supplierPhone: row.supplier_phone,
  stock: {
    mainWarehouse: parseInt(row.stock_main_warehouse.toString(), 10),
    backRoom: parseInt(row.stock_back_room.toString(), 10),
    showRoom: parseInt(row.stock_show_room.toString(), 10)
  }
});

// System logs disabled; user-initiated logs use logActivity

const createNotification = async (
  type: string,
  title: string,
  message: string,
  severity: string,
  recipientId: string,
  relatedId?: string
) => {
  await pool.query(
    `INSERT INTO notifications (type, title, message, time, is_read, severity, recipient_id, related_id)
     VALUES ($1, $2, $3, $4, false, $5, $6, $7)`,
    [type, title, message, new Date().toISOString(), severity, recipientId, relatedId || null]
  );
};

// server/src/controllers/productController.ts
// Add this to productController.ts
export const getProductById = async (req: Request, res: Response) => {
  const id = getParam(req.params.id);
  try {
    const result = await pool.query(
      `SELECT 
        id, name, sku, category, brand, description, price,
        cost_price AS "costPrice",
        image, reorder_point AS "reorderPoint", status,
        supplier_name AS "supplierName",
        supplier_phone AS "supplierPhone",
        stock_main_warehouse AS "stock.mainWarehouse",
        stock_back_room AS "stock.backRoom",
        stock_show_room AS "stock.showRoom"
       FROM products
       WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const row = result.rows[0];
    const product = {
      id: row.id,
      name: row.name,
      sku: row.sku,
      category: row.category,
      brand: row.brand,
      description: row.description,
      price: parseFloat(row.price.toString()),
      costPrice: row.costPrice ? parseFloat(row.costPrice.toString()) : undefined,
      image: row.image,
      reorderPoint: parseInt(row.reorderPoint.toString()),
      status: row.status,
      supplierName: row.supplierName,
      supplierPhone: row.supplierPhone,
      stock: {
        mainWarehouse: parseInt(row['stock.mainWarehouse'].toString()),
        backRoom: parseInt(row['stock.backRoom'].toString()),
        showRoom: parseInt(row['stock.showRoom'].toString())
      }
    };

    res.json(product);
  } catch (err) {
    console.error('Get product error:', err);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
};
// POST /api/products
export const createProduct = async (req: Request, res: Response) => {
  const {
    name, sku, brand, category, description, price, costPrice,
    image, stock, reorderPoint, supplierName, supplierPhone
  } = req.body;

  try {
    const totalStock = (stock?.mainWarehouse || 0) + (stock?.backRoom || 0) + (stock?.showRoom || 0);
    const computedStatus = computeStatus(totalStock, reorderPoint || 0);

    const result = await pool.query(
      `INSERT INTO products (
        id, name, sku, category, brand, description, price, cost_price,
        image, reorder_point, status, supplier_name, supplier_phone,
        stock_main_warehouse, stock_back_room, stock_show_room
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *`,
      [
        `P-${Date.now().toString().slice(-6)}`,
        name, sku, category, brand, description, price, costPrice,
        image, reorderPoint, computedStatus, supplierName, supplierPhone,
        stock.mainWarehouse, stock.backRoom, stock.showRoom
      ]
    );

    res.status(201).json(mapProductRow(result.rows[0]));
    await logActivity(
      req,
      'Create Product',
      'Inventory',
      `Created product ${result.rows[0].id} (${name}).`
    );
  } catch (err) {
    console.error('Create product error:', err);
    res.status(500).json({ error: 'Failed to create product' });
  }
};
// Add this function to productController.ts
export const getAllProducts = async (req: Request, res: Response) => {
  try {
    const pageParam = parseInt(String(req.query.page || ''), 10);
    const limitParam = parseInt(String(req.query.limit || ''), 10);
    const usePagination = Number.isFinite(pageParam) && Number.isFinite(limitParam) && pageParam > 0 && limitParam > 0;
    const offset = usePagination ? (pageParam - 1) * limitParam : 0;

    const result = await pool.query(
      `
      SELECT 
        id, name, sku, category, brand, description, price,
        cost_price AS "costPrice",
        image, reorder_point AS "reorderPoint", status,
        supplier_name AS "supplierName",
        supplier_phone AS "supplierPhone",
        stock_main_warehouse AS "stock.mainWarehouse",
        stock_back_room AS "stock.backRoom", 
        stock_show_room AS "stock.showRoom"
      FROM products
      ORDER BY name
      ${usePagination ? 'LIMIT $1 OFFSET $2' : ''}
      `,
      usePagination ? [limitParam, offset] : []
    );

    const products = result.rows.map(row => ({
      id: row.id,
      name: row.name,
      sku: row.sku,
      category: row.category,
      brand: row.brand,
      description: row.description,
      price: parseFloat(row.price.toString()),
      costPrice: row.costPrice ? parseFloat(row.costPrice.toString()) : undefined,
      image: row.image,
      reorderPoint: parseInt(row.reorderPoint.toString()),
      status: row.status,
      supplierName: row.supplierName,
      supplierPhone: row.supplierPhone,
      stock: {
        mainWarehouse: parseInt(row['stock.mainWarehouse'].toString()),
        backRoom: parseInt(row['stock.backRoom'].toString()),
        showRoom: parseInt(row['stock.showRoom'].toString())
      }
    }));

    if (usePagination) {
      const countResult = await pool.query('SELECT COUNT(*)::int AS count FROM products');
      const total = countResult.rows[0]?.count || 0;
      res.json({ data: products, page: pageParam, limit: limitParam, total });
    } else {
      res.json(products);
    }
  } catch (err) {
    console.error('Get products error:', err);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
};
// PUT /api/products/:id
export const updateProduct = async (req: Request, res: Response) => {
  const id = getParam(req.params.id);
  const {
    name, sku, brand, category, description, price, costPrice,
    image, stock, reorderPoint, supplierName, supplierPhone
  } = req.body;

  try {
    const totalStock = (stock?.mainWarehouse || 0) + (stock?.backRoom || 0) + (stock?.showRoom || 0);
    const computedStatus = computeStatus(totalStock, reorderPoint || 0);

    const result = await pool.query(
      `UPDATE products SET
        name = $1, sku = $2, category = $3, brand = $4, description = $5,
        price = $6, cost_price = $7, image = $8, reorder_point = $9,
        status = $10, supplier_name = $11, supplier_phone = $12,
        stock_main_warehouse = $13, stock_back_room = $14, stock_show_room = $15,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $16
       RETURNING *`,
      [
        name, sku, category, brand, description, price, costPrice,
        image, reorderPoint, computedStatus, supplierName, supplierPhone,
        stock.mainWarehouse, stock.backRoom, stock.showRoom,
        id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json(mapProductRow(result.rows[0]));
    await logActivity(
      req,
      'Update Product',
      'Inventory',
      `Updated product ${id} (${name}).`
    );
  } catch (err) {
    console.error('Update product error:', err);
    res.status(500).json({ error: 'Failed to update product' });
  }
};

// DELETE /api/products/:id
export const deleteProduct = async (req: Request, res: Response) => {
  const id = getParam(req.params.id);

  try {
    // Check if product exists
    const checkResult = await pool.query(
      'SELECT id FROM products WHERE id = $1',
      [id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Delete the product
    const result = await pool.query(
      'DELETE FROM products WHERE id = $1',
      [id]
    );

    res.json({ message: 'Product deleted successfully' });
    await logActivity(
      req,
      'Delete Product',
      'Inventory',
      `Deleted product ${id}.`
    );
  } catch (err) {
    console.error('Delete product error:', err);
    res.status(500).json({ error: 'Failed to delete product' });
  }
};

// POST /api/products/:id/adjust-stock
export const adjustProductStock = async (req: Request, res: Response) => {
  const id = getParam(req.params.id);
  const { location, quantity, reason } = req.body;

  if (!['mainWarehouse', 'backRoom', 'showRoom'].includes(location)) {
    return res.status(400).json({ error: 'Invalid location' });
  }
  if (!Number.isFinite(quantity) || quantity === 0) {
    return res.status(400).json({ error: 'Quantity must be non-zero' });
  }

  try {
    const productResult = await pool.query(
      `SELECT stock_main_warehouse, stock_back_room, stock_show_room, reorder_point, status
       FROM products WHERE id = $1`,
      [id]
    );

    if (productResult.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const current = productResult.rows[0];
    const main = parseInt(current.stock_main_warehouse.toString(), 10);
    const back = parseInt(current.stock_back_room.toString(), 10);
    const show = parseInt(current.stock_show_room.toString(), 10);

    const newMain = location === 'mainWarehouse' ? main + quantity : main;
    const newBack = location === 'backRoom' ? back + quantity : back;
    const newShow = location === 'showRoom' ? show + quantity : show;

    const totalStock = newMain + newBack + newShow;
    const oldStatus = current.status;
    const newStatus = computeStatus(totalStock, parseInt(current.reorder_point.toString(), 10));

    const updateResult = await pool.query(
      `UPDATE products SET
        stock_main_warehouse = $1, stock_back_room = $2, stock_show_room = $3,
        status = $4, updated_at = CURRENT_TIMESTAMP
       WHERE id = $5
       RETURNING *`,
      [newMain, newBack, newShow, newStatus, id]
    );

    if (newStatus !== oldStatus && (newStatus === 'Low' || newStatus === 'Empty')) {
      await createNotification(
        'Stock',
        'Inventory Alert',
        `${newStatus} stock warning for product ${id}.`,
        'high',
        'seller',
        id
      );
      // System logs disabled; only user-initiated logs are recorded
    } else {
      // System logs disabled; only user-initiated logs are recorded
    }

    res.json(mapProductRow(updateResult.rows[0]));
    await logActivity(
      req,
      'Adjust Stock',
      'Inventory',
      `Adjusted stock for product ${id} at ${location} by ${quantity}. Reason: ${reason || 'N/A'}.`
    );
  } catch (err) {
    console.error('Adjust stock error:', err);
    res.status(500).json({ error: 'Failed to adjust stock' });
  }
};
