# Broady Database Guide


## Why Broady needs a database

Broady is an e-commerce marketplace, so it must remember many things:

- who the users are
- which brands sell on the platform
- what products are available
- what is in a cart
- what orders were placed
- how each order is progressing
- what reviews, notifications, and activity events were created

Without a database, Broady would forget all of this every time it restarted. That would make shopping, checkout, order tracking, and brand management impossible.

## What Broady uses

Broady uses three important data tools:

- **PostgreSQL** is the main database that stores the real data.
- **Prisma** is the ORM that Broady uses to talk to PostgreSQL in a safe, typed way.
- **Redis** is used for fast temporary support work like caching and queues, but it is not the main source of truth.

In short: PostgreSQL holds the real records, Prisma helps the app read and write them, and Redis helps speed things up.

## What is stored in Broady’s database

Broady stores the core business data in PostgreSQL. The main things include:

- **User** records for customers, admins, and brand users
- **Brand** records for the stores that sell on Broady
- **Product** records for items like clothes, shoes, and accessories
- **Cart** and **CartItem** records for shopping carts
- **Order** and **SubOrder** records for purchases and split fulfillment
- **OrderItem** records for each product inside an order
- **Review** records for customer feedback
- **Notification** records for order updates and other messages
- **Session** records for login sessions
- **UserActivity** records for actions like product views, search queries, and purchases

You can see these tables in [apps/api/prisma/schema.prisma](../apps/api/prisma/schema.prisma).

## Tables, rows, and columns

The database is organized into **tables**.

A table is like a spreadsheet sheet for one topic. For example, the `User` table holds user data, and the `Product` table holds product data.

Inside a table:

- **Rows** are the individual records.
- **Columns** are the fields inside each record.

Example:

- one row in `User` = one person account
- one row in `Product` = one product listing
- one row in `Order` = one customer order

If a product has columns like `name`, `pricePkr`, `stock`, and `brandId`, then each row stores the values for one real product.

## Simple Broady examples

Here is an easy way to imagine the data:

- A customer signs up, and Broady stores them in `User`.
- A brand joins Broady, and Broady stores it in `Brand`.
- The brand creates a product, and Broady stores it in `Product`.
- The customer adds that product to the cart, and Broady stores it in `CartItem`.
- The customer checks out, and Broady stores the purchase in `Order` and `OrderItem`.
- If the order is split across brands, Broady also creates `SubOrder` records.
- After delivery, the customer writes a review, and Broady stores it in `Review`.

## Primary keys and foreign keys

Every table needs a way to identify each row.

- A **primary key** is the unique ID for one row.
- A **foreign key** is a field that points to a row in another table.

Example:

- `User.id` uniquely identifies one user.
- `Product.brandId` points to the brand that owns the product.
- `Order.userId` points to the user who placed the order.
- `OrderItem.orderId` points to the order that contains that item.

This is how Broady connects related data without copying everything into one place.

## Relationships between data

Broady’s data is connected in a few important ways:

- one user can have one cart
- one brand can have many products
- one order can have many order items
- one order can be split into many sub-orders
- one product can receive many reviews
- one notification can belong to a user, a brand, or an order

These relationships help Broady show the right information in the right place.

## Why PostgreSQL fits Broady

PostgreSQL is Broady’s main database because it is good at storing connected business data.

It works well for Broady because:

- e-commerce data is highly relational
- orders, users, brands, and products need strong links
- Broady needs reliable transactions so data does not get lost or half-saved
- PostgreSQL can handle indexing and search support well

In simple words, PostgreSQL is a solid choice because Broady needs accuracy, structure, and reliability.

## What Prisma does

Prisma sits between Broady’s code and PostgreSQL.

Instead of writing raw SQL for everything, Broady uses Prisma to:

- read data
- create new records
- update records
- delete records
- keep database access type-safe

That means the API can ask for data in a cleaner, safer way, and the code is easier to maintain.

Prisma also uses the schema file as a clear definition of the database structure. That file acts like the plan for the tables and relationships.

## What Redis does

Redis is not the main database. It supports the system.

Broady can use Redis for things like:

- fast temporary caching
- queues for background work
- short-lived data that does not need to live forever

If Redis is cleared, the app should still have the real data in PostgreSQL. That is why PostgreSQL remains the source of truth.

## How data moves through Broady

Here is the simple flow:

1. A user interacts with the web app.
2. The web app sends a request to the API.
3. The API uses Prisma to read or write PostgreSQL.
4. PostgreSQL saves the real data.
5. If needed, the API also uses Redis for speed or background tasks.
6. The web app shows the updated result to the user.

Example: when someone places an order, the API saves the order in PostgreSQL, creates the related items and sub-orders, and then sends notifications or background jobs if needed.

## Migrations

A migration is a controlled change to the database structure.

For example, if Broady needs a new column or a new table, a migration updates the database in a safe and repeatable way.

This matters because Broady’s database structure will evolve over time. Migrations help keep development, testing, and production aligned.

## Backups and safety

The database holds the most important business data, so it must be protected.

Good database safety includes:

- regular backups
- safe schema changes
- avoiding accidental data loss
- keeping PostgreSQL as the trusted source of truth

If something goes wrong, backups help restore the data.

## Simple view of the main tables

Here is a plain-English summary of the most important tables:

- **User**: stores account details for shoppers, admins, and brand users
- **Brand**: stores brand profile information
- **Product**: stores product details, price, stock, and category fields
- **Cart** and **CartItem**: store what a user wants to buy
- **Order**: stores the main purchase record
- **SubOrder**: stores the part of an order that belongs to one brand
- **OrderItem**: stores each product inside an order
- **Review**: stores customer feedback on products
- **Notification**: stores alerts shown to users or brands
- **Session**: stores login session data
- **UserActivity**: stores tracking events like views and purchases

## Bottom line

Broady’s database is the memory of the platform. PostgreSQL stores the real data, Prisma helps the app work with that data, and Redis supports performance and background tasks.

If you want the more technical version of how Broady is structured, see [docs/Broady_Architecture.md](Broady_Architecture.md) and [docs/system-design.md](system-design.md).