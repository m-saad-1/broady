You are a senior backend system architect responsible for implementing a robust, production-ready multi-vendor order management system for an e-commerce platform (Broady).

Your task is to design and enforce a correct order lifecycle with the following constraints and requirements:

1. **Order Structure**

* Implement a Parent Order and SubOrder architecture.
* A Parent Order represents a single checkout.
* Each SubOrder represents a brand-specific fulfillment unit.
* Each SubOrder contains its own items and lifecycle.
* All status updates must occur at the SubOrder level, not the Parent Order.

2. **State Machine (STRICT)**
   Each SubOrder must follow this lifecycle:

Pending → Confirmed → Processing → Shipped → Out for Delivery → Delivered
OR
Out for Delivery → Delivery Failed → Returned → Cancelled

Rules:

* Disallow invalid transitions (e.g., Shipped → Cancelled, Delivered → Processing).
* Enforce backend validation for all transitions.
* Parent Order status must be derived from SubOrder states (never manually set).

3. **Delivery Failure Handling**

* Introduce a “Delivery Failed” state to handle unsuccessful delivery attempts.
* When delivery fails:

  * SubOrder moves from “Out for Delivery” → “Delivery Failed”.
  * Brand or logistics provider is responsible for updating this status.
* After failure:

  * Allow retry (Delivery Failed → Out for Delivery)
  * OR mark as Returned (Delivery Failed → Returned)

4. **Cancellation Logic**

* Brands are NOT allowed to cancel orders after they reach “Shipped”.
* Cancellation must follow this path:
  Returned → Cancelled
* Only Admin or system automation can trigger final cancellation.
* Implement rules such as:

  * Auto-cancel after return confirmation
  * Trigger refund workflow upon cancellation

5. **Role-Based Control**

* Brand dashboard:

  * Can update statuses only up to:
    Processing → Shipped → Out for Delivery → Delivery Failed → Delivered
  * Cannot cancel or refund orders post-shipment
* Admin:

  * Has full visibility and control
  * Can finalize cancellation and trigger refunds
* System:

  * Can automate transitions (e.g., Returned → Cancelled after delay)

6. **Partial Order Handling**

* Support multiple SubOrders under one Parent Order.
* Each SubOrder must operate independently.
* Parent Order status must reflect aggregated states:

  * All Delivered → Delivered
  * Mixed → Partially Delivered / In Progress
  * All Cancelled → Cancelled

7. **Event & Notification Integration**

* Every status change must emit an event:

  * suborder_shipped
  * suborder_delivery_failed
  * suborder_returned
  * suborder_cancelled
* Events must trigger notifications (email, dashboard, push).

8. **Data Integrity Rules**

* Each SubOrder belongs to exactly one brand.
* Each OrderItem belongs to exactly one SubOrder.
* Status transitions must be strictly validated.

9. **Output Requirements**

* Define clear state transition rules
* Describe role-based permissions
* Ensure scalability and consistency
* Avoid shortcuts that break real-world logistics behavior

Think like a production system architect. Prioritize correctness, data integrity, and real-world logistics flow over simplicity.




Delivery Failed Flow (Critical System Implementation)
1. Action Trigger (Brand Side)

When a brand clicks “Mark as Delivery Failed”:

2. Mandatory Input (Validation Required)

System must enforce a required input:

Failure Reason (Required)
Dropdown options:
Customer not available
Incorrect address
Phone unreachable
Refused delivery
Area not serviceable
Other (with text input)
Do not allow submission without selecting/providing a reason
3. Customer Communication

Send clear notification to customer:

Example:
“Delivery failed: Customer not available”
4. Retry Logic (Smart Handling)

Based on selected reason:

Customer not available
Allow re-attempt delivery
Incorrect/Invalid address
Require address correction before retry
Phone unreachable
Allow retry + optional contact attempt
Refused delivery
Mark toward potential cancellation flow
Area not serviceable
Move toward final failure handling
5. System Rules
Delivery Failed = Temporary State (not cancelled)
Allow retry:
→ Back to Out for Delivery
Track:
delivery_attempts
failure_reason
next_attempt_date
6. Final Failure Handling

