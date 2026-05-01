1. Online Payment Verification (Critical)
For online payments:
Verify payment via gateway callback/webhook
Only after verification → update order status
Flow:
Pending → Confirmed (after payment verified)
2. COD Order Flow
For Cash on Delivery:
No payment verification needed
Automatically update:
Pending → Confirmed
Note:
Brands must NOT confirm orders or verify payments
This is handled entirely by the system
3. Delivery Failure Handling System
Delivery States
Shipped
Out for Delivery
Delivered
Delivery Failed
Returned
State Transitions
Shipped → Out for Delivery → Delivered
Shipped → Out for Delivery → Delivery Failed → Retry
Delivery Failed → Returned → Refund (for prepaid)
Retry Logic
Allow 2–3 delivery attempts
Track:
Number of attempts
Failure reason
Next attempt date
Handling Rules
Delivery Failed = temporary state
Allow retry → back to Out for Delivery
After final failure:
COD → Cancel order
Prepaid → Return + Refund
Data to Store
delivery_attempts
failure_reason
next_attempt_date
System Behavior
Each sub-order handled independently
Parent order shows combined/derived status
Trigger notifications on every status update
UX Requirements
Show:
Current status
Failure reason
Next delivery attempt info
Goal

Build a robust, retry-capable delivery system with proper failure handling, transparency, and refund support.

---

## **1. Payment Flow Rules (Critical System Logic)**

Ensure strict order lifecycle handling:

* **Online Payment Success**

  * Payment verified via gateway callback/webhook
  * Order status → **Confirmed**

* **Payment Failure**

  * Order status → **Cancelled immediately**

* **COD Orders**

  * Skip payment verification
  * Direct flow:

    * **Pending → Confirmed**

---

## **2. Notification System Foundation (Event-Driven Architecture)**

Standardize all system events:

### **Core Events**

* `order_placed`
* `payment_success`
* `suborder_confirmed`
* `suborder_shipped`
* `suborder_delivered`
* `suborder_cancelled`
* `product_approved`
* `product_rejected`

---

## **3. Notification Rules Engine**

Create a centralized mapping system:

**Event → Recipients → Channels**

Example:

* `order_placed` → User + Brand + Admin → App + Email
* `suborder_shipped` → User + Brand → App + Email + Push

---

## **4. Queue System (Critical Fix)**

Rule:

* ❌ Never send notifications directly
* ✅ Always use queue-based processing

### Flow:

`Event → Queue → Worker → Channel Handlers`

---

## **5. Worker System (Robust Processing Layer)**

Worker responsibilities:

* Fetch job from queue
* Process notification
* Handle failures gracefully
* Retry failed jobs
* Log delivery status

---

## **6. Notification Channels**

### **A. Dashboard Notifications (Refinement)**

* Store in DB
* Show in UI
* Support:

  * Read / Unread state

---

### **B. Email Notifications (Stabilized)**

* Use SMTP initially (later migrate to Amazon SES)
* Ensure:

  * Templates
  * Clean formatting
  * Retry on failure

---

### **C. Push Notifications (NEW - Firebase Integration)**

Use **Firebase Cloud Messaging**

---

### **Firebase Setup**

Use your config:

```javascript
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-analytics.js";

const firebaseConfig = {
  apiKey: "AIzaSyAj35DswTroeOFF-ghjDvdW52heLA45Uso",
  authDomain: "broady-1.firebaseapp.com",
  projectId: "broady-1",
  storageBucket: "broady-1.firebasestorage.app",
  messagingSenderId: "190709096272",
  appId: "1:190709096272:web:8d7d2b10d38f27ee0f1655",
  measurementId: "G-WS9W2XZJPV"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
```

---

### **Firebase CLI Commands**

```bash
npm install -g firebase-tools

firebase login
firebase init
firebase deploy
```

---

### **FCM Credentials**

* Sender ID: `190709096272`
* Cloud Messaging Key:

  ```
  BPpTKerM6IDfpLCLWrcescfMj8_GPY6RfnvR_HgWarWIzxi6fMH0bmyH36ikc_sKo681zDJJISGQeLetdZ1N_No
  ```

