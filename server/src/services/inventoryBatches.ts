type Queryable = {
  query: (text: string, params?: any[]) => Promise<{ rows: any[] }>;
};

export type StorageLocation = 'mainWarehouse' | 'backRoom' | 'showRoom';

export type BatchInput = {
  batchNumber: string;
  manufacturingDate?: string | null;
  expiryDate?: string | null;
  quantities: Partial<Record<StorageLocation, number>>;
};

const STORAGE_COLUMNS: Record<StorageLocation, string> = {
  mainWarehouse: 'stock_main_warehouse',
  backRoom: 'stock_back_room',
  showRoom: 'stock_show_room',
};

export const parseInteger = (value: any): number => {
  if (typeof value === 'number') return Math.floor(value);
  if (typeof value === 'string') {
    const num = parseInt(value, 10);
    return Number.isNaN(num) ? 0 : num;
  }
  return 0;
};

export const computeStatus = (totalStock: number, reorderPoint: number) => {
  if (totalStock === 0) return 'Empty';
  if (totalStock < reorderPoint) return 'Low';
  return 'In Stock';
};

export const mapBatchRow = (row: any) => ({
  id: row.id,
  batchNumber: row.batch_number,
  location: row.stock_location,
  quantity: parseInteger(row.quantity_available),
  initialQuantity: parseInteger(row.quantity_available),
  manufacturingDate: row.manufacture_date || null,
  expiryDate: row.expiry_date || null,
  createdAt: row.created_at || null,
  updatedAt: row.updated_at || null,
});

export const getProductBatches = async (db: Queryable, productId: string) => {
  const result = await db.query(
    `SELECT id, batch_number, stock_location, quantity_available, manufacture_date, expiry_date, created_at, updated_at
     FROM product_batches
     WHERE product_id = $1
     ORDER BY expiry_date ASC NULLS LAST, manufacture_date ASC NULLS LAST, created_at ASC, id ASC`,
    [productId]
  );
  return result.rows.map(mapBatchRow);
};

export const refreshProductStockTotals = async (db: Queryable, productId: string) => {
  const totalsResult = await db.query(
    `SELECT
       COALESCE(SUM(CASE WHEN stock_location = 'mainWarehouse' THEN quantity_available ELSE 0 END), 0)::int AS main,
       COALESCE(SUM(CASE WHEN stock_location = 'backRoom' THEN quantity_available ELSE 0 END), 0)::int AS back,
       COALESCE(SUM(CASE WHEN stock_location = 'showRoom' THEN quantity_available ELSE 0 END), 0)::int AS showroom
     FROM product_batches
     WHERE product_id = $1`,
    [productId]
  );

  const productResult = await db.query('SELECT reorder_point FROM products WHERE id = $1', [productId]);
  if (productResult.rows.length === 0) {
    throw new Error(`Product ${productId} not found`);
  }

  const main = parseInteger(totalsResult.rows[0]?.main);
  const back = parseInteger(totalsResult.rows[0]?.back);
  const showRoom = parseInteger(totalsResult.rows[0]?.showroom);
  const status = computeStatus(main + back + showRoom, parseInteger(productResult.rows[0].reorder_point));

  const updated = await db.query(
    `UPDATE products SET
       stock_main_warehouse = $1,
       stock_back_room = $2,
       stock_show_room = $3,
       status = $4,
       updated_at = CURRENT_TIMESTAMP
     WHERE id = $5
     RETURNING *`,
    [main, back, showRoom, status, productId]
  );

  return updated.rows[0];
};

export const createProductBatches = async (db: Queryable, productId: string, batchInput?: BatchInput | null) => {
  if (!batchInput) return;

  const batchNumber = String(batchInput.batchNumber || '').trim();
  if (!batchNumber) {
    throw new Error('Batch number is required when adding stock');
  }

  const manufacturingDate = batchInput.manufacturingDate || null;
  const expiryDate = batchInput.expiryDate || null;

  const locations = Object.keys(STORAGE_COLUMNS) as StorageLocation[];
  let hasQuantity = false;

  for (const location of locations) {
    const quantity = parseInteger(batchInput.quantities?.[location]);
    if (quantity <= 0) continue;
    hasQuantity = true;
    await db.query(
      `INSERT INTO product_batches (
         product_id, batch_number, manufacture_date, expiry_date, stock_location, quantity_available
       ) VALUES ($1, $2, $3, $4, $5, $6)`,
      [productId, batchNumber, manufacturingDate, expiryDate, location, quantity]
    );
  }

  if (!hasQuantity) {
    throw new Error('At least one stock quantity is required for a batch');
  }

  return refreshProductStockTotals(db, productId);
};

export const addQuantityToLocation = async (
  db: Queryable,
  productId: string,
  location: StorageLocation,
  quantity: number,
  metadata?: { batchNumber?: string; manufacturingDate?: string | null; expiryDate?: string | null }
) => {
  const delta = parseInteger(quantity);
  if (delta <= 0) return refreshProductStockTotals(db, productId);

  const batchNumber = String(metadata?.batchNumber || '').trim() || `ADJ-${productId}-${Date.now()}`;
  await db.query(
    `INSERT INTO product_batches (
       product_id, batch_number, manufacture_date, expiry_date, stock_location, quantity_available
     ) VALUES ($1, $2, $3, $4, $5, $6)`,
    [productId, batchNumber, metadata?.manufacturingDate || null, metadata?.expiryDate || null, location, delta]
  );
  return refreshProductStockTotals(db, productId);
};

