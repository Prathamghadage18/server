# RBAC (Role-Based Access Control) Implementation Documentation

## Overview

This Django application implements a comprehensive Role-Based Access Control system for managing sensor tree data with the following features:

### Key Features

1. **Two User Roles**
   - **Superuser**: Full CRUD access on Nodes and Notes
   - **Normal User**: CRUD on Notes and Nodes, but **cannot delete Nodes**

2. **One-Time Excel Upload**
   - Superusers can upload an Excel file **once** to populate initial Nodes and Notes
   - System prevents re-upload after the first successful upload

3. **Note Modification Tracking**
   - When normal users modify notes, metadata is prepended: `[Modified by: <username> at <timestamp>]`
   - Superuser modifications are not tracked (no metadata added)

4. **Predefined Normal Users**
   - Maximum of **9 predefined normal users** can access the system
   - Only these users (plus superusers) can log in
   - Managed through admin panel or management command

5. **Tree View on Login**
   - After successful login, users are redirected to a hierarchical tree view
   - Responsive design with search and filter capabilities
   - Shows all nodes with their note status

## Installation & Setup

### 1. Database Migration

Run migrations to create the new tables:

```bash
python manage.py makemigrations
python manage.py migrate
```

This creates:
- `ExcelUploadTracker`: Tracks one-time Excel upload status
- `AllowedUser`: Stores the 9 predefined normal users
- Updates `Note` model with user tracking fields

### 2. Create Superuser

Create your first superuser:

```bash
python manage.py createsuperuser
```

Or use the management command:

```bash
python manage.py setup_users --create-superuser
```

### 3. Create Normal Users

**Option A: Using Management Command**

```bash
# Create a normal user
python manage.py setup_users --create-normal-user john_doe --password SecurePass123

# Add existing user to allowed list
python manage.py setup_users --add-to-allowed john_doe

# List all allowed users
python manage.py setup_users --list-allowed

# Remove user from allowed list
python manage.py setup_users --remove-from-allowed john_doe
```

**Option B: Using Admin Panel**

1. Log in to admin panel: `http://localhost:8000/admin/`
2. Navigate to **Users** and create a new user
3. Navigate to **Allowed Users** and add the user to the allowed list
4. Maximum 9 users can be added

### 4. Upload Excel File (One-Time)

**Important**: This can only be done once!

1. Log in as superuser
2. Use the API endpoint: `POST /tree/upload/`
3. Upload your Excel file containing sensor data

Example using curl:
```bash
curl -X POST -F "file=@sensors.xlsx" \
  -H "Authorization: Token YOUR_TOKEN" \
  http://localhost:8000/tree/upload/
```

After successful upload, the system will:
- Populate all Nodes from the Excel file
- Mark upload as complete
- Prevent any future uploads

## User Roles and Permissions

### Superuser Permissions

| Action | Nodes | Notes |
|--------|-------|-------|
| Create | ✅ | ✅ |
| Read | ✅ | ✅ |
| Update | ✅ | ✅ |
| Delete | ✅ | ✅ |
| Excel Upload | ✅ (One-time) | N/A |
| Manage Allowed Users | ✅ | N/A |

### Normal User Permissions

| Action | Nodes | Notes |
|--------|-------|-------|
| Create | ✅ | ✅ |
| Read | ✅ | ✅ |
| Update | ✅ | ✅ (with tracking) |
| Delete | ❌ | ✅ |
| Excel Upload | ❌ | N/A |
| Manage Allowed Users | ❌ | N/A |

## URL Structure

### Authentication
- `/login/` - User login page
- `/logout/` - User logout

### Tree Views
- `/tree/` - Main tree view (requires login)
- `/tree/data/` - API endpoint for tree data (JSON)
- `/tree/from-file/` - Get tree from default Excel file
- `/tree/upload/` - Upload Excel file (superuser only, one-time)

### Notes
- `/notes/<node_id>/` - View/edit note for a specific node

### Admin
- `/admin/` - Django admin panel

## API Endpoints

### GET /tree/data/

Returns hierarchical tree data with node information.

**Authentication**: Required

**Response**:
```json
{
  "nodes": [
    {
      "id": "MFGR/SEG/SITE/PLT/FN/SYS/MCH/STG",
      "name": "MFGR/SEG/SITE/PLT/FN/SYS/MCH/STG",
      "has_note": true,
      "note_preview": "Sample note content...",
      "last_updated": "2024-01-15T10:30:00"
    }
  ],
  "total": 150
}
```

### POST /tree/upload/

Upload Excel file to populate nodes (one-time only).

**Authentication**: Superuser required

**Request**:
- Content-Type: multipart/form-data
- Body: Excel file

**Response** (Success):
```json
{
  "success": true,
  "message": "Excel file uploaded successfully. No further uploads allowed.",
  "tree": { ... }
}
```

**Response** (Already Uploaded):
```json
{
  "error": "Excel file has already been uploaded. Re-upload is not allowed.",
  "uploaded_at": "2024-01-15T09:00:00",
  "uploaded_by": "admin"
}
```

## Note Modification Tracking

### How It Works

When a **normal user** saves a note, the system automatically:

