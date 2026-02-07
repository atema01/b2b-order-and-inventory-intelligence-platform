// server/src/controllers/categoryController.ts
import { Request, Response } from 'express';
import pool from '../config/db';

export const getAllCategories = async (req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT id, name FROM categories ORDER BY name
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Get categories error:', err);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
};
// server/src/controllers/categoryController.ts
export const createCategory = async (req: Request, res: Response) => {
  const { name } = req.body;
  
  if (!name?.trim()) {
    return res.status(400).json({ error: 'Category name is required' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO categories (id, name) VALUES ($1, $2) RETURNING *',
      [`CAT-${Date.now()}`, name.trim()]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create category error:', err);
    res.status(500).json({ error: 'Failed to create category' });
  }
};
//update categories
// server/src/controllers/categoryController.ts
export const updateCategory = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name: newName } = req.body;

  if (!newName?.trim()) {
    return res.status(400).json({ error: 'Category name is required' });
  }

  try {
    // Get the old category name first
    const oldCategoryResult = await pool.query(
      'SELECT name FROM categories WHERE id = $1',
      [id]
    );

    if (oldCategoryResult.rows.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }

    const oldName = oldCategoryResult.rows[0].name;

    // Start transaction
    await pool.query('BEGIN');

    try {
      // Update the category name
      await pool.query(
        'UPDATE categories SET name = $1 WHERE id = $2',
        [newName.trim(), id]
      );

      // Update all products that use the old category name
      await pool.query(
        'UPDATE products SET category = $1 WHERE category = $2',
        [newName.trim(), oldName]
      );

      await pool.query('COMMIT');

      // Return updated category
      const updatedResult = await pool.query(
        'SELECT * FROM categories WHERE id = $1',
        [id]
      );

      res.json(updatedResult.rows[0]);
    } catch (err) {
      await pool.query('ROLLBACK');
      throw err;
    }
  } catch (err) {
    console.error('Update category error:', err);
    res.status(500).json({ error: 'Failed to update category' });
  }
};
//delete category 
export const deleteCategory = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    // Check if category is used by any product
    const productCheck = await pool.query(
      'SELECT 1 FROM products WHERE category = (SELECT name FROM categories WHERE id = $1)',
      [id]
    );

    if (productCheck.rows.length > 0) {
      return res.status(409).json({ error: 'Category is in use by products' });
    }

    const result = await pool.query(
      'DELETE FROM categories WHERE id = $1',
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }

    res.json({ message: 'Category deleted successfully' });
  } catch (err) {
    console.error('Delete category error:', err);
    res.status(500).json({ error: 'Failed to delete category' });
  }
};
