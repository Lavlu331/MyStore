-- Seed a freshly initialized portfolio demo database once.
START TRANSACTION;

INSERT INTO categories (id, name, description) VALUES
  (1, 'Audio', 'Headphones and speakers for everyday listening.'),
  (2, 'Accessories', 'Personal accessories for daily use.');

INSERT INTO products (id, name, description, price, discount_price, category_id) VALUES
  (1, 'Studio Wireless Headphones', 'Fictional demo product. Silver over-ear headphones with soft cushions and a padded headband.', 5200.00, 4590.00, 1),
  (2, 'Pocket Bluetooth Speaker', 'Fictional demo product. Compact lavender speaker with a woven grille and a carry loop.', 2450.00, NULL, 1),
  (3, 'Halo Analog Watch', 'Fictional demo product. A stainless steel bracelet and a pale violet dial.', 3600.00, 3190.00, 2);

INSERT INTO product_images (product_id, image_url) VALUES
  (1, '/demo-products/studio-headphones.jpg'),
  (2, '/demo-products/pocket-speaker.jpg'),
  (3, '/demo-products/halo-watch.jpg');

INSERT INTO warehouses (id, name) VALUES (1, 'Demo Warehouse');
INSERT INTO warehouse_inventory (product_id, warehouse_id, quantity, low_stock_threshold) VALUES
  (1, 1, 20, 5),
  (2, 1, 16, 5),
  (3, 1, 4, 5);

INSERT INTO inventory_transactions (product_id, warehouse_id, transaction_type, quantity, previous_stock, new_stock, note) VALUES
  (1, 1, 'restock', 20, 0, 20, 'Portfolio demo starting stock'),
  (2, 1, 'restock', 16, 0, 16, 'Portfolio demo starting stock'),
  (3, 1, 'restock', 4, 0, 4, 'Portfolio demo starting stock');

INSERT INTO coupons (code, description, discount_type, discount_value, is_public) VALUES
  ('PORTFOLIO10', '10% off your first demo order.', 'percent', 10.00, 1);

INSERT INTO settings (setting_key, setting_value) VALUES
  ('delivery_charge', '80.00'),
  ('free_delivery_threshold', '6000.00');

COMMIT;
