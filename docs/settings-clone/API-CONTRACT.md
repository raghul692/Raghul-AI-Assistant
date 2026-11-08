# CHATGPT GENERAL SETTINGS CLONE — REST API CONTRACT
**API Version:** v1  
**Base Path:** `/api/settings` & `/api/chats`  
**Authentication:** Session / User Context (`user_id = 'raghul'`)

---

### 1. `GET /api/settings`
Retrieves all persisted settings for the authenticated user with merged system defaults.

#### Request:
- **Method:** `GET`
- **Path:** `/api/settings`
- **Headers:** `Content-Type: application/json`

#### Response (`200 OK`):
```json
{
  "success": true,
  "userId": "raghul",
  "settings": {
    "theme": "dark",
    "language": "auto",
    "always_show_code": false,
    "enter_sends_message": true,
    "sound_effects": false
  },
  "updatedAt": 1794109400000
}
```

---

### 2. `GET /api/settings/:key`
Retrieves a single setting value by its unique key.

#### Request:
- **Method:** `GET`
- **Path:** `/api/settings/theme`

#### Response (`200 OK`):
```json
{
  "success": true,
  "key": "theme",
  "value": "dark"
}
```

#### Error Response (`404 Not Found`):
```json
{
  "success": false,
  "error": "Setting key 'invalid_key' is not recognized."
}
```

---

### 3. `PATCH /api/settings/:key`
Updates a single setting key with strict schema validation.

#### Request:
- **Method:** `PATCH`
- **Path:** `/api/settings/theme`
- **Body:**
```json
{
  "value": "light"
}
```

#### Response (`200 OK`):
```json
{
  "success": true,
  "key": "theme",
  "value": "light",
  "updatedAt": 1794109450000
}
```

---

### 4. `PATCH /api/settings`
Updates multiple settings concurrently within a single database transaction.

#### Request:
- **Method:** `PATCH`
- **Path:** `/api/settings`
- **Body:**
```json
{
  "settings": {
    "theme": "dark",
    "always_show_code": true,
    "enter_sends_message": true
  }
}
```

#### Response (`200 OK`):
```json
{
  "success": true,
  "updatedCount": 3,
  "settings": {
    "theme": "dark",
    "language": "auto",
    "always_show_code": true,
    "enter_sends_message": true,
    "sound_effects": false
  }
}
```

---

### 5. `POST /api/settings/reset`
Resets all settings to factory system defaults and logs an audit trail event.

#### Request:
- **Method:** `POST`
- **Path:** `/api/settings/reset`
- **Body:** `{}`

#### Response (`200 OK`):
```json
{
  "success": true,
  "message": "Settings reset to defaults successfully.",
  "settings": {
    "theme": "system",
    "language": "auto",
    "always_show_code": false,
    "enter_sends_message": true,
    "sound_effects": false
  }
}
```

---

### 6. `GET /api/settings/metadata`
Returns metadata regarding supported keys, descriptions, and allowed values.

#### Request:
- **Method:** `GET`
- **Path:** `/api/settings/metadata`

#### Response (`200 OK`):
```json
{
  "success": true,
  "keys": {
    "theme": {
      "type": "string",
      "allowed": ["system", "dark", "light"],
      "default": "system",
      "description": "User interface visual color theme"
    },
    "language": {
      "type": "string",
      "allowed": ["auto", "en", "tanglish"],
      "default": "auto",
      "description": "Application display and conversational language preference"
    },
    "always_show_code": {
      "type": "boolean",
      "default": false,
      "description": "Always display code blocks expanded when using data analysis"
    },
    "enter_sends_message": {
      "type": "boolean",
      "default": true,
      "description": "Press Enter to send message, Shift+Enter for newline"
    },
    "sound_effects": {
      "type": "boolean",
      "default": false,
      "description": "Play audio sound cues on completion or key actions"
    }
  }
}
```

---

### 7. Chat Archiving Endpoints (`/api/chats`)

#### `GET /api/chats/archived`
Returns all archived conversations for the user.

#### `POST /api/chats/:id/archive`
Moves a conversation to the archive (`is_archived = 1`).

#### `POST /api/chats/:id/unarchive`
Restores an archived conversation to active sidebar (`is_archived = 0`).

#### `POST /api/chats/archive-all`
Archives all currently active conversations.