After max attempts (2–3 retries):

COD Orders
→ Cancel order
Prepaid Orders
→ Mark as Returned
→ Trigger Refund
7. Analytics Layer

Track and expose:

Failure rate per brand
Most common failure reasons
Delivery issue trends
8. Fraud Detection

Detect suspicious patterns:

Excessive “Delivery Failed” by a brand
Repeated failures for same users/locations
Fake or inconsistent reasons
9. Role-Based Responsibilities
Brand
Must provide failure reason (mandatory)
Owns delivery status updates
Admin
Can view all delivery failures
Can override status (optional control)
System
Enforces validation
Applies retry logic
Uses failure reason for:
Automation
Notifications
Analytics
Expected Outcome
Controlled and structured delivery failure handling
Transparent communication with users
Smart retry system
Strong analytics and fraud prevention




## delivery failure logic, including retry rules, cancellation rules, timeout automation, and behavior for each failure reason
You are a senior backend systems architect responsible for implementing delivery failure handling logic in a multi-vendor e-commerce platform (Broady). Your task is to design a strict, rule-based system that governs delivery failures, retries, returns, and cancellations based on failure reasons and time-based automation.

---

### 1. Core Principle

* Delivery failure does NOT directly lead to cancellation.
* Every failure must follow a structured lifecycle:

Out for Delivery → Delivery Failed → (Retry OR Returned) → Cancelled

* Cancellation is NEVER allowed directly from “Shipped” or “Out for Delivery”.

---

### 2. Failure Reason System (MANDATORY)

When marking “Delivery Failed”, the system MUST require a structured failure reason.

Supported reasons:

* CUSTOMER_NOT_AVAILABLE
* REFUSED_BY_CUSTOMER
* INVALID_ADDRESS
* PHONE_UNREACHABLE
* AREA_NOT_SERVICEABLE
* OTHER (with custom message)

Each reason must drive system behavior.

---

### 3. Retry Rules (STRICT)

#### CUSTOMER_NOT_AVAILABLE

* Allow retry
* Max retry attempts: 2
* Flow:
  Delivery Failed → Out for Delivery → Delivered
* If retry limit exceeded:
  → Returned → Cancelled

---

#### PHONE_UNREACHABLE

* Allow retry (same as above)
* Max attempts: 2
* Notify user to respond
* If no response:
  → Returned → Cancelled

---

#### REFUSED_BY_CUSTOMER

* DO NOT allow retry
* Flow:
  Delivery Failed → Returned → Cancelled
* Exception:
  Only allow retry if user explicitly requests reattempt via support

---

#### INVALID_ADDRESS

* DO NOT auto-retry
* Require user to update address
* Flow:
  Delivery Failed → Waiting for Correction
  If user updates:
  → Out for Delivery
  If no update within timeout:
  → Returned → Cancelled

---

#### AREA_NOT_SERVICEABLE

* DO NOT retry
* Immediate:
  → Returned → Cancelled

---

#### OTHER

* Default behavior:

  * Allow 1 retry (configurable)
  * If fails again:
    → Returned → Cancelled

---

### 4. Timeout & Automation Rules (CRITICAL)

System must enforce automatic transitions when brands do not act.

After Delivery Failed:

* 0–6 hours:
  Waiting for brand action

* 6–24 hours:
  Send reminder to brand

* 24–48 hours:
  Auto-mark as Returned (if no update)

* 48–72 hours:
  Auto-mark as Cancelled

---

### 5. Role-Based Permissions

#### Brand:

* Can update:
  Processing → Shipped → Out for Delivery → Delivery Failed → Delivered
* Must provide failure reason when marking Delivery Failed
* Cannot cancel after shipment

#### Admin:

* Can override statuses
* Can force return or cancellation
* Can trigger refunds