---

## **7. Frontend (PWA Setup)**

Required steps:

* Add **Service Worker**
* Request notification permission:

Flow:

1. User visits site
2. Prompt:

   > “Allow notifications?”
3. If accepted:

   * Generate device token
   * Store in database

---

## **8. Backend Push Flow**

Backend pipeline:

`Event → Queue → Worker → Push Service → FCM → User Device`

Target:

* Specific user tokens only

---

## **9. Implementation Status (Current Repo)**

The requested notification system is already implemented in the codebase. The main entry points are:

* API queue and adapter selection: `apps/api/src/modules/notifications/notification.queue.ts`
* Notification orchestration and channel delivery: `apps/api/src/modules/notifications/notification.service.ts`
* Worker runtime and retry/backoff handling: `apps/api/src/modules/notifications/notification.worker.ts`
* Email delivery: `apps/api/src/modules/notifications/notification.email.ts`
* Push delivery via FCM HTTP v1: `apps/api/src/modules/notifications/notification.push.ts`
* Event names and payloads: `apps/api/src/modules/notifications/notification.events.ts`
* User notification/device-token endpoints: `apps/api/src/modules/users/users.routes.ts`
* Payment webhook entry point: `apps/api/src/modules/orders/orders.routes.ts`
* Web push registration: `apps/web/src/components/notifications/push-notification-registration.tsx`

Database coverage is in `apps/api/prisma/schema.prisma` and now includes:

* `Notification` table
* `NotificationChannelLog` table
* read/unread state via `readAt`
* delivery tracking via `deliveryStatus`, `deliveryAttempts`, `failedReason`, `nextAttemptAt`

### Queue backend choice

The queue backend is chosen by `NOTIFICATION_QUEUE_ADAPTER`:

* `redis` uses BullMQ + Redis
* `postgres` uses the PostgreSQL job tables
* `memory` uses the in-memory adapter for local/dev testing

If `NOTIFICATION_QUEUE_ADAPTER` is not set, the app prefers Redis when `REDIS_URL` exists, otherwise Postgres.

### Where notifications are sent

Notifications are delivered to three places:

* Dashboard notifications stored in the database and shown in the app UI
* Email sent through SMTP first, or Resend if SMTP is not configured
* Push sent to registered device tokens through Firebase Cloud Messaging

### How to test locally

1. Start infrastructure:

```bash
npm run db:up
```

2. Install dependencies and apply the Prisma migration:

```bash
npm install
npm run prisma:generate -w @broady/api
npm run prisma:migrate -w @broady/api
```

3. Run the app and worker:

```bash
npm run dev:all
```

4. Test payment success:

* Place an order with an online payment method.
* Call the payment webhook route in `apps/api/src/modules/orders/orders.routes.ts` with a valid HMAC signature.
* Confirm the order moves from `PENDING` to `CONFIRMED` only after the webhook is accepted.

5. Test COD:

* Create an order with `COD`.
* Confirm it moves directly from `PENDING` to `CONFIRMED` without a payment webhook.

6. Test notifications:

* Open the site, grant browser notification permission, and register a device token.
* Trigger an order or shipment event.
* Verify the notification is stored in the DB, displayed in the dashboard, and delivered to the configured email/push channels.

7. Test worker behavior:

* Stop Redis or switch to the `memory` adapter to exercise fallback paths.
* Trigger an event and confirm retry/backoff logs are written by the worker.
* Check the admin dead-letter endpoints for discarded jobs.

### Secrets and configuration

Keep the following in environment variables, not in source code:

* `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`
* `RESEND_API_KEY`
* `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, or `FIREBASE_SERVICE_ACCOUNT_JSON`
* `REDIS_URL`
* `PAYMENT_WEBHOOK_SECRET`

---

## **Final Outcome**

* Fully event-driven notification system
* Reliable queue + worker architecture
* Multi-channel notifications (App, Email, Push)
* Scalable Firebase-based push system
* Clean separation of concerns across services

---




At last, Verfy every requirement properly.