export const updateProductBatch = async (
  db: Queryable,
  productId: string,
  batchId: number,
  updates: {
    batchNumber: string;
    manufacturingDate?: string | null;
    expiryDate?: string | null;
    location: StorageLocation;
    quantity: number;
  }
) => {
  const quantity = parseInteger(updates.quantity);
  if (quantity < 0) {
    throw new Error('Quantity cannot be negative');
  }

  const result = await db.query(
    `UPDATE product_batches
     SET batch_number = $1,
         manufacture_date = $2,
         expiry_date = $3,
         stock_location = $4,
         quantity_available = $5,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $6 AND product_id = $7
     RETURNING *`,
    [
      String(updates.batchNumber || '').trim(),
      updates.manufacturingDate || null,
      updates.expiryDate || null,
      updates.location,
      quantity,
      batchId,
      productId,
    ]
  );

  if (result.rows.length === 0) {
    throw new Error('Batch not found');
  }

  return refreshProductStockTotals(db, productId);
};

export const deleteProductBatch = async (db: Queryable, productId: string, batchId: number) => {
  const allocationResult = await db.query(
    'SELECT COUNT(*)::int AS count FROM order_batch_allocations WHERE batch_id = $1',
    [batchId]
  );
  if (parseInteger(allocationResult.rows[0]?.count) > 0) {
    throw new Error('Cannot delete a batch linked to order allocations');
  }

  const result = await db.query(
    'DELETE FROM product_batches WHERE id = $1 AND product_id = $2 RETURNING id',
    [batchId, productId]
  );
  if (result.rows.length === 0) {
    throw new Error('Batch not found');
  }

  return refreshProductStockTotals(db, productId);
};

export const deductQuantityFromLocation = async (
  db: Queryable,
  productId: string,
  location: StorageLocation,
  quantity: number
) => {
  let remaining = parseInteger(quantity);
  if (remaining <= 0) return refreshProductStockTotals(db, productId);

  const result = await db.query(
    `SELECT id, quantity_available
     FROM product_batches
     WHERE product_id = $1 AND stock_location = $2 AND quantity_available > 0
     ORDER BY expiry_date ASC NULLS LAST, manufacture_date ASC NULLS LAST, created_at ASC, id ASC`,
    [productId, location]
  );

  const available = result.rows.reduce((sum, row) => sum + parseInteger(row.quantity_available), 0);
  if (available < remaining) {
    throw new Error('Insufficient stock for adjustment');
  }

  for (const row of result.rows) {
    if (remaining <= 0) break;
    const current = parseInteger(row.quantity_available);
    const take = Math.min(current, remaining);
    await db.query(
      `UPDATE product_batches
       SET quantity_available = quantity_available - $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [take, row.id]
    );
    remaining -= take;
  }

  return refreshProductStockTotals(db, productId);
};

export const allocateProductQuantity = async (
  db: Queryable,
  orderId: string,
  productId: string,
  quantity: number
) => {
  let remaining = parseInteger(quantity);
  if (remaining <= 0) return refreshProductStockTotals(db, productId);

  const result = await db.query(
    `SELECT id, quantity_available
     FROM product_batches
     WHERE product_id = $1 AND quantity_available > 0
     ORDER BY expiry_date ASC NULLS LAST, manufacture_date ASC NULLS LAST, created_at ASC, id ASC`,
    [productId]
  );

  const available = result.rows.reduce((sum, row) => sum + parseInteger(row.quantity_available), 0);
  if (available < remaining) {
    throw new Error(`Insufficient stock for product ${productId}`);
  }

  for (const row of result.rows) {
    if (remaining <= 0) break;
    const current = parseInteger(row.quantity_available);
    const take = Math.min(current, remaining);
    await db.query(
      `UPDATE product_batches
       SET quantity_available = quantity_available - $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [take, row.id]
    );
    await db.query(
      `INSERT INTO order_batch_allocations (order_id, product_id, batch_id, quantity)
       VALUES ($1, $2, $3, $4)`,
      [orderId, productId, row.id, take]
    );
    remaining -= take;
  }

  return refreshProductStockTotals(db, productId);
};

export const restoreAllocatedProductQuantity = async (
  db: Queryable,
  orderId: string,
  productId: string,
  quantity?: number
) => {
  let remaining = quantity == null ? Number.POSITIVE_INFINITY : parseInteger(quantity);

  const allocations = await db.query(
    `SELECT id, batch_id, quantity
     FROM order_batch_allocations
     WHERE order_id = $1 AND product_id = $2
     ORDER BY id DESC`,
    [orderId, productId]
  );

  if (allocations.rows.length === 0) {
    return refreshProductStockTotals(db, productId);
  }

  for (const row of allocations.rows) {
    if (remaining <= 0) break;
    const allocated = parseInteger(row.quantity);
    const restoreQty = quantity == null ? allocated : Math.min(allocated, remaining);
    await db.query(
      `UPDATE product_batches
       SET quantity_available = quantity_available + $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [restoreQty, row.batch_id]
    );

    if (restoreQty === allocated) {
      await db.query('DELETE FROM order_batch_allocations WHERE id = $1', [row.id]);
    } else {
      await db.query('UPDATE order_batch_allocations SET quantity = quantity - $1 WHERE id = $2', [restoreQty, row.id]);
    }

    if (quantity != null) {
      remaining -= restoreQty;
    }
  }

  if (quantity != null && remaining > 0) {
    throw new Error(`Unable to restore ${quantity} units for product ${productId}`);
  }

  return refreshProductStockTotals(db, productId);
};
