import { Request, Response } from 'express';
import pool from '../config/db';
import { logActivity } from '../utils/activityLog';
import { createNotificationRecord } from '../services/notificationService';
import { emitInventoryChanged } from '../services/realtime';
import {
  addQuantityToLocation,
  BatchInput,
  computeStatus,
  createProductBatches,
  deleteProductBatch,
  deductQuantityFromLocation,
  getProductBatches,
  parseInteger,
  updateProductBatch,
} from '../services/inventoryBatches';
import { syncProductAcrossDatabases } from '../services/dbSync';

const getParam = (value: string | string[] | undefined): string => {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
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
    showRoom: parseInt(row.stock_show_room.toString(), 10),
  },
  nextExpiryDate: row.next_expiry_date || null,
});

type ProductRecord = ReturnType<typeof mapProductRow>;

type RecommendationContext = {
  buyerProductUnits: Map<string, number>;
  buyerProductLastOrdered: Map<string, string>;
  buyerCategoryUnits: Map<string, number>;
  buyerCategoryLastOrdered: Map<string, string>;
  globalProductUnits: Map<string, number>;
};

const ACTIVE_RECOMMENDATION_ORDER_STATUSES = ['Pending', 'Processing', 'Shipped', 'Delivered'];

const getDaysSince = (value?: string | null) => {
  if (!value) return Number.POSITIVE_INFINITY;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return Number.POSITIVE_INFINITY;
  return (Date.now() - parsed.getTime()) / (1000 * 60 * 60 * 24);
};

const getBuyerRecommendationContext = async (buyerId: string): Promise<RecommendationContext> => {
  const buyerProductUnits = new Map<string, number>();
  const buyerProductLastOrdered = new Map<string, string>();
  const buyerCategoryUnits = new Map<string, number>();
  const buyerCategoryLastOrdered = new Map<string, string>();
  const globalProductUnits = new Map<string, number>();

  const [buyerHistoryResult, globalPopularityResult] = await Promise.all([
    pool.query(
      `
      SELECT
        oi.product_id,
        p.category,
        SUM(oi.quantity)::int AS units,
        MAX(o.date)::text AS last_ordered
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      JOIN products p ON p.id = oi.product_id
      WHERE o.buyer_id = $1
        AND o.status = ANY($2::varchar[])
      GROUP BY oi.product_id, p.category
      `,
      [buyerId, ACTIVE_RECOMMENDATION_ORDER_STATUSES]
    ),
    pool.query(
      `
      SELECT
        oi.product_id,
        SUM(oi.quantity)::int AS units
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE o.status = ANY($1::varchar[])
      GROUP BY oi.product_id
      `,
      [ACTIVE_RECOMMENDATION_ORDER_STATUSES]
    ),
  ]);

  buyerHistoryResult.rows.forEach((row: any) => {
    const productId = String(row.product_id);
    const category = String(row.category || '');
    const units = Number(row.units || 0);
    const lastOrdered = String(row.last_ordered || '');

    buyerProductUnits.set(productId, units);
    if (lastOrdered) buyerProductLastOrdered.set(productId, lastOrdered);

    buyerCategoryUnits.set(category, (buyerCategoryUnits.get(category) || 0) + units);
    const previousCategoryDate = buyerCategoryLastOrdered.get(category);
    if (!previousCategoryDate || new Date(lastOrdered) > new Date(previousCategoryDate)) {
      buyerCategoryLastOrdered.set(category, lastOrdered);
    }
  });

  globalPopularityResult.rows.forEach((row: any) => {
    globalProductUnits.set(String(row.product_id), Number(row.units || 0));
  });

  return {
    buyerProductUnits,
    buyerProductLastOrdered,
    buyerCategoryUnits,
    buyerCategoryLastOrdered,
    globalProductUnits,
  };
};

