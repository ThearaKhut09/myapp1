# VPN Platform API Documentation

## Overview

This document provides comprehensive documentation for the VPN Platform API endpoints. The API is RESTful and uses JSON for request and response bodies.

### Base URL
```
http://localhost:3000/api
```

### Authentication
Most endpoints require JWT authentication. Include the token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

### Response Format
All API responses follow this standard format:
```json
{
  "success": true|false,
  "message": "Human readable message",
  "data": {}, // Response data (if applicable)
  "error": "Error details" // Only present if success is false
}
```

## Authentication Endpoints

### POST /auth/register
Register a new user account.

**Request Body:**
```json
{
  "username": "string (required, 3-50 chars)",
  "email": "string (required, valid email)",
  "password": "string (required, min 6 chars)"
}
```

**Response:**
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "user": {
      "id": 1,
      "username": "john_doe",
      "email": "john@example.com",
      "created_at": "2025-06-03T10:00:00Z"
    },
    "token": "jwt-token-here"
  }
}
```

### POST /auth/login
Authenticate user and receive JWT token.

**Request Body:**
```json
{
  "email": "string (required)",
  "password": "string (required)"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": 1,
      "username": "john_doe",
      "email": "john@example.com",
      "subscription_status": "active"
    },
    "token": "jwt-token-here"
  }
}
```

### POST /auth/logout
Logout user (invalidate token).

**Headers:**
- Authorization: Bearer token required

**Response:**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

### GET /auth/profile
Get current user profile information.

**Headers:**
- Authorization: Bearer token required

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "username": "john_doe",
      "email": "john@example.com",
      "subscription_status": "active",
      "subscription_type": "premium",
      "created_at": "2025-06-03T10:00:00Z",
      "last_login": "2025-06-03T12:00:00Z"
    }
  }
}
```

## VPN Connection Endpoints

### GET /vpn/servers
Get list of available VPN servers.

**Headers:**
- Authorization: Bearer token required

**Query Parameters:**
- `location` (optional): Filter by country/region
- `status` (optional): Filter by server status (active, maintenance)

**Response:**
```json
{
  "success": true,
  "data": {
    "servers": [
      {
        "id": 1,
        "name": "US East 1",
        "location": "New York, USA",
        "ip": "192.168.1.1",
        "port": 1194,
        "protocol": "OpenVPN",
        "load": 45,
        "status": "active",
        "ping": 23
      }
    ]
  }
}
```

### POST /vpn/connect
Connect to a VPN server.

**Headers:**
- Authorization: Bearer token required

**Request Body:**
```json
{
  "server_id": 1,
  "protocol": "OpenVPN" // Optional, defaults to server's protocol
}
```

**Response:**
```json
{
  "success": true,
  "message": "Connected to VPN server",
  "data": {
    "connection": {
      "id": "conn-123",
      "server_id": 1,
      "server_name": "US East 1",
      "connected_at": "2025-06-03T12:00:00Z",
      "client_ip": "10.8.0.2",
      "status": "connected"
    }
  }
}
```

### POST /vpn/disconnect
Disconnect from current VPN server.

**Headers:**
- Authorization: Bearer token required

**Response:**
```json
{
  "success": true,
  "message": "Disconnected from VPN server"
}
```

### GET /vpn/status
Get current connection status.

**Headers:**
- Authorization: Bearer token required

**Response:**
```json
{
  "success": true,
  "data": {
    "connection": {
      "id": "conn-123",
      "server_id": 1,
      "server_name": "US East 1",
      "connected_at": "2025-06-03T12:00:00Z",
      "duration": 3600,
      "bytes_sent": 1024000,
      "bytes_received": 2048000,
      "status": "connected"
    }
  }
}
```

## Payment Endpoints

### GET /payment/plans
Get available subscription plans.

**Response:**
```json
{
  "success": true,
  "data": {
    "plans": [
      {
        "id": "monthly",
        "name": "Monthly Plan",
        "price": 9.99,
        "currency": "USD",
        "duration": "1 month",
        "features": ["Unlimited bandwidth", "50+ servers", "24/7 support"]
      },
      {
        "id": "yearly",
        "name": "Yearly Plan",
        "price": 99.99,
        "currency": "USD",
        "duration": "12 months",
        "features": ["Unlimited bandwidth", "50+ servers", "24/7 support", "2 months free"]
      }
    ]
  }
}
```

### POST /payment/create-intent
Create a payment intent for subscription.

**Headers:**
- Authorization: Bearer token required

**Request Body:**
```json
{
  "plan_id": "monthly",
  "payment_method": "stripe" // stripe, paypal, crypto
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "client_secret": "pi_1234567890_secret_abcdef",
    "amount": 999,
    "currency": "usd"
  }
}
```

### POST /payment/confirm
Confirm payment and activate subscription.

**Headers:**
- Authorization: Bearer token required

**Request Body:**
```json
{
  "payment_intent_id": "pi_1234567890",
  "plan_id": "monthly"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Payment confirmed and subscription activated",
  "data": {
    "subscription": {
      "id": "sub-123",
      "plan": "monthly",
      "status": "active",
      "current_period_start": "2025-06-03T12:00:00Z",
      "current_period_end": "2025-07-03T12:00:00Z"
    }
  }
}
```