#### System:

* Handles:
  Timeout automation
  Retry limits
  Forced transitions
  Notifications

---

### 6. Data Requirements

Each SubOrder must include:

* failureReason (enum)
* failureMessage (optional)
* retryCount
* lastAttemptAt
* statusTimestamps

---

### 7. Event System Integration

Each transition must emit events:

* suborder_delivery_failed
* suborder_retry_scheduled
* suborder_returned
* suborder_cancelled

---

### 8. Notification Rules

* On Delivery Failed:
  Notify user with reason
* On Retry:
  Notify user
* On Return:
  Notify user and admin
* On Cancellation:
  Notify all parties and trigger refund

---

### 9. Validation Rules

* Reject Delivery Failed if no failureReason provided
* Reject retry if retryCount exceeded
* Reject invalid transitions (e.g., Shipped → Cancelled)

---

### 10. Final Objective

Ensure:

* No stuck orders
* No invalid transitions
* Full automation fallback
* Clear accountability (brand → delivery, system → control)

Design the system to reflect real-world logistics behavior with strict enforcement and scalability.





## Delivery Failed – Incorrect Address Flow Fix

(Critical)

There is currently an issue where, when a brand marks an order as Delivery Failed (Incorrect Address), the system immediately marks it as Returned. This behavior is incorrect and must be fixed.

Required Correct Flow

When brand selects:

“Delivery Failed → Incorrect Address”

The system MUST follow this flow:

1. Status Behavior (IMPORTANT FIX)
❌ Do NOT mark order as Returned automatically
Instead set status to:
“Address Correction Required”
2. Customer Notification

System must immediately notify customer via:

App notification
Email

Message example:

“Your delivery failed due to incorrect address. Please update your address to proceed with delivery.”

3. Customer Action Requirement

Customer must be able to:

Update delivery address from their dashboard
Save updated address successfully
4. System Update After Address Change

After customer updates address:

System should:
Notify brand:
“Customer has updated the delivery address for Order XXX”
Update order status to:
“Ready for Re-delivery”
5. Brand Action After Update

After receiving updated address:

Brand can:
Retry delivery
Mark again as Out for Delivery
6. Final Flow Summary

Incorrect Address Flow:

Brand marks: Delivery Failed → Incorrect Address
System → Status = Address Correction Required
Customer updates address
System notifies brand
Status → Ready for Re-delivery
Brand retries delivery
7. System Rules
❌ No automatic “Returned” status for address issues
✔ Address correction must be resolved first
✔ Only final failed attempts may lead to Return/Refund
Expected Outcome
Real-world delivery correction flow
Customer-driven address updates
No premature returns
Clear communication between customer and brand
Fully operational retry 





 
## Order Status & Notification System Fixes

1. Status Selection Control (Brand Dashboard)
In the status dropdown:
Do NOT allow selecting the already active status
Either:
Hide the current status from options, or
Show it as disabled/selected (non-clickable)
2. Incorrect Address Notifications (Critical Fix)
Fix issue where notifications/emails are not sent
Ensure BOTH receive notifications:
Customer

App + Email:

“Delivery failed due to incorrect address. Please update your address.”

Brand

App + Email:

“Order delivery failed due to incorrect address. Waiting for customer update.”

3. Duplicate Notifications
Fix issue where same notification is sent twice
Ensure:
One event → one notification per channel
No duplicate triggers from API / worker / frontend
4. Notification Timestamp
Add time (timestamp) to every notification
Display in UI (e.g., “2 mins ago”, “10:45 AM”)
5. Notification Modal (Header)
Show all notifications in header popup (no hard limit like 5)
Enable scroll if needed
6. Notification Read Behavior
When user opens notification modal:
Mark notifications as read
Remove unread count/badge for those notifications
Expected Outcome
Clean and controlled status updates
Reliable notification delivery (no missing or duplicate alerts)
Better UX with timestamps and full notification visibility
Accurate unread/read state handling.