const rankProductsForBuyer = (products: ProductRecord[], context: RecommendationContext) => {
  const scored = products.map((product) => {
    const totalStock = product.stock.mainWarehouse + product.stock.backRoom + product.stock.showRoom;
    const priorUnits = context.buyerProductUnits.get(product.id) || 0;
    const categoryUnits = context.buyerCategoryUnits.get(product.category) || 0;
    const globalUnits = context.globalProductUnits.get(product.id) || 0;
    const priorDays = getDaysSince(context.buyerProductLastOrdered.get(product.id));
    const categoryDays = getDaysSince(context.buyerCategoryLastOrdered.get(product.category));

    let score = 0;
    const reasons: string[] = [];

    if (priorUnits > 0) {
      score += 70 + Math.min(priorUnits * 4, 40);
      reasons.push('Previously ordered by this buyer');
      if (priorDays <= 45) {
        score += 25;
        reasons.push('Recently reordered');
      } else if (priorDays <= 120) {
        score += 12;
      }
    }

    if (categoryUnits > 0) {
      score += 30 + Math.min(categoryUnits * 2, 24);
      reasons.push('Matches a category this buyer purchases often');
      if (categoryDays <= 60) score += 10;
    }

    if (globalUnits > 0) {
      score += Math.min(globalUnits, 20);
      reasons.push('Popular with buyers overall');
    }

    if (product.status === 'In Stock') score += 15;
    else if (product.status === 'Low') score += 6;
    else if (product.status === 'Empty') score -= 60;
    else if (product.status === 'Discontinued') score -= 100;

    if (totalStock <= 0) score -= 40;

    return {
      ...product,
      recommendationScore: score,
      recommendationReasons: Array.from(new Set(reasons)).slice(0, 3),
    };
  });

  const sorted = scored.sort((a, b) => {
    if ((b.recommendationScore || 0) !== (a.recommendationScore || 0)) {
      return (b.recommendationScore || 0) - (a.recommendationScore || 0);
    }
    return a.name.localeCompare(b.name);
  });

  const recommendedIds = new Set(
    sorted
      .filter((product) => (product.recommendationScore || 0) > 0)
      .slice(0, 3)
      .map((product) => product.id)
  );

  return sorted.map((product) => ({
    ...product,
    recommended: recommendedIds.has(product.id),
  }));
};

const emitProductInventory = (product: ProductRecord) => {
  emitInventoryChanged({
    productId: product.id,
    status: product.status,
    stock: {
      ...product.stock,
      total: product.stock.mainWarehouse + product.stock.backRoom + product.stock.showRoom,
    },
  });
};

const fetchFullProduct = async (id: string) => {
  const result = await pool.query(
    `SELECT
       p.*,
       (
         SELECT MIN(pb.expiry_date)
         FROM product_batches pb
         WHERE pb.product_id = p.id
           AND pb.quantity_available > 0
           AND pb.expiry_date IS NOT NULL
       ) AS next_expiry_date
     FROM products p
     WHERE p.id = $1`,
    [id]
  );

  if (result.rows.length === 0) return null;

  const product = mapProductRow(result.rows[0]);
  const batches = await getProductBatches(pool, id);
  return {
    ...product,
    batches,
  };
};

const getProductListQuery = `
  SELECT
    p.*,
    (
      SELECT MIN(pb.expiry_date)
      FROM product_batches pb
      WHERE pb.product_id = p.id
        AND pb.quantity_available > 0
        AND pb.expiry_date IS NOT NULL
    ) AS next_expiry_date
  FROM products p
`;