## Admin Endpoints

### GET /admin/users
Get list of all users (Admin only).

**Headers:**
- Authorization: Bearer token required (admin role)

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)
- `search` (optional): Search by username or email
- `status` (optional): Filter by subscription status

**Response:**
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": 1,
        "username": "john_doe",
        "email": "john@example.com",
        "subscription_status": "active",
        "subscription_type": "premium",
        "created_at": "2025-06-03T10:00:00Z",
        "last_login": "2025-06-03T12:00:00Z",
        "total_connections": 15,
        "data_usage": 1024000000
      }
    ],
    "pagination": {
      "current_page": 1,
      "total_pages": 5,
      "total_items": 100,
      "items_per_page": 20
    }
  }
}
```

### GET /admin/servers
Get server management information (Admin only).

**Headers:**
- Authorization: Bearer token required (admin role)

**Response:**
```json
{
  "success": true,
  "data": {
    "servers": [
      {
        "id": 1,
        "name": "US East 1",
        "location": "New York, USA",
        "ip": "192.168.1.1",
        "status": "active",
        "load": 45,
        "connections": 123,
        "bandwidth_usage": 5000000000,
        "uptime": 99.9,
        "last_maintenance": "2025-06-01T00:00:00Z"
      }
    ]
  }
}
```

### GET /admin/analytics
Get system analytics (Admin only).

**Headers:**
- Authorization: Bearer token required (admin role)

**Query Parameters:**
- `period` (optional): Time period (day, week, month, year)
- `metric` (optional): Specific metric to retrieve

**Response:**
```json
{
  "success": true,
  "data": {
    "overview": {
      "total_users": 1000,
      "active_users": 750,
      "total_connections": 5000,
      "revenue": 50000,
      "bandwidth_usage": 1000000000000
    },
    "metrics": {
      "user_growth": [
        {"date": "2025-06-01", "value": 950},
        {"date": "2025-06-02", "value": 975},
        {"date": "2025-06-03", "value": 1000}
      ],
      "connection_stats": [
        {"date": "2025-06-01", "connections": 120},
        {"date": "2025-06-02", "connections": 135},
        {"date": "2025-06-03", "connections": 150}
      ]
    }
  }
}
```

### PUT /admin/users/:id
Update user information (Admin only).

**Headers:**
- Authorization: Bearer token required (admin role)

**Request Body:**
```json
{
  "subscription_status": "active",
  "subscription_type": "premium",
  "is_banned": false
}
```

**Response:**
```json
{
  "success": true,
  "message": "User updated successfully",
  "data": {
    "user": {
      "id": 1,
      "username": "john_doe",
      "email": "john@example.com",
      "subscription_status": "active",
      "subscription_type": "premium",
      "is_banned": false
    }
  }
}
```

## WebSocket Events

### Connection
Connect to WebSocket for real-time updates:
```javascript
const ws = new WebSocket('ws://localhost:3000');
```

### Events

#### Client Events (Send to Server)
- `join_room`: Join a specific room for updates
- `leave_room`: Leave a room
- `admin_command`: Send admin commands (admin only)

#### Server Events (Receive from Server)
- `connection_update`: Real-time connection status updates
- `server_status`: Server status changes
- `user_notification`: User-specific notifications
- `system_alert`: System-wide alerts
- `analytics_update`: Real-time analytics updates (admin)

### Example Usage
```javascript
// Join admin room for real-time updates
ws.send(JSON.stringify({
  type: 'join_room',
  room: 'admin'
}));

// Listen for real-time updates
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Received:', data);
};
```

## Error Codes

| Code | Description |
|------|-------------|
| 400 | Bad Request - Invalid input data |
| 401 | Unauthorized - Invalid or missing token |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource not found |
| 409 | Conflict - Resource already exists |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Internal Server Error - Server error |

## Rate Limiting

The API implements rate limiting to prevent abuse:
- Authentication endpoints: 5 requests per minute
- General API endpoints: 100 requests per minute
- Admin endpoints: 200 requests per minute

Rate limit headers are included in responses:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1625097600
```

## Security

### HTTPS
All API requests should be made over HTTPS in production.

### CORS
CORS is configured to allow requests from authorized domains only.

### Input Validation
All inputs are validated and sanitized to prevent injection attacks.

### SQL Injection Prevention
The API uses parameterized queries to prevent SQL injection.

## Examples

### JavaScript/Node.js
```javascript
const axios = require('axios');

// Login
const loginResponse = await axios.post('http://localhost:3000/api/auth/login', {
  email: 'john@example.com',
  password: 'password123'
});

const token = loginResponse.data.data.token;

// Get servers
const serversResponse = await axios.get('http://localhost:3000/api/vpn/servers', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

console.log(serversResponse.data);
```

### cURL
```bash
# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"john@example.com","password":"password123"}'

# Get servers with token
curl -X GET http://localhost:3000/api/vpn/servers \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Testing

### Test Endpoints
- `GET /api/test/health` - Health check endpoint
- `POST /api/test/echo` - Echo back request data

### Postman Collection
A Postman collection with all endpoints is available in the `/docs` folder.

## Support

For API support and questions:
- Email: api-support@vpnplatform.com
- Documentation: https://docs.vpnplatform.com
- Status Page: https://status.vpnplatform.com
