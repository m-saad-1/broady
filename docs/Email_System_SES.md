
### **Amazon SES Email Configuration (Critical Setup)**

Set up and configure **Amazon SES SMTP email system** for the Broady project.

---

### **Email Sending Requirement**

Emails must be sent using SES from:

* `msaad23305@gmail.com`

---

### **Target Recipients**

Emails should be delivered to:

* Customers (registered email)
* Brands (brand account email)
* Broady Admin emails

---

### **SMTP Credentials**

Use the provided file:

* `broady_credentials.csv`

### **Implementation Notes**

The API now sends all system email through the SES SMTP transport configured in the API environment.

Required settings:

EMAIL_PROVIDER=ses

EMAIL_FROM_NAME=Broady
EMAIL_FROM_ADDRESS=msaad23305@gmail.com

AWS_REGION=ap-south-1
SES_REGION=ap-south-1

SES_SMTP_HOST=email-smtp.ap-south-1.amazonaws.com
SES_SMTP_PORT=587
SES_SMTP_SECURE=false

SES_SMTP_USER=your_smtp_username
SES_SMTP_PASS=your_smtp_password

Delivery attempts are recorded in the notification channel log with `SENT` or `FAILED` status.

---

### **Email System Flow**

Implement a unified email service with the following flow:

1. Event triggered (order, notification, registration, etc.)
2. System identifies recipient role:

   * Customer / Brand / Admin
3. Email template selected based on event type
4. Email sent via **Amazon SES SMTP**
5. Delivery status logged (success/failure)

---

### **Core Requirement**

* Ensure all system emails (orders, notifications, updates, etc.) are routed through SES
* Must support:

  * Transactional emails
  * Order updates
  * Notifications
  * System alerts

---

### **Expected Outcome**

* Fully functional SES email integration
* Reliable email delivery to all user roles
* Centralized email service for the entire system

---
