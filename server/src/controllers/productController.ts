// src/controllers/productController.ts
import { Request, Response } from 'express';
import pool from '../config/db';

// server/src/controllers/productController.ts
// Add this to productController.ts
export const getProductById = async (req: Request, res: Response) => {
  const { id } = req.params;
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
    image, stock, reorderPoint, status, supplierName, supplierPhone
  } = req.body;

  try {
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
        image, reorderPoint, status, supplierName, supplierPhone,
        stock.mainWarehouse, stock.backRoom, stock.showRoom
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create product error:', err);
    res.status(500).json({ error: 'Failed to create product' });
  }
};
// Add this function to productController.ts
export const getAllProducts = async (req: Request, res: Response) => {
  try {
    const result = await pool.query(`
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
    `);

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

    res.json(products);
  } catch (err) {
    console.error('Get products error:', err);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
};
// PUT /api/products/:id
export const updateProduct = async (req: Request, res: Response) => {
  const { id } = req.params;
  const {
    name, sku, brand, category, description, price, costPrice,
    image, stock, reorderPoint, status, supplierName, supplierPhone
  } = req.body;

  try {
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
        image, reorderPoint, status, supplierName, supplierPhone,
        stock.mainWarehouse, stock.backRoom, stock.showRoom,
        id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update product error:', err);
    res.status(500).json({ error: 'Failed to update product' });
  }
};

// DELETE /api/products/:id
export const deleteProduct = async (req: Request, res: Response) => {
  const { id } = req.params;

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
  } catch (err) {
    console.error('Delete product error:', err);
    res.status(500).json({ error: 'Failed to delete product' });
  }
};