export const getProductById = async (req: Request, res: Response) => {
  const id = getParam(req.params.id);
  try {
    const product = await fetchFullProduct(id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json(product);
  } catch (err) {
    console.error('Get product error:', err);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
};

export const createProduct = async (req: Request, res: Response) => {
  const {
    name,
    sku,
    brand,
    category,
    description,
    price,
    costPrice,
    image,
    stock,
    reorderPoint,
    supplierName,
    supplierPhone,
    initialBatch,
  } = req.body;

  try {
    const totalStock = (stock?.mainWarehouse || 0) + (stock?.backRoom || 0) + (stock?.showRoom || 0);
    if (totalStock > 0 && !initialBatch?.batchNumber) {
      return res.status(400).json({ error: 'Batch number is required when adding initial stock' });
    }

    const productId = `P-${Date.now().toString().slice(-6)}`;
    const computedStatus = computeStatus(totalStock, reorderPoint || 0);

    await pool.query('BEGIN');
    const result = await pool.query(
      `INSERT INTO products (
        id, name, sku, category, brand, description, price, cost_price,
        image, reorder_point, status, supplier_name, supplier_phone,
        stock_main_warehouse, stock_back_room, stock_show_room
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 0, 0, 0)
      RETURNING *`,
      [
        productId,
        name,
        sku,
        category,
        brand,
        description,
        price,
        costPrice,
        image,
        reorderPoint,
        computedStatus,
        supplierName,
        supplierPhone,
      ]
    );

    if (totalStock > 0) {
      await createProductBatches(pool, productId, {
        batchNumber: String(initialBatch.batchNumber),
        manufacturingDate: initialBatch.manufacturingDate || null,
        expiryDate: initialBatch.expiryDate || null,
        quantities: {
          mainWarehouse: parseInteger(stock?.mainWarehouse),
          backRoom: parseInteger(stock?.backRoom),
          showRoom: parseInteger(stock?.showRoom),
        },
      });
    }

    await pool.query('COMMIT');
    await syncProductAcrossDatabases(productId);

    const product = await fetchFullProduct(productId);
    if (product) emitProductInventory(product);
    res.status(201).json(product || mapProductRow(result.rows[0]));
    await logActivity(req, 'Create Product', 'Inventory', `Created product ${productId} (${name}).`);
  } catch (err) {
    await pool.query('ROLLBACK').catch(() => {});
    console.error('Create product error:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to create product' });
  }
};

export const getAllProducts = async (req: Request, res: Response) => {
  try {
    const currentUser = (req as any).user;
    const pageParam = parseInt(String(req.query.page || ''), 10);
    const limitParam = parseInt(String(req.query.limit || ''), 10);
    const usePagination = Number.isFinite(pageParam) && Number.isFinite(limitParam) && pageParam > 0 && limitParam > 0;
    const offset = usePagination ? (pageParam - 1) * limitParam : 0;
    const shouldRankForBuyer = currentUser?.role === 'R-BUYER' && currentUser?.userId;
    const shouldPaginateInMemory = shouldRankForBuyer && usePagination;

    const result = await pool.query(
      `${getProductListQuery}
       ORDER BY p.name
       ${usePagination && !shouldPaginateInMemory ? 'LIMIT $1 OFFSET $2' : ''}`,
      usePagination && !shouldPaginateInMemory ? [limitParam, offset] : []
    );

    const products = result.rows.map(mapProductRow);
    const rankedProducts = shouldRankForBuyer
      ? rankProductsForBuyer(products, await getBuyerRecommendationContext(String(currentUser.userId)))
      : products;

    if (usePagination) {
      const countResult = await pool.query('SELECT COUNT(*)::int AS count FROM products');
      const total = countResult.rows[0]?.count || 0;
      const paginatedProducts = shouldPaginateInMemory ? rankedProducts.slice(offset, offset + limitParam) : rankedProducts;
      res.json({ data: paginatedProducts, page: pageParam, limit: limitParam, total });
    } else {
      res.json(rankedProducts);
    }
  } catch (err) {
    console.error('Get products error:', err);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
};

export const updateProduct = async (req: Request, res: Response) => {
  const id = getParam(req.params.id);
  const {
    name,
    sku,
    brand,
    category,
    description,
    price,
    costPrice,
    image,
    reorderPoint,
    supplierName,
    supplierPhone,
    status,
  } = req.body;

  try {
    const currentProductResult = await pool.query(
      'SELECT stock_main_warehouse, stock_back_room, stock_show_room FROM products WHERE id = $1',
      [id]
    );
    if (currentProductResult.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const current = currentProductResult.rows[0];
    const totalStock =
      parseInteger(current.stock_main_warehouse) +
      parseInteger(current.stock_back_room) +
      parseInteger(current.stock_show_room);
    const computedStatus =
      status === 'Discontinued' ? 'Discontinued' : computeStatus(totalStock, parseInteger(reorderPoint));

    const result = await pool.query(
      `UPDATE products SET
         name = $1, sku = $2, category = $3, brand = $4, description = $5,
         price = $6, cost_price = $7, image = $8, reorder_point = $9,
         status = $10, supplier_name = $11, supplier_phone = $12,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $13
       RETURNING *`,
      [name, sku, category, brand, description, price, costPrice, image, reorderPoint, computedStatus, supplierName, supplierPhone, id]
    );

    await syncProductAcrossDatabases(id);

    const product = await fetchFullProduct(id);
    if (product) emitProductInventory(product);
    res.json(product || mapProductRow(result.rows[0]));
    await logActivity(req, 'Update Product', 'Inventory', `Updated product ${id} (${name}).`);
  } catch (err) {
    console.error('Update product error:', err);
    res.status(500).json({ error: 'Failed to update product' });
  }
};

export const deleteProduct = async (req: Request, res: Response) => {
  const id = getParam(req.params.id);

  try {
    const checkResult = await pool.query('SELECT id FROM products WHERE id = $1', [id]);
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    await pool.query('DELETE FROM products WHERE id = $1', [id]);
    await syncProductAcrossDatabases(id);

    res.json({ message: 'Product deleted successfully' });
    await logActivity(req, 'Delete Product', 'Inventory', `Deleted product ${id}.`);
  } catch (err) {
    console.error('Delete product error:', err);
    res.status(500).json({ error: 'Failed to delete product' });
  }
};

export const addProductBatch = async (req: Request, res: Response) => {
  const id = getParam(req.params.id);
  const { batchNumber, manufacturingDate, expiryDate, quantities } = req.body || {};

  try {
    const existing = await pool.query('SELECT id FROM products WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    await pool.query('BEGIN');
    await createProductBatches(pool, id, {
      batchNumber,
      manufacturingDate,
      expiryDate,
      quantities: quantities || {},
    } as BatchInput);
    await pool.query('COMMIT');

    await syncProductAcrossDatabases(id);

    const product = await fetchFullProduct(id);
    if (product) emitProductInventory(product);
    res.status(201).json(product);
    await logActivity(req, 'Add Product Batch', 'Inventory', `Added batch ${batchNumber} to product ${id}.`);
  } catch (err) {
    await pool.query('ROLLBACK').catch(() => {});
    console.error('Add product batch error:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to add product batch' });
  }
};

export const editProductBatch = async (req: Request, res: Response) => {
  const id = getParam(req.params.id);
  const batchId = parseInteger(req.params.batchId);
  const { batchNumber, manufacturingDate, expiryDate, location, quantity } = req.body || {};

  if (!['mainWarehouse', 'backRoom', 'showRoom'].includes(location)) {
    return res.status(400).json({ error: 'Invalid location' });
  }

  try {
    await pool.query('BEGIN');
    await updateProductBatch(pool, id, batchId, {
      batchNumber,
      manufacturingDate,
      expiryDate,
      location,
      quantity,
    });
    await pool.query('COMMIT');

    await syncProductAcrossDatabases(id);
    const product = await fetchFullProduct(id);
    if (product) emitProductInventory(product);
    res.json(product);
    await logActivity(req, 'Edit Product Batch', 'Inventory', `Updated batch ${batchId} for product ${id}.`);
  } catch (err) {
    await pool.query('ROLLBACK').catch(() => {});
    console.error('Edit product batch error:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to update product batch' });
  }
};

export const removeProductBatch = async (req: Request, res: Response) => {
  const id = getParam(req.params.id);
  const batchId = parseInteger(req.params.batchId);

  try {
    await pool.query('BEGIN');
    await deleteProductBatch(pool, id, batchId);
    await pool.query('COMMIT');

    await syncProductAcrossDatabases(id);
    const product = await fetchFullProduct(id);
    if (product) emitProductInventory(product);
    res.json(product);
    await logActivity(req, 'Delete Product Batch', 'Inventory', `Deleted batch ${batchId} from product ${id}.`);
  } catch (err) {
    await pool.query('ROLLBACK').catch(() => {});
    console.error('Delete product batch error:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to delete product batch' });
  }
};

export const adjustProductStock = async (req: Request, res: Response) => {
  const id = getParam(req.params.id);
  const { location, quantity, reason, batchNumber, manufacturingDate, expiryDate } = req.body;

  if (!['mainWarehouse', 'backRoom', 'showRoom'].includes(location)) {
    return res.status(400).json({ error: 'Invalid location' });
  }
  if (!Number.isFinite(quantity) || quantity === 0) {
    return res.status(400).json({ error: 'Quantity must be non-zero' });
  }

  try {
    const productResult = await pool.query(
      `SELECT reorder_point, status
       FROM products WHERE id = $1`,
      [id]
    );

    if (productResult.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    let updatedRow: any;
    await pool.query('BEGIN');
    if (quantity > 0) {
      updatedRow = await addQuantityToLocation(pool, id, location, quantity, {
        batchNumber,
        manufacturingDate,
        expiryDate,
      });
    } else {
      updatedRow = await deductQuantityFromLocation(pool, id, location, Math.abs(quantity));
    }
    await pool.query('COMMIT');

    const newStatus = updatedRow.status;
    const oldStatus = productResult.rows[0].status;
    if (newStatus !== oldStatus && (newStatus === 'Low' || newStatus === 'Empty')) {
      await createNotificationRecord(
        'Stock',
        'Inventory Alert',
        `${newStatus} stock warning for product ${id}.`,
        'high',
        'seller',
        id
      );
    }

    await syncProductAcrossDatabases(id);

    const fullProduct = await fetchFullProduct(id);
    if (fullProduct) emitProductInventory(fullProduct);
    res.json(fullProduct || { ...mapProductRow(updatedRow), batches: [] });
    await logActivity(
      req,
      'Adjust Stock',
      'Inventory',
      `Adjusted stock for product ${id} at ${location} by ${quantity}. Reason: ${reason || 'N/A'}.`
    );
  } catch (err) {
    await pool.query('ROLLBACK').catch(() => {});
    console.error('Adjust stock error:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to adjust stock' });
  }
};
