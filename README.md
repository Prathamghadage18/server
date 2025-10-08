# Sensor UI Server

A Django REST API backend for processing Excel files containing hierarchical sensor data and converting them into JSON tree structures for visualization in the Sensor UI client application.

## Features

- **Excel File Processing**: Parse Excel spreadsheets with sensor hierarchy data using pandas and openpyxl
- **Tree Structure Generation**: Convert tabular data into nested JSON tree format
- **File Upload API**: Accept Excel file uploads via REST API endpoints
- **Default File Endpoint**: Serve tree data from a pre-configured Excel file path
- **CORS Support**: Configured for cross-origin requests from the React frontend
- **Database Integration**: SQLite database for storing upload metadata (ExcelUpload model)

## Tech Stack

- **Backend Framework**: Django 5.2.6 with Django REST Framework 3.16.1
- **Data Processing**: pandas 2.3.2, openpyxl 3.1.5, numpy 2.3.3
- **Database**: SQLite (default Django configuration)
- **CORS Handling**: django-cors-headers 4.9.0
- **Environment Management**: python-dotenv 1.1.1

## Installation

1. Navigate to the server directory:
   ```bash
   cd server
   ```

2. Create a virtual environment (recommended):
   ```bash
   python -m venv venv
   venv\Scripts\activate  # On Windows
   # or
   source venv/bin/activate  # On macOS/Linux
   ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Set up environment variables:
   Create a `.env` file in the server directory with:
   ```
   EXCEL_DEFAULT_PATH=path/to/your/default/excel/file.xlsx
   ```

5. Run database migrations:
   ```bash
   python manage.py migrate
   ```

6. Start the development server:
   ```bash
   python manage.py runserver
   ```

The API will be available at `http://localhost:8000`

## API Endpoints

### GET /api/tree/
Returns tree JSON data from the default Excel file specified in `EXCEL_DEFAULT_PATH`.

**Response:**
```json
{
  "nodeId": {
    "id": "nodeId",
    "name": "Sensor Name",
    "description": "Sensor description",
    "value": "Current value",
    "children": {
      "childId": { /* nested structure */ }
    }
  }
}
```

### POST /api/upload/
Accepts Excel file upload and returns processed tree JSON.

**Request:** Multipart form data with `file` field containing Excel file.

**Response:** Same tree JSON structure as above.

### GET /api/ping/
Health check endpoint.

**Response:**
```json
{
  "status": "ok"
}
```

### GET /tree/
Renders an HTML page with the tree visualization (legacy endpoint).

## Project Structure

```
server/
├── manage.py                 # Django management script
├── requirements.txt          # Python dependencies
├── db.sqlite3               # SQLite database
├── server/                  # Main Django project directory
│   ├── settings.py          # Project settings
│   ├── urls.py              # Main URL configuration
│   ├── wsgi.py              # WSGI configuration
│   └── asgi.py              # ASGI configuration
├── treeapi/                 # Main API app
│   ├── models.py            # Database models (ExcelUpload)
│   ├── views.py             # API view functions
│   ├── urls.py              # App URL patterns
│   ├── serializers.py       # DRF serializers
│   ├── utils.py             # Excel processing utilities
│   ├── migrations/          # Database migrations
│   └── tests.py             # Unit tests
├── static/                  # Static files
├── media/                   # User-uploaded files
├── templates/               # HTML templates
└── tmp_uploads/             # Temporary upload directory
```

## Data Processing

The server uses `utils.build_tree_from_excel()` to process Excel files:

- Reads Excel data using pandas
- Identifies hierarchical relationships based on column structure
- Builds nested dictionary representing the tree
- Handles various Excel formats and sheet configurations

## Environment Configuration

- `EXCEL_DEFAULT_PATH`: Path to default Excel file for the `/api/tree/` endpoint
- Database settings can be configured in `server/settings.py`
- CORS origins should be configured for the client URL (default: localhost:5173)

## Development

- Run migrations after model changes: `python manage.py makemigrations`
- Create superuser for admin: `python manage.py createsuperuser`
- Access Django admin at `/admin/` after creating superuser

## Contributing

1. Follow Django best practices and project structure
2. Add tests for new API endpoints
3. Update this README for API changes
4. Ensure CORS and security configurations are maintained

## License

[Add your license information here]