1. Strips any existing modification metadata
2. Prepends: `[Modified by: username at YYYY-MM-DD HH:MM:SS]`
3. Adds content
4. Appends: `Last updated: YYYY-MM-DD HH:MM`

**Example**:
```
[Modified by: john_doe at 2024-01-15 14:30:45]
This is the actual note content that the user wrote.
It can span multiple lines.
Last updated: 2024-01-15 14:30
```

When a **superuser** saves a note, only the timestamp is added (no modification tracking).

### Database Field

The `Note` model stores `last_modified_by` as a ForeignKey to the User model.

## Admin Panel Features

### Node Management
- List view shows all nodes with note status
- Search by node ID or note content
- Filter by "has note" status
- Inline note editing
- **Delete permission**: Superuser only

### Note Management
- List view with node, timestamp, and content preview
- Search by content or node ID
- Filter by update date
- **Modification tracking**: All saves track the user

### Excel Upload Tracker
- View upload status
- Shows who uploaded and when
- **Cannot add/delete** after first upload
- Read-only display

### Allowed Users
- List of 9 predefined normal users
- Add/remove users (superuser only)
- Maximum 9 users enforced
- Shows username, email, and creation date

## Security Features

1. **Login Required**: All views except login page require authentication
2. **User Whitelist**: Only allowed users + superusers can access
3. **Permission Checks**: Custom decorators enforce role-based permissions
4. **CSRF Protection**: All forms use CSRF tokens
5. **Password Hashing**: Django's built-in password hashing
6. **One-Time Upload**: Prevents data corruption from multiple uploads

## Templates

### login.html
Beautiful gradient login page with:
- Username/password form
- Error message display
- Responsive design

### tree_view.html
Main tree view with:
- User info in header (username + role badge)
- Statistics cards (total nodes, with/without notes)
- Search box for filtering nodes
- Filter buttons (all, with notes, without notes)
- Node list with action buttons
- Responsive layout

### note_editor.html
Note editing interface with:
- User info display
- Role badge (superuser/normal user)
- Back to tree button
- Note textarea with line/character counter
- Auto-save information
- Modification tracking notice for normal users

## Management Commands

### setup_users

Comprehensive user management:

```bash
# Create superuser interactively
python manage.py setup_users --create-superuser

# Create normal user
python manage.py setup_users --create-normal-user <username> --password <password>

# Add user to allowed list
python manage.py setup_users --add-to-allowed <username>

# Remove user from allowed list
python manage.py setup_users --remove-from-allowed <username>

# List all allowed users
python manage.py setup_users --list-allowed
```

## Workflow Example

### Initial Setup (Superuser)

1. Create superuser account
2. Log in to system
3. Upload Excel file (one-time only)
4. Create 9 normal user accounts
5. Add them to allowed users list
6. Distribute credentials to normal users

### Normal User Workflow

1. Log in with credentials
2. Redirected to tree view
3. Browse/search nodes
4. Click "Add Note" or "View/Edit Note"
5. Edit note content
6. Save (modification tracked automatically)
7. Return to tree view

### Superuser Workflow

1. Log in with superuser credentials
2. Full access to all features
3. Can delete nodes (normal users cannot)
4. Modifications not tracked in notes
5. Manage allowed users via admin panel
6. View upload status

## Models Reference

### ExcelUploadTracker
```python
uploaded_at: DateTimeField  # When uploaded
uploaded_by: ForeignKey(User)  # Who uploaded
file_name: CharField  # Original filename
is_uploaded: BooleanField  # Upload status
```

### AllowedUser
```python
user: OneToOneField(User)  # Link to User
created_at: DateTimeField  # When added to list
```

### Node (Updated)
```python
node_id: CharField(max_length=512, unique=True)
```

### Note (Updated)
```python
node: OneToOneField(Node)
content: TextField
updated_at: DateTimeField
last_modified_by: ForeignKey(User)  # NEW: Track who modified
```

## Troubleshooting

### "Maximum of 9 allowed users reached"
- Remove an existing allowed user
- Or use a superuser account (unlimited)

### "Excel file has already been uploaded"
- Contact superuser to check upload status
- Upload can only happen once
- To re-upload, superuser must delete `ExcelUploadTracker` record in admin

### "You are not authorized to access this system"
- User is not in allowed users list
- Contact superuser to add you

### "Only superusers can delete nodes"
- Normal users cannot delete nodes
- Contact superuser for node deletion

### Note modifications not tracked
- Check if user is superuser (tracking disabled for superusers)
- Verify `last_modified_by` field exists in database

## Best Practices

1. **User Management**
   - Create all 9 normal users upfront
   - Use strong passwords
   - Document which users have access

2. **Excel Upload**
   - Backup database before upload
   - Validate Excel file structure
   - Only upload once with correct data

3. **Note Editing**
   - Normal users: Be aware modifications are tracked
   - Superusers: No tracking, use responsibly

4. **Security**
   - Change default SECRET_KEY in production
   - Use HTTPS in production
   - Regular password updates
   - Monitor allowed users list

## Support

For issues or questions:
1. Check this documentation
2. Review Django admin logs
3. Check application logs
4. Contact system administrator

---

**Version**: 1.0  
**Last Updated**: 2024-01-15  
**Django Version**: 5.2.6
