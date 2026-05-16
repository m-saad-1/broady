SELECT o.id as order_id, b.name as brand_name, p.name as product_name, oi.quantity, oi."unitPricePkr" as unit_price
FROM "Order" o
JOIN "OrderItem" oi ON oi."orderId" = o.id
JOIN "Product" p ON p.id = oi."productId"
JOIN "Brand" b ON b.id = oi."brandId"
LIMIT 5;
